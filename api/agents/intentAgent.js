const { callGemini } = require('../lib/gemini');

const SYSTEM_PROMPT = `You are a Pakistani home service request parser. 
Extract structured data from Roman Urdu, Urdu, or English service requests.

Return ONLY valid JSON, no explanation, no markdown. Schema:
{
  "service_type": "cleaning|laundry|cooking|childcare",
  "area": "string or null",
  "rooms": "number or null",
  "tasks": ["array of specific tasks or empty"],
  "time_preference": "string or null (e.g. 'kal subah', 'aaj shaam')",
  "duration_hours": "number or null",
  "budget_sensitivity": "low|medium|high|null",
  "confidence": "0.0 to 1.0",
  "missing_fields": ["fields that could not be extracted"],
  "language_detected": "urdu|roman_urdu|english|mixed"
}

Examples:
- "Kal 3 kamre saaf karwane hain Gulshan mein" →
  { "service_type": "cleaning", "area": "Gulshan-e-Iqbal", "rooms": 3, "tasks": [], "time_preference": "kal", "duration_hours": 2, "budget_sensitivity": null, "confidence": 0.92, "missing_fields": ["time_preference_exact"], "language_detected": "roman_urdu" }

- "Need someone to cook dinner tonight in DHA" →
  { "service_type": "cooking", "area": "DHA", "rooms": null, "tasks": ["dinner"], "time_preference": "aaj shaam", "duration_hours": 2, "budget_sensitivity": null, "confidence": 0.88, "missing_fields": [], "language_detected": "english" }

- "Kapre dhone hain" →
  { "service_type": "laundry", "area": null, "rooms": null, "tasks": [], "time_preference": null, "duration_hours": null, "budget_sensitivity": null, "confidence": 0.70, "missing_fields": ["area", "time_preference"], "language_detected": "roman_urdu" }

Area name mapping:
- "Gulshan", "Gulshan Iqbal" → "Gulshan-e-Iqbal"
- "DHA" → "DHA Phase 2"
- "Clifton", "Clifton Karachi" → "Clifton"
- "PECHS" → "PECHS"
- "North Nazimabad", "North Naz" → "North Nazimabad"
- "Federal B Area", "FB Area" → "Federal B Area"
- "Johar", "Gulistan Johar" → "Gulistan-e-Johar"
- "Nazimabad" → "Nazimabad"
- "Saddar" → "Saddar"`;

/**
 * Parse a service request transcript into structured intent.
 * Returns null on Gemini failure — caller must handle fallback.
 *
 * @param {string} transcript — raw voice/text input
 * @param {string|null} requestId — for trace reference_id
 * @param {string|null} sessionId — for per-session trace queries
 * @returns {object|null}
 */
async function extractIntent(transcript, requestId = null, sessionId = null) {
  const prompt = `${SYSTEM_PROMPT}\n\nNow parse this request: "${transcript}"`;

  const result = await callGemini('IntentAgent', prompt, 'voice_intent', requestId, true, sessionId);

  // Validate required shape — reject garbage output
  if (!result || typeof result.confidence !== 'number' || !result.service_type) {
    return null;
  }

  return result;
}

/**
 * Generate a clarifying question for missing fields.
 * Returns a plain Roman Urdu question string, or null on failure.
 *
 * @param {object} partialIntent — intent with missing_fields populated
 * @param {string|null} requestId
 * @param {string|null} sessionId
 * @returns {string|null}
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
