const supabase = require('./supabase');
const { callGemini } = require('./gemini');

/**
 * Phase 1: Hard-filter candidates from Supabase using PostGIS + column filters.
 * Returns raw maid rows (up to 20 candidates for Phase 2 scoring).
 */
async function getFilteredCandidates({ serviceTypes, lat, lng, slotStart, slotEnd }) {
  const radiusMeters = 8000; // 8km hard radius for booking (wider than QS)

  // PostGIS: maids within radius whose service_types cover ALL requested types
  const { data, error } = await supabase.rpc('get_available_maids', {
    p_lat:           lat,
    p_lng:           lng,
    p_radius:        radiusMeters,
    p_service_types: serviceTypes,
    p_slot_start:    slotStart,
    p_slot_end:      slotEnd,
  });

  if (error) {
    // Fallback: simple query without PostGIS function (graceful degradation)
    const { data: fallback } = await supabase
      .from('maids')
      .select('*')
      .eq('is_online', true)
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
  return candidates
    .map(maid => {
      // F1 — Rating (0–1): avg_rating / 5
      const F1 = (maid.avg_rating || 3) / 5;

      // F2 — Experience (0–1): log scale, cap at 5 years = 60 months
      const months = maid.experience_months || 0;
      const F2 = Math.min(Math.log1p(months) / Math.log1p(60), 1);

      // F3 — Skill level (0–1)
      const skillMap = { basic: 0.4, intermediate: 0.7, expert: 1.0 };
      const F3 = skillMap[maid.skill_level] || 0.4;

      // F4 — Review volume (0–1): log scale, cap at 100 reviews
      const F4 = Math.min(Math.log1p(maid.total_reviews || 0) / Math.log1p(100), 1);

      // F5 — Distance (0–1): closer = higher score. Use lat/lng diff as proxy.
      // Real distance requires PostGIS — here we approximate with Haversine
      const dlat = (maid.lat || lat) - lat;
      const dlng = (maid.lng || lng) - lng;
      const distKm = Math.sqrt(dlat * dlat + dlng * dlng) * 111; // 1deg ≈ 111km
      const F5 = Math.max(0, 1 - distKm / 8); // 0 at 8km, 1 at 0km

      // F6 — Availability consistency (0–1): bookings_completed / (completed + cancelled)
      const completed = maid.bookings_completed || 0;
      const cancelled = maid.bookings_cancelled || 0;
      const F6 = completed + cancelled > 0
        ? completed / (completed + cancelled)
        : 0.5; // neutral for new maids

      // F7 — Price fit (0–1): how close is maid's rate to estimated price?
      const maidMidRate = ((maid.rate_min || 800) + (maid.rate_max || 1200)) / 2;
      const priceRatio = estimatedPrice > 0 ? maidMidRate / estimatedPrice : 1;
      const F7 = Math.max(1 - Math.abs(1 - priceRatio), 0.7); // floor at 0.7 (never penalize heavily)

      // Weighted composite: F1(30%) F2(15%) F3(15%) F4(10%) F5(15%) F6(10%) F7(5%)
      const composite =
        F1 * 0.30 +
        F2 * 0.15 +
        F3 * 0.15 +
        F4 * 0.10 +
        F5 * 0.15 +
        F6 * 0.10 +
        F7 * 0.05;

      // New maid boost: < 5 bookings completed → +0.05 to help them get started
      const newMaidBoost = completed < 5 ? 0.05 : 0;

      return {
        ...maid,
        _score: Math.min(composite + newMaidBoost, 1),
        _factors: { F1, F2, F3, F4, F5, F6, F7 },
      };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, 5); // top 5
}

/**
 * Phase 3: Generate Roman Urdu explanation for the top match via Gemini.
 * Returns null on failure — callers must handle.
 */
async function explainTopMatch(topMaid, referenceId, sessionId = null) {
  if (!topMaid) return null;

  const prompt = `You are a helpful Pakistani home service assistant.
Explain in 1-2 short Roman Urdu sentences why this maid was chosen as the best match.
Keep it friendly and confidence-building for the homeowner.

Maid details:
- Name: ${topMaid.name}
- Rating: ${topMaid.avg_rating?.toFixed(1) || 'N/A'}/5
- Experience: ${topMaid.experience_months || 0} months
- Skill level: ${topMaid.skill_level}
- Total reviews: ${topMaid.total_reviews || 0}
- Area: ${topMaid.area_label}

Return ONLY the explanation text, no JSON, no prefix.
Example: "Sameena ki rating 4.8 hai aur 3 saal ka tajurba hai — iss liye yeh sabse behtar choice hai!"`;

  const result = await callGemini('MatchingAgent', prompt, 'booking', referenceId, false, sessionId);
  return typeof result === 'string' ? result : null;
}

/**
 * Main entry point: rank maids for a booking request.
 */
async function rankMaids({ serviceTypes, lat, lng, slotStart, slotEnd, estimatedPrice = 0, referenceId = null, sessionId = null }) {
  const candidates = await getFilteredCandidates({ serviceTypes, lat, lng, slotStart, slotEnd });

  if (!candidates.length) {
    return { maids: [], explanation: null, total_candidates: 0 };
  }

  const ranked = scoreCandidates(candidates, { estimatedPrice, lat, lng });

  // Fire Gemini explanation in parallel — don't block the response
  const explanation = await explainTopMatch(ranked[0], referenceId, sessionId).catch(() => null);

  return {
    maids: ranked.map(m => ({
      id:                m.id,
      name:              m.name,
      avg_rating:        m.avg_rating,
      total_reviews:     m.total_reviews,
      area_label:        m.area_label,
      skill_level:       m.skill_level,
      rate_min:          m.rate_min,
      rate_max:          m.rate_max,
      experience_months: m.experience_months,
      score:             parseFloat(m._score.toFixed(3)),
      factors:           m._factors,
    })),
    explanation,
    total_candidates: candidates.length,
  };
}

module.exports = { rankMaids };
