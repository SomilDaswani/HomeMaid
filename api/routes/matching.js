const express = require('express');
const router = express.Router();
const { rankMaids } = require('../lib/matching');

/**
 * POST /api/matching/rank
 * Body: { service_types, lat, lng, slot_start, slot_end, estimated_price?, session_id? }
 * Returns top 5 ranked maids + Gemini explanation for #1.
 */
router.post('/rank', async (req, res) => {
  try {
    const {
      service_types,
      lat,
      lng,
      slot_start,
      slot_end,
      estimated_price = 0,
      session_id,
    } = req.body;

    if (!service_types?.length || !lat || !lng || !slot_start || !slot_end) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'service_types, lat, lng, slot_start, slot_end are required',
      });
    }

    // Validate slot: min 1 hour, not in past
    const start = new Date(slot_start);
    const end   = new Date(slot_end);

    if (start < new Date()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'slot_start must be in the future' });
    }
    if ((end - start) < 60 * 60 * 1000) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Slot must be at least 1 hour' });
    }

    const sessionId = req.headers['x-session-id'] || session_id || null;

    const result = await rankMaids({
      serviceTypes:   service_types,
      lat,
      lng,
      slotStart:      slot_start,
      slotEnd:        slot_end,
      estimatedPrice: estimated_price,
      referenceId:    session_id || null,
      sessionId,
    });

    if (!result.maids.length) {
      return res.status(200).json({
        maids:            [],
        explanation:      null,
        total_candidates: 0,
        message:          'NO_CANDIDATES',
      });
    }

    return res.json(result);
  } catch (err) {
    console.error('[POST /matching/rank]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
