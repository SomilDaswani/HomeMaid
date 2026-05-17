const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

/**
 * GET /api/maids/nearby
 * Query: lat, lng, radius (meters, default 5000)
 * Returns maids within radius using PostGIS ST_DWithin via DB function.
 */
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'lat and lng are required' });
    }

    const { data, error } = await supabase.rpc('get_nearby_maids', {
      p_lat:    parseFloat(lat),
      p_lng:    parseFloat(lng),
      p_radius: parseInt(radius, 10),
    });

    if (error) throw error;

    return res.json({ maids: data || [] });
  } catch (err) {
    console.error('[GET /maids/nearby]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/maids/:id
 * Returns full maid profile.
 */
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('maids')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Maid not found' });
    }

    return res.json(data);
  } catch (err) {
    console.error('[GET /maids/:id]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/maids/:id/reviews
 * Returns reviews ordered by recency (for display + F4 scoring).
 */
router.get('/:id/reviews', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at')
      .eq('maid_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.json({ reviews: data || [] });
  } catch (err) {
    console.error('[GET /maids/:id/reviews]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/maids/:id/availability
 * Query: date (YYYY-MM-DD)
 * Returns count of confirmed bookings for that day (used to compute F2).
 */
router.get('/:id/availability', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'date is required' });
    }

    const { count, error } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('maid_id', req.params.id)
      .eq('scheduled_date', date)
      .not('status', 'in', '("cancelled")');

    if (error) throw error;

    return res.json({ jobs_on_date: count || 0 });
  } catch (err) {
    console.error('[GET /maids/:id/availability]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
