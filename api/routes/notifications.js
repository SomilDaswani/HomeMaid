const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

/**
 * GET /api/notifications/pending
 * Query: session_id
 * Returns unread in-app notifications for the session.
 */
router.get('/pending', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'session_id required' });
    }

    const { data, error } = await supabase
      .from('in_app_notifications')
      .select('id, message, type, created_at')
      .eq('session_id', session_id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return res.json(data || []);
  } catch (err) {
    console.error('[GET /notifications/pending]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a notification as read.
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ read: true })
      .eq('id', req.params.id);

    if (error) throw error;

    return res.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /notifications/:id/read]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
