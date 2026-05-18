const { GoogleGenerativeAI } = require('@google/generative-ai');
const supabase = require('./supabase');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ── Single stable model ───────────────────────────────────────────────────────
const MODEL = 'gemini-2.5-flash-lite';

// ── Circuit breaker state ─────────────────────────────────────────────────────
const breaker = {
  failures: [],          // timestamps of recent failures
  openUntil: 0,          // timestamp when breaker re-closes
  WINDOW_MS: 60_000,     // rolling window
  THRESHOLD: 5,          // failures before opening
  COOLDOWN_MS: 30_000,   // how long breaker stays open
};

function isCircuitOpen() {
  if (Date.now() < breaker.openUntil) return true;
  // Prune old failures outside window
  const cutoff = Date.now() - breaker.WINDOW_MS;
  breaker.failures = breaker.failures.filter(t => t > cutoff);
  return false;
}

function recordFailure() {
  breaker.failures.push(Date.now());
  const cutoff = Date.now() - breaker.WINDOW_MS;
  breaker.failures = breaker.failures.filter(t => t > cutoff);
  if (breaker.failures.length >= breaker.THRESHOLD) {
    breaker.openUntil = Date.now() + breaker.COOLDOWN_MS;
    console.warn('[GEMINI] Circuit breaker OPEN — returning degraded responses for 30s');
  }
}

function recordSuccess() {
  breaker.failures = [];
  breaker.openUntil = 0;
}

// ── Intent cache (5-min TTL) ──────────────────────────────────────────────────
const intentCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key) {
  const entry = intentCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    intentCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  intentCache.set(key, { value, ts: Date.now() });
  // Evict old entries if cache grows too large
  if (intentCache.size > 200) {
    const oldest = intentCache.keys().next().value;
    intentCache.delete(oldest);
  }
}

// ── Retry with exponential backoff ────────────────────────────────────────────
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tryModel(prompt, expectJson, maxRetries = 3) {
  const model = genAI.getGenerativeModel({ model: MODEL });
  let lastErr = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      if (expectJson) {
        const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        return { output: JSON.parse(clean), modelUsed: MODEL, attempts: attempt + 1 };
      }
      return { output: text, modelUsed: MODEL, attempts: attempt + 1 };
    } catch (err) {
      lastErr = err;
      const status = err?.status || err?.httpStatusCode || 0;
      // Retry on 429 (quota) or 503 (overloaded)
      if (status === 429 || status === 503) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`[GEMINI] ${MODEL} returned ${status}, retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`);
        await sleep(delayMs);
        continue;
      }
      // Non-retryable error — break
      console.error(`[GEMINI] ${MODEL} non-retryable error (${status}): ${err.message}`);
      break;
    }
  }
  throw lastErr;
}

/**
 * Call Gemini with fallback chain, retry, circuit breaker, and caching.
 * All callers must handle null return (agent fallback path).
 */
async function callGemini(agentName, prompt, sessionType = 'voice_intent', referenceId = null, expectJson = true, sessionId = null) {
  const start = Date.now();
  let output = null;
  let errorMsg = null;
  let modelUsed = 'none';
  let attempts = 0;
  let fallbackTriggered = false;
  let circuitBroken = false;

  // ── Cache check (only for IntentAgent with JSON) ──────────────────────────
  if (expectJson && agentName === 'IntentAgent') {
    const cached = getCached(prompt);
    if (cached) {
      modelUsed = 'cache';
      output = cached;
      // Still log the trace for visibility
      logTrace(agentName, prompt, sessionType, referenceId, sessionId, output, null, Date.now() - start, modelUsed, 0, false, true);
      return output;
    }
  }

  // ── Circuit breaker ───────────────────────────────────────────────────────
  if (isCircuitOpen()) {
    circuitBroken = true;
    errorMsg = 'circuit_breaker_open';
    output = expectJson
      ? { _fallback: true, _reason: 'AI temporarily unavailable, using fallback', service_type: null, confidence: 0, needs_clarification: true, clarification_question: 'AI abhi available nahi hai. Kuch der baad try karein.' }
      : 'AI service temporarily unavailable. Please try again in a moment.';
    logTrace(agentName, prompt, sessionType, referenceId, sessionId, output, errorMsg, Date.now() - start, 'circuit_breaker', 0, false, false);
    return output;
  }

  // ── Try model ─────────────────────────────────────────────────────────────
  try {
    const result = await tryModel(prompt, expectJson);
    output = result.output;
    modelUsed = result.modelUsed;
    attempts = result.attempts;
    recordSuccess();
  } catch (err) {
    console.error(`[GEMINI] ${MODEL} failed after retries: ${err.message}`);
    errorMsg = err.message;
    recordFailure();
  }

  // ── Cache successful intent results ───────────────────────────────────────
  if (output && expectJson && agentName === 'IntentAgent' && !output._fallback) {
    setCache(prompt, output);
  }

  // ── Log trace ─────────────────────────────────────────────────────────────
  const duration = Date.now() - start;
  logTrace(agentName, prompt, sessionType, referenceId, sessionId, output, errorMsg, duration, modelUsed, attempts, fallbackTriggered, false);

  return output;
}

/**
 * Fire-and-forget trace log.
 */
function logTrace(agentName, prompt, sessionType, referenceId, sessionId, output, errorMsg, duration, modelUsed, attempts, fallbackTriggered, fromCache) {
  supabase.from('agent_traces').insert({
    session_id:     sessionId,
    session_type:   sessionType,
    reference_id:   referenceId,
    agent_name:     agentName,
    input_summary:  prompt.slice(0, 500),
    output_summary: typeof output === 'string' ? output.slice(0, 500) : JSON.stringify(output)?.slice(0, 500),
    full_input:     { prompt: prompt.slice(0, 4000) },
    full_output:    typeof output === 'object' ? { ...output, _meta: { model: modelUsed, attempts, fallback: fallbackTriggered, cached: fromCache } } : { text: output, _meta: { model: modelUsed, attempts, fallback: fallbackTriggered, cached: fromCache } },
    duration_ms:    duration,
    error:          errorMsg,
  }).then(() => {}).catch(() => {});
}

module.exports = { callGemini, genAI, MODEL };
