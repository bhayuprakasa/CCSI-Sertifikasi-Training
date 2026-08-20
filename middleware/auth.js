const crypto = require('crypto');

const API_KEY = process.env.API_KEY;

// httpOnly cookie name used for browser session auth
const SESSION_COOKIE = 'ccsi_sess';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Generates a daily-rotating HMAC token signed with API_KEY.
// Browser never sees this key — the token is set as httpOnly cookie by the server.
function sessionToken(dayOffset = 0) {
  const key = process.env.API_KEY || 'dev';
  const day = Math.floor(Date.now() / ONE_DAY_MS) + dayOffset;
  return crypto.createHmac('sha256', key).update(String(day)).digest('hex');
}

function isValidSession(token) {
  if (!token) return false;
  // Accept today's and yesterday's token to handle midnight rollovers
  const candidates = [sessionToken(0), sessionToken(-1)];
  try {
    return candidates.some(c =>
      token.length === c.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(c))
    );
  } catch { return false; }
}

// Parse a single cookie by name from the Cookie header (no extra dependency)
function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

// Approval email links must stay public — they are clicked inside email clients.
// These patterns match req.path as seen by the /api sub-router (no /api prefix).
const PUBLIC_PATH_PATTERNS = [
  /^\/training-requests\/approve\//,
  /^\/training-requests\/reject\//,
  /^\/training-requests\/approve-hrd\//,
  /^\/training-requests\/reject-hrd\//,
];

function requireApiKey(req, res, next) {
  if (PUBLIC_PATH_PATTERNS.some(p => p.test(req.path))) {
    req.changedBy = 'system';
    return next();
  }

  // GET /employees?direktur=1 — read-only untuk dropdown approver HRD, non-sensitif
  if (req.method === 'GET' && req.path === '/employees' && req.query.direktur === '1') {
    req.changedBy = 'system';
    return next();
  }

  if (!API_KEY) {
    // Dev mode: no key configured — allow but warn once
    if (!requireApiKey._warned) {
      console.warn('[Auth] API_KEY not set in .env — all requests allowed (dev mode only)');
      requireApiKey._warned = true;
    }
    req.changedBy = sanitizeChangedBy(req.get('x-changed-by'));
    return next();
  }

  // Path 1: Browser session cookie (httpOnly, set saat halaman dimuat)
  // Browser tidak pernah melihat atau mengirim API_KEY secara eksplisit.
  if (isValidSession(getCookie(req, SESSION_COOKIE))) {
    req.changedBy = sanitizeChangedBy(req.get('x-changed-by'));
    return next();
  }

  // Path 2: Machine-to-machine (curl, webhook, script) — X-API-Key header
  const provided = req.get('x-api-key');
  if (provided && provided === API_KEY) {
    req.changedBy = sanitizeChangedBy(req.get('x-changed-by'));
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

function sanitizeChangedBy(value) {
  if (!value) return 'unknown';
  return String(value).replace(/[\x00-\x1f]/g, '').trim().slice(0, 100) || 'unknown';
}

module.exports = { requireApiKey, sessionToken, SESSION_COOKIE, ONE_DAY_MS };
