const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { isValidTransition } = require('../lib/stateValidation');

/**
 * POST /api/bookings
 * Creates booking in 'pending' state.
 * Simulated 15s maid confirmation happens client-side:
 * client setTimeout(15000) → PATCH /api/bookings/:id/status { status: 'confirmed' }
 */
router.post('/', async (req, res) => {
  try {
    const {
      session_id, maid_id, service_types, complexity = 'simple',
      tasks = [], scheduled_date, scheduled_start, scheduled_end,
      total_price, price_breakdown,
    } = req.body;

    if (!session_id || !maid_id || !service_types?.length || !scheduled_date || !scheduled_start || !scheduled_end) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'session_id, maid_id, service_types, scheduled_date, scheduled_start, scheduled_end required',
      });
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        session_id, maid_id, service_types, complexity, tasks,
        scheduled_date, scheduled_start, scheduled_end,
        total_price, price_breakdown,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /bookings]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/bookings/homeowner/:sessionId
 */
router.get('/homeowner/:sessionId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`*, maids ( id, name, avg_rating, area_label )`)
      .eq('session_id', req.params.sessionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ bookings: data || [] });
  } catch (err) {
    console.error('[GET /bookings/homeowner/:sessionId]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/bookings/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`*, maids ( id, name, avg_rating, area_label, phone )`)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(data);
  } catch (err) {
    console.error('[GET /bookings/:id]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * PATCH /api/bookings/:id/status
 * State-machine enforced. Confirmation uses confirm_booking() RPC for overlap check.
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'status required' });

    const { data: current, error: fetchErr } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !current) return res.status(404).json({ error: 'NOT_FOUND' });

    if (!isValidTransition('booking', current.status, status)) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: `Cannot transition booking from '${current.status}' to '${status}'`,
      });
    }

    // Use atomic RPC for pending → confirmed
    if (status === 'confirmed') {
      const { data: result, error: rpcErr } = await supabase.rpc('confirm_booking', {
        p_booking_id: req.params.id,
      });

      if (rpcErr) throw rpcErr;

      if (result.error) {
        const statusMap = { SLOT_CONFLICT: 409, BOOKING_NOT_FOUND: 404, CONFLICT: 409 };
        return res.status(statusMap[result.error] || 400).json(result);
      }

      const { data: confirmed } = await supabase
        .from('bookings').select('*, maids ( id, name, phone, avg_rating )').eq('id', req.params.id).single();

      // Fire simulated notification trace
      supabase.from('agent_traces').insert({
        session_id:     confirmed?.session_id || null,
        session_type:   'booking',
        agent_name:     'NotificationAgent',
        input_summary:  `Booking confirmed: ${req.params.id.slice(0, 8)}`,
        output_summary: `SMS simulated to homeowner: "HomeMaid: ${confirmed?.maids?.name || 'Maid'} aap ke ghar aa rahi hain."`,
        full_input:     { booking_id: req.params.id, maid_id: confirmed?.maid_id },
        full_output:    { channel: 'sms_simulated', delivered: true, maid_name: confirmed?.maids?.name, maid_phone: confirmed?.maids?.phone },
        duration_ms:    0,
      }).then(() => {}).catch(() => {});

      return res.json(confirmed);
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error('[PATCH /bookings/:id/status]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/bookings/:id/cancel
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const { cancelled_by = 'homeowner', cancellation_reason } = req.body;

    const { data: current } = await supabase
      .from('bookings').select('status').eq('id', req.params.id).single();

    if (!isValidTransition('booking', current?.status, 'cancelled')) {
      return res.status(409).json({ error: 'CONFLICT', message: 'Booking cannot be cancelled in current state' });
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_by, cancellation_reason, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error('[POST /bookings/:id/cancel]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
