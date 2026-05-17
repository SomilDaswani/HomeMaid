const { GoogleGenerativeAI } = require('@google/generative-ai');
const supabase = require('./supabase');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Call Gemini and auto-log the result to agent_traces.
 * All callers must handle null return (agent fallback path).
 *
 * @param {string} agentName     — e.g. 'IntentAgent'
 * @param {string} prompt        — full prompt string
 * @param {string} sessionType   — 'quick_service'|'booking'|'voice_intent'|'pricing'|'dispute'
 * @param {string|null} referenceId — booking_id or request_id
 * @param {boolean} expectJson   — whether to parse output as JSON
 * @param {string|null} sessionId — homeowner session ID for per-session trace queries
 * @returns {object|string|null} — parsed JSON output, plain text, or null on failure
 */
async function callGemini(agentName, prompt, sessionType = 'voice_intent', referenceId = null, expectJson = true, sessionId = null) {
  const start = Date.now();
  let output = null;
  let errorMsg = null;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    if (expectJson) {
      // Strip markdown code fences if Gemini wraps in ```json
      const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      output = JSON.parse(clean);
    } else {
      output = text;
    }
  } catch (err) {
    errorMsg = err.message;
    output = null;
  }

  // Fire-and-forget trace log — write flat columns that AgentTraceScreen reads
  const duration = Date.now() - start;
  supabase.from('agent_traces').insert({
    session_id:   sessionId,
    session_type: sessionType,
    reference_id: referenceId,
    agent_name:   agentName,
    prompt:       prompt.slice(0, 2000),  // cap to avoid oversized rows
    output:       output,
    latency_ms:   duration,
    error:        errorMsg,
  }).then(() => {}).catch(() => {});

  return output;
}

module.exports = { callGemini };
