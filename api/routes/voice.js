const express = require('express');
const router = express.Router();
const { extractIntent, generateClarifyingQuestion } = require('../agents/intentAgent');

/**
 * POST /api/voice/extract-intent
 * Body: { transcript: string, request_id?: string }
 *
 * Sends transcript through Gemini IntentAgent.
 * If confidence < 0.65 and missing_fields exist, returns a clarifying question.
 * session_id is read from x-session-id header (auto-attached by app's axios interceptor).
 */
router.post('/extract-intent', async (req, res) => {
  try {
    const { transcript, request_id } = req.body;
    // App's axios interceptor attaches x-session-id automatically
    const sessionId = req.headers['x-session-id'] || null;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'transcript is required',
      });
    }

    const intent = await extractIntent(transcript.trim(), request_id || null, sessionId);

    // Gemini failed entirely — return fallback
    if (!intent) {
      return res.status(200).json({
        success: false,
        error: 'agent_unavailable',
        intent: null,
        needs_clarification: false,
        clarifying_question: null,
      });
    }

    // Low confidence + missing fields — ask a clarifying question
    const needsClarification =
      intent.confidence < 0.65 && intent.missing_fields?.length > 0;

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
 * POST /api/voice/transcribe
 * Stub — Google STT requires a paid Cloud account.
 * For the hackathon, the mobile app uses a text input fallback.
 * This endpoint accepts a transcript passthrough for testing.
 */
router.post('/transcribe', (req, res) => {
  const { transcript } = req.body;
  if (transcript) {
    // Allow manual passthrough for testing
    return res.json({ transcript, source: 'passthrough' });
  }
  return res.status(501).json({
    error: 'NOT_IMPLEMENTED',
    message: 'Use text input fallback in the app. Pass transcript directly to /extract-intent.',
  });
});

/**
 * POST /api/voice/clarify
 * Body: { partial_intent: object, request_id?: string }
 * Returns a Roman Urdu clarifying question.
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

module.exports = router;
