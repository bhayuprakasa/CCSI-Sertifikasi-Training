const API_KEY = process.env.API_KEY;

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

  if (!API_KEY) {
    // Dev mode: no key configured — allow but warn once
    if (!requireApiKey._warned) {
      console.warn('[Auth] API_KEY not set in .env — all requests allowed (dev mode only)');
      requireApiKey._warned = true;
    }
    req.changedBy = sanitizeChangedBy(req.get('x-changed-by'));
    return next();
  }

  const provided = req.get('x-api-key');
  if (!provided || provided !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.changedBy = sanitizeChangedBy(req.get('x-changed-by'));
  next();
}

function sanitizeChangedBy(value) {
  if (!value) return 'unknown';
  // Strip control chars and limit length to match DB column VARCHAR(100)
  return String(value).replace(/[\x00-\x1f]/g, '').trim().slice(0, 100) || 'unknown';
}

module.exports = { requireApiKey };
