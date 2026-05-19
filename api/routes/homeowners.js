const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

/**
 * POST /api/homeowners/register
 * Upsert homeowner by phone_number. If phone exists, update last_seen.
 * Body: { session_id, phone_number }
 */
router.post('/register', async (req, res) => {
  try {
    const { session_id, phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ success: false, error: 'phone_number is required' });
    }

    console.log('[HOMEOWNER] Register:', { session_id, phone_number });

    const { data, error } = await supabase
      .from('homeowners')
      .upsert(
        {
          phone_number,
          session_id: session_id || null,
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'phone_number' }
      )
      .select()
      .single();

    if (error) {
      console.error('[HOMEOWNER] Upsert error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log('[HOMEOWNER] Registered:', data.id);
    res.json({ success: true, homeowner: data });
  } catch (err) {
    console.error('[POST /homeowners/register]', err.message);
    res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
});

module.exports = router;
