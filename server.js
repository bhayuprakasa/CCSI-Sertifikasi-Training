const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { requireApiKey } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — izinkan semua origin; keamanan dijamin oleh X-API-Key middleware
app.use(cors({
  origin: true,
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
    const pool = require('./db');
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected', detail: e.message });
  }
});

// ── Auto-pull dari GitHub setiap 5 menit ────────────────────────────────────
const { exec } = require('child_process');
const AUTO_PULL_INTERVAL = 5 * 60 * 1000; // 5 menit

function autoPull() {
  const cwd = __dirname;
  exec('git fetch origin main 2>&1 && git rev-parse HEAD && git rev-parse origin/main', { cwd }, (err, stdout) => {
    if (err) { console.warn('[AutoPull] fetch error:', err.message); return; }

    const lines = stdout.trim().split('\n');
    const local  = lines[lines.length - 2];
    const remote = lines[lines.length - 1];

    if (local === remote) return; // tidak ada perubahan baru

    console.log('[AutoPull] Commit baru terdeteksi, menjalankan git pull...');
    // Stash perubahan lokal agar pull tidak gagal karena konflik file
    exec('git stash', { cwd }, () => {
    exec('git pull origin main', { cwd }, (err2, out2) => {
      if (err2) { console.error('[AutoPull] git pull error:', err2.message); return; }
      console.log('[AutoPull] git pull:', out2.trim());

      exec('npm install --omit=dev', { cwd }, () => {
        console.log('[AutoPull] npm install selesai. Restart server...');
        setTimeout(() => process.exit(0), 500);
      });
    });
    }); // end git stash
  });
}

setInterval(autoPull, AUTO_PULL_INTERVAL);

// Endpoint manual trigger deploy (opsional, butuh secret)
app.post('/deploy', (req, res) => {
  const secret = req.headers['x-deploy-secret'];
  if (!secret || secret !== process.env.DEPLOY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ ok: true, message: 'Deploy dimulai, cek log server...' });
  setTimeout(autoPull, 500);
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
