const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { requireApiKey, sessionToken, SESSION_COOKIE, ONE_DAY_MS } = require('./middleware/auth');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

// Build CORS allowlist from APP_URL + optional CORS_ORIGINS env var.
// localhost variants are always included so local/dev access works without .env.
const ALLOWED_ORIGINS = [
  process.env.APP_URL,
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : []),
  `http://localhost:${process.env.PORT || 3000}`,
  `http://127.0.0.1:${process.env.PORT || 3000}`,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Changed-By'],
  credentials: true,
}));

// ── GitHub Webhook — raw body required for HMAC verification ─────────────────
// Registered BEFORE express.json() so the body is not consumed first.
app.post('/webhook/github', express.raw({ type: 'application/json' }), (req, res) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: 'GITHUB_WEBHOOK_SECRET not configured' });

  const sig = req.headers['x-hub-signature-256'];
  if (!sig) return res.status(401).json({ error: 'Missing signature' });

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.headers['x-github-event'];
  const payload = JSON.parse(req.body.toString());

  if (event !== 'push' || payload.ref !== 'refs/heads/main') {
    return res.json({ ok: true, action: 'ignored' });
  }

  res.json({ ok: true, message: 'Deploy dimulai, cek log server...' });

  exec('git pull origin main', { cwd: __dirname }, (err, stdout) => {
    if (err) { console.error('[Webhook] git pull error:', err.message); return; }
    console.log('[Webhook] git pull:', stdout.trim());
    exec('npm install --omit=dev', { cwd: __dirname }, (err2) => {
      if (err2) { console.error('[Webhook] npm install error:', err2.message); return; }
      console.log('[Webhook] npm install selesai. Restart via PM2...');
      setTimeout(() => process.exit(0), 500);
    });
  });
});

app.use(express.json());

// ── HTML serving dengan session cookie ───────────────────────────────────────
// Browser membuka halaman → server set httpOnly cookie berisi signed session token.
// API_KEY tidak pernah dikirim atau terekspos ke browser sama sekali.
// Hanya file .html yang diintersep; asset lain (JS/CSS/gambar) lewat express.static.
const isSecure = process.env.APP_URL?.startsWith('https://') ?? false;

app.use((req, res, next) => {
  const file = req.path === '/' ? 'index.html' : path.basename(req.path);
  if (!file.endsWith('.html')) return next();

  const filePath = path.join(publicDir, file);
  if (!fs.existsSync(filePath)) return next();

  res.cookie(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecure,
    maxAge: 2 * ONE_DAY_MS,
  });

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(filePath);
});

app.use(express.static(publicDir, { index: false }));

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

const autoMigrate = require('./db/auto-migrate');

app.listen(PORT, '0.0.0.0', async () => {
  const nets = require('os').networkInterfaces();
  const ips = Object.values(nets).flat().filter(n => n.family === 'IPv4' && !n.internal).map(n => n.address);
  console.log(`CCSI Training API running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  Network: http://${ip}:${PORT}`));
  await autoMigrate();
});
