const express = require('express');
const router = express.Router();
const { extractIntent, generateClarifyingQuestion } = require('../agents/intentAgent');
const { callGemini, genAI, MODEL } = require('../lib/gemini');
const supabase = require('../lib/supabase');

// ── Groq Whisper client (lazy init to avoid crash if key missing) ─────────────
let groqClient = null;
function getGroq() {
  if (groqClient) return groqClient;
  try {
    const Groq = require('groq-sdk');
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    return groqClient;
  } catch {
    return null;
  }
}

/**
 * POST /api/voice/transcribe-and-parse
 * Full audio pipeline: Groq Whisper transcription → IntentAgent parsing.
 * Falls back to Gemini multimodal if Groq fails.
 *
 * Body: { audio: string (base64), mimeType: string, sessionId?: string }
 */
router.post('/transcribe-and-parse', async (req, res) => {
  const startTime = Date.now();
  try {
    const { audio, mimeType = 'audio/m4a', sessionId, gps_area } = req.body;
    const headerSessionId = req.headers['x-session-id'] || sessionId || null;

    if (!audio) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'audio (base64) is required' });
    }

    let transcript = null;
    let detectedLanguage = null;
    let whisperConfidence = null;
    let audioDurationMs = null;
    let transcriptionPath = null; // 'groq_whisper' or 'gemini_multimodal'
    let intent = null;

    // ── Path A: Groq Whisper ────────────────────────────────────────────────
    const groq = getGroq();
    if (groq) {
      try {
        const audioBuffer = Buffer.from(audio, 'base64');

        // Groq expects a File-like object; use a Blob in Node 18+
        const file = new File([audioBuffer], 'recording.m4a', { type: mimeType });

        const transcription = await groq.audio.transcriptions.create({
          file,
          model: 'whisper-large-v3',
          language: 'ur',
          response_format: 'verbose_json',
          temperature: 0.0,
        });

        transcript = transcription.text;
        detectedLanguage = transcription.language || 'ur';
        audioDurationMs = transcription.duration ? transcription.duration * 1000 : null;
        transcriptionPath = 'groq_whisper';

        // Compute confidence from segment log probs
        if (transcription.segments?.length) {
          const avgLogProb = transcription.segments.reduce((sum, s) => sum + (s.avg_logprob || 0), 0) / transcription.segments.length;
          whisperConfidence = Math.min(1.0, Math.max(0.0, avgLogProb + 1.0));
        }
      } catch (groqErr) {
        console.warn('[VOICE] Groq Whisper failed:', groqErr.message);
        // Fall through to Gemini
      }
    }

    // ── Path B: Gemini Multimodal (fallback) ────────────────────────────────
    if (!transcript) {
      try {
        const model = genAI.getGenerativeModel({ model: MODEL });
        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: mimeType || 'audio/mp4',
              data: audio,
            },
          },
          {
            text: `You are a multilingual transcription and intent parsing system for a home services app in Karachi, Pakistan.

First transcribe this audio (it may be in Urdu, Roman Urdu, English, or a mix). Then parse the transcription into this exact JSON structure:
{
  "transcript": "...",
  "detected_language": "urdu|roman_urdu|english|mixed",
  "service_type": "cleaning|laundry|cooking|washing_dishes|cleaning_washroom|ironing_clothes",
  "area": "string or null",
  "rooms": null,
  "tasks": [],
  "time_preference": "string or null",
  "duration_hours": null,
  "budget_sensitivity": "low|medium|high|null",
  "confidence_score": 0.85,
  "needs_clarification": false,
  "clarification_question": null
}

Return ONLY valid JSON. No markdown.`,
          },
        ]);

        const text = result.response.text().trim();
        const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        const parsed = JSON.parse(clean);

        transcript = parsed.transcript || text;
        detectedLanguage = parsed.detected_language || 'mixed';
        transcriptionPath = 'gemini_multimodal';
        // Gemini did both transcription and parsing in one call
        intent = parsed;
      } catch (geminiErr) {
        console.error('[VOICE] Gemini multimodal also failed:', geminiErr.message);
        // Log failure trace
        logVoiceTrace(headerSessionId, null, null, null, null, null, geminiErr.message, Date.now() - startTime, 'both_failed');
        return res.json({
          success: false,
          error: 'transcription_failed',
          message: 'Awaz nahi samajh ayi, likhain please.',
          intent: null,
          needs_clarification: false,
        });
      }
    }

    // ── Parse intent via IntentAgent (if Groq was used and we only have transcript) ──
    if (transcript && !intent) {
      intent = await extractIntent(transcript, null, headerSessionId, gps_area);
    }

    // Inject GPS area into intent if provided and intent is missing area
    if (intent && gps_area && !intent.area) {
      intent.area = gps_area;
    }

    // Handle parse failure
    if (!intent) {
      logVoiceTrace(headerSessionId, transcript, detectedLanguage, whisperConfidence, audioDurationMs, null, 'intent_parse_failed', Date.now() - startTime, transcriptionPath);
      return res.json({
        success: false,
        error: 'parse_failed',
        transcript,
        message: 'Samajh nahi aaya. Dobara bolein ya likhein.',
        intent: null,
        needs_clarification: true,
      });
    }

    // ── Clarification check ─────────────────────────────────────────────────
    const needsClarification = intent.confidence < 0.7 && intent.missing_fields?.length > 0;
    let clarifyingQuestion = null;
    if (needsClarification) {
      clarifyingQuestion = await generateClarifyingQuestion(intent, null, headerSessionId);
    }

    // ── Log VoiceAgent trace ────────────────────────────────────────────────
    logVoiceTrace(headerSessionId, transcript, detectedLanguage, whisperConfidence, audioDurationMs, intent, null, Date.now() - startTime, transcriptionPath);

    return res.json({
      success: true,
      transcript,
      detected_language: detectedLanguage,
      whisper_confidence: whisperConfidence,
      transcription_path: transcriptionPath,
      intent,
      needs_clarification: needsClarification,
      clarifying_question: clarifyingQuestion,
    });
  } catch (err) {
    console.error('[POST /voice/transcribe-and-parse]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * Fire-and-forget VoiceAgent trace log.
 */
function logVoiceTrace(sessionId, transcript, language, whisperConf, durationMs, intent, errorMsg, totalMs, path) {
  supabase.from('agent_traces').insert({
    session_id:     sessionId,
    session_type:   'quick_service',
    agent_name:     'VoiceAgent',
    input_summary:  transcript ? `Audio transcribed: "${transcript.slice(0, 100)}"` : 'Audio transcription failed',
    output_summary: intent ? `Intent: ${intent.service_type || '?'}, Confidence: ${intent.confidence || intent.confidence_score || '?'}` : errorMsg || 'no intent',
    full_input:     { transcript, detected_language: language, whisper_confidence: whisperConf, audio_duration_ms: durationMs, transcription_path: path },
    full_output:    intent || { error: errorMsg },
    duration_ms:    totalMs,
    error:          errorMsg,
  }).then(() => {}).catch(() => {});
}

// ─── Existing endpoints (kept as-is) ──────────────────────────────────────────

/**
 * POST /api/voice/extract-intent
 * Text-based intent extraction (no audio).
 */
router.post('/extract-intent', async (req, res) => {
  try {
    const { transcript, request_id, gps_area } = req.body;
    const sessionId = req.headers['x-session-id'] || null;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'transcript is required' });
    }

    let intent = await extractIntent(transcript.trim(), request_id || null, sessionId, gps_area);

    // Inject GPS area if intent is missing area
    if (intent && gps_area && !intent.area) {
      intent.area = gps_area;
    }

    if (!intent) {
      return res.status(200).json({
        success: false,
        error: 'agent_unavailable',
        intent: null,
        needs_clarification: false,
        clarifying_question: null,
      });
    }

    const needsClarification = intent.confidence < 0.7 && intent.missing_fields?.length > 0;
    let clarifyingQuestion = null;
    if (needsClarification) {
      clarifyingQuestion = await generateClarifyingQuestion(intent, request_id || null, sessionId);
    }

    return res.json({
      success: true,
      intent,
      needs_clarification: needsClarification,
      clarifying_question: clarifyingQuestion,
    });
  } catch (err) {
    console.error('[POST /voice/extract-intent]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/voice/clarify
 */
router.post('/clarify', async (req, res) => {
  try {
    const { partial_intent, request_id } = req.body;
    const sessionId = req.headers['x-session-id'] || null;

    if (!partial_intent) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'partial_intent is required' });
    }

    const question = await generateClarifyingQuestion(partial_intent, request_id || null, sessionId);
    return res.json({
      question: question || 'Meherbani karke apni zaroorat dobara batayein.',
    });
  } catch (err) {
    console.error('[POST /voice/clarify]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/voice/parse-text
 * Runs IntentAgent on a plain-text string — used for clarification follow-ups.
 * Body: { text: string, session_id?: string }
 */
router.post('/parse-text', async (req, res) => {
  try {
    const { text, session_id, gps_area } = req.body;
    const headerSessionId = req.headers['x-session-id'] || session_id || null;

    if (!text?.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'text is required' });
    }

    const result = await extractIntent(text.trim(), headerSessionId, gps_area);

    const intent               = result?.intent || result;
    const needsClarification   = !intent || (intent.confidence || 0) < 0.7;
    const clarifyingQuestion   = needsClarification ? result?.clarifying_question || null : null;

    return res.json({
      transcript: text,
      intent,
      needs_clarification: needsClarification,
      clarifying_question: clarifyingQuestion,
    });
  } catch (err) {
    console.error('[POST /voice/parse-text]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;

