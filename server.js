const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { requireApiKey } = require('./middleware/auth');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Build CORS allowlist from APP_URL + optional CORS_ORIGINS env var
const ALLOWED_ORIGINS = [
  process.env.APP_URL,
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : []),
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin requests (no Origin header) and whitelisted origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Changed-By'],
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API key auth — applied before all /api routes
app.use('/api', requireApiKey);

app.use('/api/employees', require('./routes/employees'));
app.use('/api/competencies', require('./routes/competencies'));
app.use('/api/programs', require('./routes/programs'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/certifications', require('./routes/certifications'));
app.use('/api/training-needs', require('./routes/training-needs'));
app.use('/api/training-requests', require('./routes/training-requests'));
app.use('/api/training-attendance', require('./routes/training-attendance'));
app.use('/api/audit-log', require('./routes/audit-log'));
app.use('/api/approval-workflow', require('./routes/approval-workflow'));
app.use('/api/email-log', require('./routes/email-log'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check — cek koneksi MySQL tanpa auth
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected', detail: e.message });
  }
});

// Global error handler — catches async throws from route handlers
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message);
  if (err.message?.startsWith('Origin') && err.message.includes('CORS')) {
    return res.status(403).json({ error: 'CORS: origin not allowed' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  const nets = require('os').networkInterfaces();
  const ips = Object.values(nets).flat().filter(n => n.family === 'IPv4' && !n.internal).map(n => n.address);
  console.log(`CCSI Training API running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  Network: http://${ip}:${PORT}`));
});
