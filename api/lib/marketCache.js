// In-memory market rate cache — avoids hitting the DB on every pricing call.
// Refreshes every 6 hours. Populated on first request if empty.

const supabase = require('./supabase');

// Cache structure: { service_type: median_rate_pkr }
let cache = {};
let lastRefresh = 0;
let initialized = false;
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Returns the median base_rate for the given service_type from the maids table.
 * Falls back to a hardcoded default if DB query fails.
 */
const DEFAULTS = {
  cleaning:          450,
  laundry:           350,
  cooking:           550,
  washing_dishes:    250,
  cleaning_washroom: 300,
  ironing_clothes:   300,
};

async function refreshCache() {
  try {
    const { data, error } = await supabase
      .from('maids')
      .select('service_types, base_rate')
      .eq('status', 'active');

    if (error) throw error;

    const buckets = {};
    for (const maid of data || []) {
      for (const svc of maid.service_types || []) {
        if (!buckets[svc]) buckets[svc] = [];
        buckets[svc].push(maid.base_rate);
      }
    }

    const newCache = {};
    for (const [svc, rates] of Object.entries(buckets)) {
      const sorted = [...rates].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      newCache[svc] = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }

    cache = newCache;
    lastRefresh = Date.now();
  } catch (err) {
    console.error('[MARKET_CACHE] refresh failed:', err.message);
    // Keep stale cache or defaults
  }
}

async function getMedian(serviceType) {
  if (!initialized || Date.now() - lastRefresh > REFRESH_INTERVAL_MS) {
    await refreshCache();
    initialized = true;
  }
  return cache[serviceType] ?? DEFAULTS[serviceType] ?? 500;
}

async function getAllMedians() {
  if (!initialized || Date.now() - lastRefresh > REFRESH_INTERVAL_MS) {
    await refreshCache();
    initialized = true;
  }
  return { ...DEFAULTS, ...cache };
}

function resetCache() {
  cache = {};
  lastRefresh = 0;
  initialized = false;
  console.log('[MARKET_CACHE] Cache forcefully reset');
}

module.exports = { getMedian, getAllMedians, refreshCache, resetCache };
