const supabase = require('./supabase');
const { callGemini } = require('./gemini');

// ── Global mean cache for Bayesian rating ──────────────────────────────────
let globalMeanRating = 3.5;
let globalMeanRefreshed = false;

async function refreshGlobalMean() {
  try {
    const { data } = await supabase
      .from('maids')
      .select('avg_rating')
      .eq('status', 'active')
      .gt('total_reviews', 0);

    if (data?.length) {
      const sum = data.reduce((acc, m) => acc + parseFloat(m.avg_rating || 0), 0);
      globalMeanRating = sum / data.length;
    }
    globalMeanRefreshed = true;
  } catch {
    // Keep default
  }
}

/**
 * Phase 1: Hard-filter candidates from Supabase using PostGIS + column filters.
 * Returns raw maid rows (up to 20 candidates for Phase 2 scoring).
 */
async function getFilteredCandidates({ serviceTypes, lat, lng, slotStart, slotEnd }) {
  const radiusMeters = 8000;

  // Parse ISO slot into separate DATE and TIME for the RPC
  const startDt = new Date(slotStart);
  const endDt   = new Date(slotEnd);
  const pDate  = startDt.toISOString().split('T')[0];           // "2026-05-19"
  const pStart = startDt.toTimeString().slice(0, 5);            // "10:00"
  const pEnd   = endDt.toTimeString().slice(0, 5);              // "12:00"

  const { data, error } = await supabase.rpc('get_available_maids', {
    p_lat:           lat,
    p_lng:           lng,
    p_radius:        radiusMeters,
    p_service_types: serviceTypes,
    p_date:          pDate,
    p_start:         pStart,
    p_end:           pEnd,
  });

  if (error) {
    console.error('[MATCHING] RPC failed, using fallback:', error.message);
    const { data: fallback } = await supabase
      .from('maids')
      .select('*')
      .eq('is_available', true)
      .eq('status', 'active')
      .is('active_qs_request_id', null)
      .contains('service_types', serviceTypes)
      .limit(20);
    return fallback || [];
  }

  return data || [];
}

/**
 * Phase 2: Score each candidate using 7 factors.
 * Returns candidates sorted by composite score descending.
 */
function scoreCandidates(candidates, { estimatedPrice, lat, lng }) {
  const C = 10; // Bayesian confidence constant
  const m = globalMeanRating;

  return candidates
    .filter(maid => {
      // Red flag override
      if ((maid.cancellation_count || 0) >= 3) return false;
      if ((maid.no_show_count || 0) >= 3) return false;
      return true;
    })
    .map(maid => {
      const R = parseFloat(maid.avg_rating) || 0;
      const v = maid.total_reviews || 0;

      // F1 — Bayesian Rating (0–1): (R×v + C×m) / (v+C) / 5
      const F1 = (R * v + C * m) / (v + C) / 5.0;

      // F2 — Distance (0–1): closer = higher
      let distKm;
      if (typeof maid.distance_km === 'number') {
        distKm = maid.distance_km;
      } else {
        distKm = 4; // neutral default for fallback (no PostGIS data)
      }
      const F2 = Math.max(0, 1 - distKm / 8);

      // F3 — Reliability (0–1): on-time ratio with cancellation penalty
      const jobsDone   = maid.jobs_completed || 0;
      const onTime     = maid.jobs_on_time || 0;
      const cancels    = maid.cancellation_count || 0;
      const noShows    = maid.no_show_count || 0;
      let F3;
      if (jobsDone > 0) {
        const onTimeRatio = onTime / jobsDone;
        const penalty = Math.max(0, 1 - (cancels + noShows) * 0.05);
        F3 = onTimeRatio * penalty;
      } else {
        F3 = 0.50;
      }

      // F4 — Skill match (0–1)
      const skillMap = { basic: 0.4, intermediate: 0.7, expert: 1.0 };
      const F4 = skillMap[maid.skill_level] || 0.4;

      // F5 — Review volume (0–1): log scale, cap at 100
      const F5 = Math.min(Math.log1p(v) / Math.log1p(100), 1);

      // F6 — Schedule load (0–1): fewer jobs today = higher score
      const jobsToday = typeof maid.jobs_on_date === 'number' ? Number(maid.jobs_on_date) : 0;
      const F6 = Math.max(0, 1 - jobsToday / 4);

      // F7 — Price fit (0–1)
      const mid = ((maid.rate_min || maid.base_rate) + (maid.rate_max || maid.base_rate)) / 2;
      const ratio = estimatedPrice > 0 ? mid / estimatedPrice : 1;
      const F7 = Math.max(0, 1 - Math.abs(1 - ratio));

      // Weights: 0.25+0.20+0.15+0.10+0.05+0.15+0.10 = 1.00
      const composite =
        F1 * 0.25 +
        F2 * 0.20 +
        F3 * 0.15 +
        F4 * 0.10 +
        F5 * 0.05 +
        F6 * 0.15 +
        F7 * 0.10;

      // New maid boost
      const boost = jobsDone < 5 ? 0.05 : 0;
      const score = Math.min(composite + boost, 1);

      return {
        ...maid,
        _score: score,
        _factors: {
          bayesian_rating: parseFloat(F1.toFixed(3)),
          distance:        parseFloat(F2.toFixed(3)),
          reliability:     parseFloat(F3.toFixed(3)),
          skill_match:     parseFloat(F4.toFixed(3)),
          review_volume:   parseFloat(F5.toFixed(3)),
          schedule_load:   parseFloat(F6.toFixed(3)),
          price_fit:       parseFloat(F7.toFixed(3)),
        },
        _distance_km: parseFloat((distKm || 0).toFixed(2)),
      };
    })
    .filter(m => m._score >= 0.30) // Minimum score threshold
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);
}

