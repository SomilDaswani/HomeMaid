const { callGemini } = require('../lib/gemini');

const SYSTEM_PROMPT = `You are a multilingual service request parser for HomeMaid, a domestic services platform in Karachi, Pakistan.
Parse the user's request — which may be in English, Urdu (اردو), Roman Urdu (transliterated), or a mix of all three — and extract:

service_type: one of [cleaning, laundry, cooking, washing_dishes, cleaning_washroom, ironing_clothes]
area: neighborhood or city area in Karachi
rooms: number of rooms if mentioned (null if not)
tasks: specific tasks requested (array)
time_preference: when they want the service (ISO datetime if determinable, or description like "kal subah")
duration_hours: estimated hours (null if not mentioned)
budget_sensitivity: one of [low, medium, high] — infer from words like "budget nahi hai", "zyada nahi", "affordable", "mehnga nahi", "sasta chahiye", "budget tight hai"

If you cannot determine area OR time_preference, do NOT guess. Instead, return:
{ "needs_clarification": true, "clarification_question": "<friendly Roman Urdu question asking for the missing info>" }

Return ONLY valid JSON. No markdown, no explanation outside the JSON.

Handle these edge cases:
- Misspelled Roman Urdu: "safai", "saafi", "safi" → all mean cleaning
- Ambiguous: "koi aajaye" (someone should come) → ask what service
- Landmarks: "Dolmen Mall ke paas" → area: "Clifton"
- Relative time: "kal subah" → tomorrow morning, "parso" → day after tomorrow, "is hafte" → this week
- Time words: "subah" → 08:00-10:00, "dopahar" → 12:00-14:00, "shaam" → 17:00-19:00, "raat" → 20:00+

Area name mapping:
- "Gulshan", "Gulshan Iqbal" → "Gulshan-e-Iqbal"
- "DHA", "Defence" → "DHA Phase 2"
- "Clifton", "Clifton Karachi", "Dolmen Mall" → "Clifton"
- "PECHS", "Pechs" → "PECHS"
- "North Nazimabad", "North Naz" → "North Nazimabad"
- "Federal B Area", "FB Area" → "Federal B Area"
- "Johar", "Gulistan Johar" → "Gulistan-e-Johar"
- "Nazimabad" → "Nazimabad"
- "Saddar" → "Saddar"

Return this exact JSON schema:
{
  "service_type": "cleaning|laundry|cooking|washing_dishes|cleaning_washroom|ironing_clothes",
  "area": "string or null",
  "rooms": "number or null",
  "tasks": [],
  "time_preference": "string or null",
  "duration_hours": "number or null",
  "budget_sensitivity": "low|medium|high|null",
  "language_detected": "urdu|roman_urdu|english|mixed",
  "missing_fields": ["fields that could not be extracted"]
}`;

/**
 * Compute confidence deterministically on the server — never trust Gemini's number.
 */
function computeConfidence(intent) {
  let score = 1.0;

  // Missing or vague area
  if (!intent.area || intent.area === 'null' || intent.area === '') {
    score -= 0.2;
  }

  // Missing or vague time
  if (!intent.time_preference || intent.time_preference === 'null' || intent.time_preference === '') {
    score -= 0.2;
  }

  // Service type had to be inferred (not explicitly stated)
  if (!intent.service_type) {
    score -= 0.2;
  } else if (intent.missing_fields?.includes('service_type')) {
    score -= 0.1;
  }

  // Budget sensitivity was inferred
  if (intent.budget_sensitivity && intent.missing_fields?.includes('budget_sensitivity')) {
    score -= 0.1;
  }

  // Penalize if many missing fields
  const missingCount = intent.missing_fields?.length || 0;
  if (missingCount >= 3) score -= 0.1;

  return Math.max(0, Math.min(1.0, parseFloat(score.toFixed(2))));
}

/**
 * Parse a service request transcript into structured intent.
 * Returns null on Gemini failure — caller must handle fallback.
 */
async function extractIntent(transcript, requestId = null, sessionId = null) {
  const prompt = `${SYSTEM_PROMPT}\n\nNow parse this request: "${transcript}"`;

  const result = await callGemini('IntentAgent', prompt, 'voice_intent', requestId, true, sessionId);

  // Validate required shape — reject garbage output
  if (!result || typeof result !== 'object') {
    return null;
  }

  // If Gemini returned a clarification-only response
  if (result.needs_clarification && result.clarification_question) {
    return {
      ...result,
      confidence: 0.3,
      missing_fields: result.missing_fields || ['area', 'time_preference', 'service_type'],
    };
  }

  // Must have at least service_type to be useful
  if (!result.service_type) {
    return null;
  }

  // Compute server-side confidence (override whatever Gemini returned)
  const confidence = computeConfidence(result);

  // Build missing_fields if Gemini didn't provide them
  const missing = result.missing_fields || [];
  if (!result.area && !missing.includes('area')) missing.push('area');
  if (!result.time_preference && !missing.includes('time_preference')) missing.push('time_preference');

  return {
    ...result,
    confidence,                          // Server-computed, not Gemini's
    confidence_source: 'server',
    missing_fields: missing,
  };
}

/**
 * Generate a clarifying question for missing fields.
 * Returns a plain Roman Urdu question string, or null on failure.
 */
async function generateClarifyingQuestion(partialIntent, requestId = null, sessionId = null) {
  const missing = partialIntent.missing_fields || [];
  if (!missing.length) return null;

  const fieldLabels = {
    area:             'kahan (area/location)',
    time_preference:  'kab chahiye (time/date)',
    rooms:            'kitne kamre',
    duration_hours:   'kitni der ke liye',
    service_type:     'kya kaam chahiye',
  };

  const missingLabels = missing
    .map(f => fieldLabels[f] || f)
    .filter(Boolean)
    .join(', ');

  const prompt = `You are a helpful Pakistani home service assistant. 
Generate ONE short, friendly clarifying question in Roman Urdu to ask the customer.
Ask about: ${missingLabels}
Their request was about: ${partialIntent.service_type || 'home service'}
Return ONLY the question text, no JSON, no explanation.
Example: "Aap ka area kaunsa hai? Aur kab chahiye?"`;

  const result = await callGemini('ClarifyAgent', prompt, 'voice_intent', requestId, false, sessionId);

  return typeof result === 'string' ? result : null;
}

module.exports = { extractIntent, generateClarifyingQuestion };
