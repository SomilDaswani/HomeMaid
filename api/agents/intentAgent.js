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
- Time parsing examples:
  "2-3pm" → time_preference: "14:00-15:00"
  "2 se 3 baje" → time_preference: "14:00-15:00"
  "kal subah" → time_preference: "tomorrow morning"
  "dopahar baad" → time_preference: "afternoon"
  "subah" → time_preference: "08:00-10:00"
  "dopahar" → time_preference: "12:00-14:00"
  "shaam" → time_preference: "17:00-19:00"
  "raat" → time_preference: "20:00+"

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
 * @param {object} intent - parsed intent
 * @param {string|null} gpsArea - GPS-derived area (skip area penalty if present)
 */
function computeConfidence(intent, gpsArea = null, isQuickService = false) {
  let score = 1.0;

  const VAGUE_CITIES = ['karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad'];
  const VAGUE_TIMES = ['flexible', 'not specified', 'anytime', 'any time', 'null', '', 'koi bhi waqt'];

  // --- Area check ---
  const areaVal = (intent.area || '').toString().trim().toLowerCase();
  const areaIsMissing = !areaVal || areaVal === 'null';
  const areaIsTooVague = VAGUE_CITIES.includes(areaVal);

  if (areaIsMissing) {
    if (!gpsArea) {
      score -= 0.2;
    } else if (VAGUE_CITIES.includes(gpsArea.toLowerCase())) {
      // GPS gave us only a city name — partial penalty
      score -= 0.1;
    }
  } else if (areaIsTooVague && !gpsArea) {
    score -= 0.15;
  } else if (areaIsTooVague && gpsArea && VAGUE_CITIES.includes(gpsArea.toLowerCase())) {
    score -= 0.1;
  }

  // --- Time check --- treat vague values as missing
  const timeVal = (intent.time_preference || '').toString().trim().toLowerCase();
  const timeIsMissing = !timeVal || timeVal === 'null' || VAGUE_TIMES.includes(timeVal);
  if (timeIsMissing && !isQuickService) {
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

  console.log('[INTENT] Confidence breakdown: area=', areaVal, 'gps=', gpsArea, 'time=', timeVal, '→ score=', score.toFixed(2));

  return Math.max(0, Math.min(1.0, parseFloat(score.toFixed(2))));
}

/**
 * Parse a service request transcript into structured intent.
 * Returns null on Gemini failure — caller must handle fallback.
 */
async function extractIntent(transcript, requestId = null, sessionId = null, gpsArea = null, isQuickService = false) {
  console.log('[AGENT] extractIntent isQuickService:', isQuickService);
  const prompt = `${SYSTEM_PROMPT}\n\nNow parse this request: "${transcript}"`;

  const result = await callGemini('IntentAgent', prompt, 'voice_intent', requestId, true, sessionId);

  // Validate required shape — reject garbage output
  if (!result || typeof result !== 'object') {
    return null;
  }

  // If Gemini returned a clarification-only response
  if (result.needs_clarification && result.clarification_question) {
    // If clarification is only about area and we have GPS, skip it
    const missingFields = result.missing_fields || ['area', 'time_preference', 'service_type'];
    const nonAreaMissing = missingFields.filter(f => f !== 'area');
    if (gpsArea && nonAreaMissing.length === 0 && result.service_type) {
      // GPS covers the only missing field — proceed without clarification
      result.area = gpsArea;
      result.needs_clarification = false;
      result.clarification_question = null;
    } else {
      return {
        ...result,
        confidence: 0.3,
        missing_fields: gpsArea ? nonAreaMissing : missingFields,
      };
    }
  }

  // Must have at least service_type to be useful
  if (!result.service_type) {
    return null;
  }

  // Inject GPS area if not already set
  if (gpsArea && !result.area) {
    result.area = gpsArea;
  }

  // Compute server-side confidence (override whatever Gemini returned)
  const confidence = computeConfidence(result, gpsArea, isQuickService);

  // Build missing_fields if Gemini didn't provide them
  const missing = result.missing_fields || [];
  if (!result.area && !gpsArea && !missing.includes('area')) missing.push('area');
  if (!result.time_preference && !missing.includes('time_preference') && !isQuickService) missing.push('time_preference');

  // For quick service, inject time and remove it from missing
  if (isQuickService) {
    if (!result.time_preference) result.time_preference = 'abhi';
    const timeIdx = missing.indexOf('time_preference');
    if (timeIdx !== -1) missing.splice(timeIdx, 1);
  }

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