/**
 * Phase 3: Generate Roman Urdu explanation for the top match via Gemini.
 */
async function explainTopMatch(topMaid, totalCandidates, referenceId, sessionId) {
  if (!topMaid) return null;
  const f = topMaid._factors;

  const prompt = `You are a helpful Pakistani home service assistant.
Explain in 1-2 short Roman Urdu sentences why this maid was chosen as the best match.
Reference the specific strengths from the scores below. Keep it friendly.

Maid: ${topMaid.name}
Score: ${topMaid._score.toFixed(2)} (rank #1 of ${totalCandidates} candidates)
Factor breakdown:
  Rating (Bayesian): ${f.bayesian_rating} — avg ${topMaid.avg_rating || 0}/5, ${topMaid.total_reviews || 0} reviews
  Distance: ${f.distance} — ${topMaid._distance_km} km door
  Reliability: ${f.reliability} — ${topMaid.jobs_on_time || 0}/${topMaid.jobs_completed || 0} on time, ${topMaid.cancellation_count || 0} cancellations
  Skill: ${f.skill_match} — ${topMaid.skill_level}
  Review volume: ${f.review_volume}
  Schedule load: ${f.schedule_load}
  Price fit: ${f.price_fit}
Area: ${topMaid.area_label}

Return ONLY the explanation text, no JSON.`;

  const result = await callGemini('MatchingAgent', prompt, 'booking', referenceId, false, sessionId);
  return typeof result === 'string' ? result : null;
}

/**
 * Main entry point: rank maids for a booking request.
 */
async function rankMaids({ serviceTypes, lat, lng, slotStart, slotEnd, estimatedPrice = 0, referenceId = null, sessionId = null }) {
  if (!globalMeanRefreshed) await refreshGlobalMean();

  const candidates = await getFilteredCandidates({ serviceTypes, lat, lng, slotStart, slotEnd });
  if (!candidates.length) {
    return { maids: [], explanation: null, total_candidates: 0 };
  }

  const ranked = scoreCandidates(candidates, { estimatedPrice, lat, lng });
  if (!ranked.length) {
    return { maids: [], explanation: null, total_candidates: candidates.length, message: 'ALL_BELOW_THRESHOLD' };
  }

  const explanation = await explainTopMatch(ranked[0], candidates.length, referenceId, sessionId).catch(() => null);

  return {
    maids: ranked.map(m => ({
      id:             m.id,
      name:           m.name,
      avg_rating:     m.avg_rating,
      total_reviews:  m.total_reviews,
      area_label:     m.area_label,
      skill_level:    m.skill_level,
      rate_min:       m.rate_min,
      rate_max:       m.rate_max,
      base_rate:      m.base_rate,
      jobs_completed: m.jobs_completed,
      distance_km:    m._distance_km,
      score:          parseFloat(m._score.toFixed(3)),
      factors:        m._factors,
    })),
    explanation,
    total_candidates: candidates.length,
  };
}

module.exports = { rankMaids };
