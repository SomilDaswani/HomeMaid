const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

/**
 * POST /api/reviews
 * One review per booking per session (enforced by UNIQUE constraint).
 * Only allowed when booking is completed.
 * Calls update_maid_rating() RPC after insert.
 */
router.post('/', async (req, res) => {
  try {
    const { booking_id, maid_id, session_id, rating, comment } = req.body;

    if (!booking_id || !maid_id || !session_id || !rating) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'booking_id, maid_id, session_id, rating required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'rating must be 1–5' });
    }

    // Verify booking is completed
    const { data: booking } = await supabase
      .from('bookings').select('status, session_id').eq('id', booking_id).single();

    if (!booking || booking.status !== 'completed') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Review only allowed on completed bookings' });
    }
    if (booking.session_id !== session_id) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert({ booking_id, maid_id, session_id, rating, comment })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'CONFLICT', message: 'Review already submitted for this booking' });
      }
      throw error;
    }

    // Recalculate maid avg_rating
    await supabase.rpc('update_maid_rating', { p_maid_id: maid_id });

    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /reviews]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
