const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

/**
 * POST /api/reviews
 * Submit a review for a booking/maid.
 * Body: { booking_id, maid_id?, rating (1-5), comment? }
 */
router.post('/', async (req, res) => {
  try {
    console.log('[REVIEW] Incoming body:', JSON.stringify(req.body));

    const { booking_id, maid_id, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Rating (1-5) is required' });
    }

    // Resolve maid_id from booking if not provided
    let resolvedMaidId = maid_id;
    if (!resolvedMaidId && booking_id) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('maid_id')
        .eq('id', booking_id)
        .single();
      resolvedMaidId = booking?.maid_id;
      console.log('[REVIEW] Resolved maid_id from booking:', resolvedMaidId);
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        booking_id: booking_id || null,
        maid_id: resolvedMaidId || null,
        rating: parseInt(rating),
        comment: comment || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[REVIEW] Insert error:', error);
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'Review already submitted for this booking' });
      }
      return res.status(500).json({ success: false, error: error.message });
    }

    // Update maid avg_rating
    if (resolvedMaidId) {
      const { data: allReviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('maid_id', resolvedMaidId);

      if (allReviews?.length) {
        const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
        await supabase
          .from('maids')
          .update({ avg_rating: Math.round(avg * 10) / 10 })
          .eq('id', resolvedMaidId);
        console.log('[REVIEW] Updated avg_rating for maid', resolvedMaidId, '→', Math.round(avg * 10) / 10);
      }
    }

    console.log('[REVIEW] Success:', data);
    res.json({ success: true, review: data });
  } catch (err) {
    console.error('[POST /reviews]', err.message);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
});

module.exports = router;
