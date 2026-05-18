require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { resetCache, refreshCache } = require('./lib/marketCache');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/maids',          require('./routes/maids'));
app.use('/api/quick-service',  require('./routes/quickService'));
app.use('/api/pricing',        require('./routes/pricing'));
app.use('/api/matching',       require('./routes/matching'));
app.use('/api/bookings',       require('./routes/bookings'));
app.use('/api/voice',          require('./routes/voice'));
app.use('/api/reviews',        require('./routes/reviews'));
app.use('/api/disputes',       require('./routes/disputes'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/traces',         require('./routes/traces'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), version: 'v2-with-caps' });
});

// ─── Admin: force reset market cache ──────────────────────────────────────────
app.post('/api/admin/reset-cache', async (req, res) => {
  resetCache();
  await refreshCache();
  res.json({ message: 'Market cache reset and refreshed from DB.' });
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[SERVER_ERROR]', err.message);
  res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`HomeMaid API running on port ${PORT}`);
  // Force-refresh market cache from DB on startup
  resetCache();
  await refreshCache();
  console.log('[STARTUP] Market cache refreshed from DB');
});

module.exports = app; // required for Vercel serverless export
