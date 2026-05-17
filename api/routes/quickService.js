const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { isValidTransition } = require('../lib/stateValidation');

/**
 * POST /api/quick-service/request
 * Creates a new QS request. timeout_at = now + 90s (enforced by pg_cron).
 */
router.post('/request', async (req, res) => {
  try {
    const {
      session_id,
      service_types,
      complexity = 'simple',
      tasks = [],
      lat,
      lng,
      area_label,
      estimated_price,
      price_min,
      price_max,
    } = req.body;

    if (!session_id || !service_types?.length || !lat || !lng) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'session_id, service_types, lat, lng are required' });
    }

    const timeoutAt = new Date(Date.now() + 90 * 1000).toISOString();

    const { data, error } = await supabase
      .from('quick_service_requests')
      .insert({
        session_id,
        service_types,
        complexity,
        tasks,
        location: `POINT(${lng} ${lat})`,
        area_label,
        estimated_price,
        price_min,
        price_max,
        status: 'pending_bids',
        timeout_at: timeoutAt,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /quick-service/request]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/quick-service/:id/bids
 * Returns all bids for a request (sorted by price ascending).
 */
router.get('/:id/bids', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bids')
      .select(`
        id, offered_price, status, created_at,
        maids ( id, name, avg_rating, total_reviews, area_label, skill_level )
      `)
      .eq('request_id', req.params.id)
      .order('offered_price', { ascending: true });

    if (error) throw error;

    return res.json({ bids: data || [] });
  } catch (err) {
    console.error('[GET /quick-service/:id/bids]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/quick-service/:id/mock-bid
 * Demo only: inserts a fake bid from a random nearby maid.
 * Used by the client's staggered mock-bid timer.
 */
router.post('/:id/mock-bid', async (req, res) => {
  try {
    // Find the request to get location
    const { data: request, error: reqErr } = await supabase
      .from('quick_service_requests')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (reqErr || !request) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    if (request.status !== 'pending_bids') {
      return res.status(409).json({ error: 'CONFLICT', message: 'Request not accepting bids' });
    }

    // Pick a random online maid who hasn't bid yet
    const { data: existingBids } = await supabase
      .from('bids')
      .select('maid_id')
      .eq('request_id', req.params.id);

    const alreadyBidMaidIds = (existingBids || []).map(b => b.maid_id);

    let maidQuery = supabase
      .from('maids')
      .select('id, rate_min, rate_max')
      .eq('is_online', true)
      .eq('status', 'active')
      .is('active_qs_request_id', null)
      .contains('service_types', request.service_types);

    if (alreadyBidMaidIds.length > 0) {
      maidQuery = maidQuery.not('id', 'in', `(${alreadyBidMaidIds.join(',')})`);
    }

    const { data: maids } = await maidQuery.limit(10);

    if (!maids?.length) {
      return res.status(404).json({ error: 'NO_AVAILABLE_MAID' });
    }

    const maid = maids[Math.floor(Math.random() * maids.length)];
    const min = maid.rate_min || request.price_min || 800;
    const max = maid.rate_max || request.price_max || 1500;
    const offeredPrice = Math.floor(Math.random() * (max - min + 1)) + min;

    const { data: bid, error: bidErr } = await supabase
      .from('bids')
      .insert({
        request_id:    req.params.id,
        maid_id:       maid.id,
        offered_price: offeredPrice,
        status:        'pending',
      })
      .select(`
        id, offered_price, status, created_at,
        maids ( id, name, avg_rating, total_reviews, area_label, skill_level )
      `)
      .single();

    if (bidErr) throw bidErr;

    return res.status(201).json(bid);
  } catch (err) {
    console.error('[POST /quick-service/:id/mock-bid]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/quick-service/:id/select-bid
 * Atomically selects a bid using the select_bid() RPC.
 */
router.post('/:id/select-bid', async (req, res) => {
  try {
    const { bid_id } = req.body;
    if (!bid_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'bid_id is required' });
    }

    const { data, error } = await supabase.rpc('select_bid', {
      p_request_id: req.params.id,
      p_bid_id:     bid_id,
    });

    if (error) throw error;

    if (data.error) {
      const statusMap = {
        BID_NOT_FOUND:     404,
        BID_ALREADY_TAKEN: 409,
        CONFLICT:          409,
        MAID_BUSY:         409,
      };
      return res.status(statusMap[data.error] || 400).json(data);
    }

    return res.json(data);
  } catch (err) {
    console.error('[POST /quick-service/:id/select-bid]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * PATCH /api/quick-service/:id/status
 * State-machine-enforced status transition.
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'status is required' });
    }

    const { data: current, error: fetchErr } = await supabase
      .from('quick_service_requests')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !current) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    if (!isValidTransition('quick_service', current.status, status)) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: `Cannot transition quick_service from '${current.status}' to '${status}'`,
      });
    }

    const update = { status, updated_at: new Date().toISOString() };

    // Clear maid lock when QS job completes or cancels
    if (['completed', 'cancelled', 'timed_out'].includes(status)) {
      const { data: req_data } = await supabase
        .from('quick_service_requests')
        .select('selected_maid_id')
        .eq('id', req.params.id)
        .single();

      if (req_data?.selected_maid_id) {
        await supabase
          .from('maids')
          .update({ active_qs_request_id: null })
          .eq('id', req_data.selected_maid_id);
      }
    }

    const { data, error } = await supabase
      .from('quick_service_requests')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[PATCH /quick-service/:id/status]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/quick-service/:id/cancel
 * Cancels from pending_bids only (state machine enforced via status PATCH).
 */
router.post('/:id/cancel', async (req, res) => {
  return router.handle(
    Object.assign(req, { method: 'PATCH', url: `/${req.params.id}/status`, body: { status: 'cancelled' } }),
    res,
  );
});

/**
 * POST /api/quick-service/:id/timeout
 * Client-calls this when its 90s countdown hits 0 (Vercel serverless fallback).
 */
router.post('/:id/timeout', async (req, res) => {
  try {
    const { data: current } = await supabase
      .from('quick_service_requests')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (current?.status !== 'pending_bids') {
      return res.json({ ok: true, skipped: true });
    }

    await supabase
      .from('quick_service_requests')
      .update({ status: 'timed_out', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('status', 'pending_bids');  // safe: only if still pending

    return res.json({ ok: true });
  } catch (err) {
    console.error('[POST /quick-service/:id/timeout]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
