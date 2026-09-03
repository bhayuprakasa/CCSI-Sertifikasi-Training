const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');
const { getEmailLog, sendApprovalEmail, invalidateEmailSettingsCache } = require('../utils/mailer');

router.get('/', (req, res) => {
  try {
    const log = getEmailLog();
    res.json(Array.isArray(log) ? log : []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET Email HRD Notifikasi ─────────────────────────────────────────────────
router.get('/approver-hrd', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, email, set_at
      FROM cfg_approver_hrd
      ORDER BY id DESC LIMIT 1
    `);
    res.json(rows[0] || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST Set Email HRD Notifikasi ────────────────────────────────────────────
router.post('/approver-hrd', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'email wajib diisi' });
  }
  try {
    await pool.query('DELETE FROM cfg_approver_hrd');
    // Tabel hanya punya kolom: id, email, set_at (employee_id & full_name sudah di-drop via auto-migrate)
    await pool.query(
      'INSERT INTO cfg_approver_hrd (email) VALUES (?)',
      [email]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Retry kirim email approval untuk permohonan yang gagal
router.post('/retry', async (req, res) => {
  const { request_id, approver_email, approver_name, approver_position } = req.body;
  if (!request_id || !approver_email) {
    return res.status(400).json({ error: 'request_id dan approver_email wajib diisi' });
  }

  const [rows] = await pool.query('SELECT * FROM trx_training_request WHERE request_id = ?', [request_id]);
  if (!rows.length) return res.status(404).json({ error: 'Permohonan tidak ditemukan di database' });

  const [parts] = await pool.query(
    'SELECT participant_name FROM trx_training_request_participant WHERE request_id = ? ORDER BY participant_id',
    [request_id]
  );

  const r = rows[0];

  // Buat token baru jika sudah di-null (setelah approve/reject) atau memang belum ada
  let token = r.approval_token;
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    await pool.query('UPDATE trx_training_request SET approval_token = ? WHERE request_id = ?', [token, request_id]);
  }

  await sendApprovalEmail({
    request: { ...r, cost_total: r.cost_total || 0, score_grand_total: r.score_grand_total || 0, request_id: r.request_id },
    token,
    participants: parts.map(p => p.participant_name),
    approver: {
      name: approver_name || '',
      email: approver_email,
      position: approver_position || '',
    },
  });

  res.json({ ok: true });
});

// ─── GET Email Settings (kedua layer) ────────────────────────────────────────
router.get('/email-settings', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM cfg_email_settings');
    const result = { dept: null, hrd: null };
    rows.forEach(r => { result[r.layer] = r; });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST Save Email Settings (satu layer per request) ───────────────────────
router.post('/email-settings', async (req, res) => {
  const { layer, sender_name, reply_to, cc_emails, subject_template, updated_by } = req.body;
  if (!['dept', 'hrd'].includes(layer)) {
    return res.status(400).json({ error: 'layer harus "dept" atau "hrd"' });
  }
  try {
    await pool.query(
      `INSERT INTO cfg_email_settings (layer, sender_name, reply_to, cc_emails, subject_template, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         sender_name      = VALUES(sender_name),
         reply_to         = VALUES(reply_to),
         cc_emails        = VALUES(cc_emails),
         subject_template = VALUES(subject_template),
         updated_by       = VALUES(updated_by)`,
      [layer, sender_name || null, reply_to || null, cc_emails || null, subject_template || null, updated_by || null]
    );
    invalidateEmailSettingsCache();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
