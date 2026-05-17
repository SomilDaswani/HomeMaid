const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

/**
 * GET /api/traces/session/:sessionId
 * Returns all agent traces for a session (for AgentTraceScreen).
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agent_traces')
      .select('*')
      .eq('session_id', req.params.sessionId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ traces: data || [] });
  } catch (err) {
    console.error('[GET /traces/session/:sessionId]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/traces/export
 * Returns all traces as JSON for export (demo artifact).
 */
router.get('/export', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agent_traces')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    res.setHeader('Content-Disposition', 'attachment; filename="homemaid-traces.json"');
    return res.json(data || []);
  } catch (err) {
    console.error('[GET /traces/export]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/traces
 * Internal: logs an agent trace. Called by agent pipeline functions.
 */
router.post('/', async (req, res) => {
  try {
    const {
      session_id, agent_name, reference_id, session_type,
      input_summary, output_summary, full_input, full_output,
      duration_ms, error: agentError,
    } = req.body;

    const { data, error } = await supabase
      .from('agent_traces')
      .insert({
        session_id, agent_name, reference_id, session_type,
        input_summary, output_summary, full_input, full_output,
        duration_ms, error: agentError,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /traces]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
