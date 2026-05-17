const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

const COMPLAINT_WINDOW_MS = 2 * 60 * 60 * 1000;       // 2 hours (quality complaints)
const NOSHOW_GRACE_MS     = 30 * 60 * 1000;             // 30 minutes (no-show minimum wait)

/**
 * POST /api/disputes
 * Files a dispute against a completed or confirmed booking.
 */
router.post('/', async (req, res) => {
  try {
    const { booking_id, session_id, dispute_type, description } = req.body;

    if (!booking_id || !session_id || !dispute_type) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'booking_id, session_id, dispute_type required' });
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('status, session_id, scheduled_date, scheduled_start, created_at, updated_at')
      .eq('id', booking_id)
      .single();

    if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });
    if (booking.session_id !== session_id) return res.status(403).json({ error: 'FORBIDDEN' });

    const now = Date.now();

    if (dispute_type === 'quality_complaint') {
      const completedAt = new Date(booking.updated_at).getTime();
      if (now - completedAt > COMPLAINT_WINDOW_MS) {
        return res.status(400).json({
          error: 'WINDOW_EXPIRED',
          message: 'Quality complaint window is 2 hours after job completion',
        });
      }
    }

    if (dispute_type === 'no_show') {
      const scheduledAt = new Date(`${booking.scheduled_date}T${booking.scheduled_start}`).getTime();
      if (now - scheduledAt < NOSHOW_GRACE_MS) {
        return res.status(400).json({
          error: 'TOO_EARLY',
          message: 'Please wait 30 minutes past scheduled start before reporting a no-show',
        });
      }
    }

    const { data, error } = await supabase
      .from('disputes')
      .insert({ booking_id, session_id, dispute_type, description, status: 'open' })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /disputes]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
