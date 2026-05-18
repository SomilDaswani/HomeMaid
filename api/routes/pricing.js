const express = require('express');
const router = express.Router();
const { getMedian } = require('../lib/marketCache');
const supabase = require('../lib/supabase');

/**
 * POST /api/pricing/calculate
 * Calculates a price with all 6 multipliers and returns full breakdown.
 *
 * Body: {
 *   service_types: string[],
 *   complexity: { rooms?, tasks?, duration_hours?, level? },
 *   scheduled_date?: "YYYY-MM-DD",
 *   scheduled_start?: "HH:MM",
 *   lat?: number, lng?: number
 * }
 */
router.post('/calculate', async (req, res) => {
  try {
    const {
      service_types = [],
      complexity = {},
      scheduled_date,
      scheduled_start,
      lat,
      lng,
    } = req.body;

    if (!service_types.length) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'service_types is required' });
    }

    // ── 1. Base rate from market median ───────────────────────────────────────
    let baseHourlyRate = 0;
    for (const svc of service_types) {
      baseHourlyRate += await getMedian(svc);
    }

    // ── 2. Duration ──────────────────────────────────────────────────────────
    let durationHours = complexity.duration_hours || 2;
    if (service_types.includes('cleaning') && complexity.rooms) {
      durationHours = Math.max(durationHours, complexity.rooms * 0.75);
    }

    const subtotal = Math.round(baseHourlyRate * durationHours);

    // ── 3. Tasks extra ───────────────────────────────────────────────────────
    const tasksExtra = (complexity.tasks?.length || 0) * 300;

    // ── 4. Complexity multiplier ─────────────────────────────────────────────
    const level = complexity.level || 'simple';
    const complexityMap = { simple: 1.0, standard: 1.15, heavy: 1.35 };
    const complexityMul = complexityMap[level] || 1.0;

    // ── 5. Time-of-day multiplier ────────────────────────────────────────────
    let timeOfDayMul = 1.0;
    let timeLabel = 'normal';
    if (scheduled_start) {
      const hour = parseInt(scheduled_start.split(':')[0], 10);
      if (hour >= 6 && hour < 8)       { timeOfDayMul = 1.10; timeLabel = 'morning_rush'; }
      else if (hour >= 8 && hour < 17) { timeOfDayMul = 1.00; timeLabel = 'normal'; }
      else if (hour >= 17 && hour < 20){ timeOfDayMul = 1.10; timeLabel = 'evening'; }
      else if (hour >= 20)             { timeOfDayMul = 1.25; timeLabel = 'late_night'; }
    }

    // ── 6. Weekend / holiday multiplier ──────────────────────────────────────
    let weekendMul = 1.0;
    let dayLabel = 'weekday';
    if (scheduled_date) {
      const dayOfWeek = new Date(scheduled_date).getDay(); // 0=Sun, 6=Sat
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendMul = 1.15;
        dayLabel = dayOfWeek === 0 ? 'sunday' : 'saturday';
      }
    }

    // ── 7. Demand multiplier (active QS requests in same area, last 30 min) ─
    let demandMul = 1.0;
    let activeRequests = 0;
    if (lat && lng) {
      try {
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('quick_service_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending_bids')
          .gte('created_at', thirtyMinAgo);
        activeRequests = count || 0;
        if (activeRequests >= 10)     demandMul = 1.20;
        else if (activeRequests >= 5) demandMul = 1.10;
        else if (activeRequests >= 2) demandMul = 1.05;
      } catch {
        // Silently default to 1.0
      }
    }

    // ── 8. Experience premium (neutral for general estimate) ─────────────────
    const experienceMul = 1.0;

    // ── 9. Distance surcharge (no specific maid yet) ─────────────────────────
    const distanceSurcharge = 0;

    // ── 10. Final calculation ────────────────────────────────────────────────
    // formula: (subtotal + tasksExtra) × complexity × time × weekend × demand × experience + distance
    const base = subtotal + tasksExtra;
    const recommendedPrice = Math.round(
      base * complexityMul * timeOfDayMul * weekendMul * demandMul * experienceMul + distanceSurcharge
    );

    // Real min/max from multiplier extremes (experience varies 0.95–1.10)
    const priceMin = Math.round((base * complexityMul * timeOfDayMul * weekendMul * demandMul * 0.95) / 50) * 50;
    const priceMax = Math.round((base * complexityMul * timeOfDayMul * weekendMul * demandMul * 1.10 + 200) / 50) * 50;

    return res.json({
      recommended_price: recommendedPrice,
      price_min: priceMin,
      price_max: priceMax,
      breakdown: {
        market_base_rate:       baseHourlyRate,
        estimated_hours:        parseFloat(durationHours.toFixed(1)),
        subtotal,
        tasks_extra:            tasksExtra,
        complexity_multiplier:  complexityMul,
        complexity_level:       level,
        time_of_day_multiplier: timeOfDayMul,
        time_label:             timeLabel,
        weekend_multiplier:     weekendMul,
        day_label:              dayLabel,
        demand_multiplier:      demandMul,
        active_requests_nearby: activeRequests,
        experience_premium:     experienceMul,
        distance_surcharge:     distanceSurcharge,
      },
    });
  } catch (err) {
    console.error('[POST /pricing/calculate]', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
