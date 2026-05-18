const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { isValidTransition } = require('../lib/stateValidation');
const { getMedian } = require('../lib/marketCache');

// ── Roman Urdu bid messages ──────────────────────────────────────────────────
function generateBidMessage(maid) {
  const templates = [
    `Mera ${maid.jobs_completed || 0} jobs ka tajurba hai. Abhi aa sakti hoon.`,
    `${maid.avg_rating || 4.0} star rating hai meri. Behtareen kaam karti hoon.`,
    `Seedha aap ke ghar pohonch jaungi, koi fikar nahi.`,
    `Main ${maid.area_label || 'nazdeek'} se hoon. Jaldi pohonch sakti hoon.`,
    `${maid.total_reviews || 0} logon ne mujhe review diya hai, sab khush hain.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * POST /api/quick-service/request
 * Creates a new QS request. timeout_at = now + 90s.
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
 * Returns all NON-EXPIRED bids for a request (sorted by price ascending).
 */
router.get('/:id/bids', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bids')
      .select(`
        id, offered_price, status, created_at, expires_at, eta_minutes, bid_message,
        maids ( id, name, phone, avg_rating, total_reviews, area_label, skill_level, jobs_completed )
      `)
      .eq('request_id', req.params.id)
      .in('status', ['pending', 'accepted'])
      .order('offered_price', { ascending: true });

    if (error) throw error;

    // Filter out expired bids
    const now = new Date();
    const activeBids = (data || []).filter(bid => {
      if (!bid.expires_at) return true;
      return new Date(bid.expires_at) > now;
    });

    // Tag "best value" bid
    const bestValue = activeBids.find(b =>
      b.status === 'pending' && (b.maids?.avg_rating || 0) >= 4.0
    );

    return res.json({
      bids: activeBids.map(b => ({
        ...b,
        is_best_value: bestValue && b.id === bestValue.id,
      })),
    });
  } catch (err) {
    console.error('[GET /quick-service/:id/bids]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/quick-service/:id/mock-bid
 * Demo: inserts a realistic bid from a random nearby maid.
 * Price anchored to the request's estimated price (85%-115% range).
 */
router.post('/:id/mock-bid', async (req, res) => {
  try {
    // Find the request
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
      .select('id, name, phone, avg_rating, total_reviews, area_label, skill_level, jobs_completed, base_rate, rate_min, rate_max')
      .eq('is_online', true)
      .eq('status', 'active')
      .is('active_qs_request_id', null);

    if (request.service_types?.length) {
      maidQuery = maidQuery.contains('service_types', request.service_types);
    }

    if (alreadyBidMaidIds.length > 0) {
      maidQuery = maidQuery.not('id', 'in', `(${alreadyBidMaidIds.join(',')})`);
    }

    const { data: maids } = await maidQuery.limit(10);

    if (!maids?.length) {
      return res.status(404).json({ error: 'NO_AVAILABLE_MAID' });
    }

    const maid = maids[Math.floor(Math.random() * maids.length)];

    // Anchor bid price to the request's estimated price (85%–115%)
    const anchorPrice = request.estimated_price || request.price_min || 500;
    const offeredPrice = Math.round(anchorPrice * (0.85 + Math.random() * 0.30));

    // Random ETA
    const etaMinutes = Math.floor(10 + Math.random() * 20);

    // Expiry in 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Roman Urdu bid message using real maid stats
    const bidMessage = generateBidMessage(maid);

    const { data: bid, error: bidErr } = await supabase
      .from('bids')
      .insert({
        request_id:    req.params.id,
        maid_id:       maid.id,
        offered_price: offeredPrice,
        eta_minutes:   etaMinutes,
        expires_at:    expiresAt,
        bid_message:   bidMessage,
        status:        'pending',
      })
      .select(`
        id, offered_price, status, created_at, expires_at, eta_minutes, bid_message,
        maids ( id, name, phone, avg_rating, total_reviews, area_label, skill_level, jobs_completed )
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

    // ── Create a booking record so it appears in BookingsListScreen ───────
    const sessionId = req.headers['x-session-id'] || null;
    try {
      // Fetch the full request to get details
      const { data: qsReq } = await supabase
        .from('quick_service_requests')
        .select('*')
        .eq('id', req.params.id)
        .single();

      // Fetch the bid to get offered_price and maid_id
      const { data: bidData } = await supabase
        .from('bids')
        .select('offered_price, maid_id, eta_minutes')
        .eq('id', bid_id)
        .single();

      if (qsReq && bidData) {
        const now = new Date();
        await supabase.from('bookings').insert({
          session_id:      sessionId || qsReq.session_id,
          maid_id:         bidData.maid_id,
          service_types:   qsReq.service_types || [],
          complexity:      qsReq.complexity || 'simple',
          tasks:           qsReq.tasks || [],
          scheduled_date:  now.toISOString().split('T')[0],
          scheduled_start: now.toTimeString().slice(0, 5),
          scheduled_end:   new Date(now.getTime() + 2 * 60 * 60 * 1000).toTimeString().slice(0, 5),
          total_price:     bidData.offered_price,
          agreed_price:    bidData.offered_price,
          status:          'confirmed',
          source:          'quick_service',
          qs_request_id:   req.params.id,
        });
      }
    } catch (bookingErr) {
      console.error('[QS] Booking record creation failed (non-fatal):', bookingErr.message);
    }

    // Log a simulated notification trace
    supabase.from('agent_traces').insert({
      session_id:     sessionId,
      session_type:   'quick_service',
      agent_name:     'NotificationAgent',
      input_summary:  `Bid selected: ${bid_id}`,
      output_summary: `SMS simulated: "HomeMaid: Aap ki request accept ho gayi!"`,
      full_input:     { bid_id, request_id: req.params.id },
      full_output:    { channel: 'sms_simulated', delivered: true, maid_id: data.maid_id, price: data.price },
      duration_ms:    0,
    }).then(() => {}).catch(() => {});

    return res.json(data);
  } catch (err) {
    console.error('[POST /quick-service/:id/select-bid]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * PATCH /api/quick-service/:id/status
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
 */
router.post('/:id/cancel', async (req, res) => {
  return router.handle(
    Object.assign(req, { method: 'PATCH', url: `/${req.params.id}/status`, body: { status: 'cancelled' } }),
    res,
  );
});

/**
 * POST /api/quick-service/:id/timeout
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
      .eq('status', 'pending_bids');

    return res.json({ ok: true });
  } catch (err) {
    console.error('[POST /quick-service/:id/timeout]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
