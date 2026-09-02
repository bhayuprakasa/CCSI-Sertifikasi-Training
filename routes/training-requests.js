const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');
const { logAudit } = require('../middleware/auditLog');
const { sendApprovalEmail, sendHrdApprovalEmail, sendMultiApprovalEmail, isEmailConfigured } = require('../utils/mailer');

const VALID_TRAINING_TYPE = ['Internal', 'Eksternal'];

// Returns the best available base URL for building email links.
// Priority: APP_URL env → request host (if not localhost) → server network IP → localhost fallback.
function getAppUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const host = req.get('host') || '';
  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    return `${req.protocol}://${host}`;
  }
  // Request came from localhost — use the server's actual network IP instead
  const nets = require('os').networkInterfaces();
  const ip = Object.values(nets).flat().find(n => n.family === 'IPv4' && !n.internal);
  if (ip) {
    console.warn('[getAppUrl] APP_URL not set — falling back to detected network IP:', ip.address,
      '(set APP_URL in .env for a stable URL)');
    return `http://${ip.address}:${process.env.PORT || 3000}`;
  }
  return `http://localhost:${process.env.PORT || 3000}`;
}

function validScore(v) {
  if (v == null) return true;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 100;
}

router.get('/', async (req, res) => {
  try {
    const [requests] = await pool.query(
      'SELECT request_id, department, training_name, training_date_start, training_date_end, actual_date_start, actual_date_end, training_type, organizer, instruktur, kompetensi, training_reason, cost_training_fee, cost_akomodasi, cost_transport, cost_makan, cost_snack, cost_emergency, cost_total, eq_proyektor, eq_laptop, eq_kabel_hdmi, eq_pointer, eq_flipchart, eq_notebook, eq_ruangan, eq_colokan, coffee_break, score_peserta_atasan, score_peserta_hrd, score_materi_atasan, score_materi_hrd, score_grand_total, submitted_by, submitted_at, is_scheduled, approval_status, training_selesai, approver_name, approver_email, approver_position FROM trx_training_request ORDER BY request_id DESC'
    );
    const [participants] = await pool.query('SELECT participant_id, request_id, participant_name FROM trx_training_request_participant ORDER BY participant_id');
    const result = requests.map(r => ({
      ...r,
      participants: participants.filter(p => p.request_id === r.request_id).map(p => p.participant_name),
    }));
    res.json(result);
  } catch (err) {
    console.error('[training-requests GET /]', err.message);
    res.status(500).json({ error: 'Gagal mengambil data rekap training', detail: err.message });
  }
});

router.post('/', async (req, res) => {
  const item = req.body;
  if (!item.department || !item.training_name || !item.training_date_start || !item.training_type || !item.participants?.length) {
    return res.status(400).json({ error: 'Field wajib belum lengkap' });
  }
  if (!VALID_TRAINING_TYPE.includes(item.training_type)) {
    return res.status(400).json({ error: `training_type must be one of: ${VALID_TRAINING_TYPE.join(', ')}` });
  }
  const pa = item.scores?.peserta_atasan ?? null;
  const ph = item.scores?.peserta_hrd ?? null;
  const ma = item.scores?.materi_atasan ?? null;
  const mh = item.scores?.materi_hrd ?? null;
  if (!validScore(pa) || !validScore(ph) || !validScore(ma) || !validScore(mh)) {
    return res.status(400).json({ error: 'Scores must be integers between 0 and 100' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const costTotal = (item.cost_training_fee || 0) + (item.cost_akomodasi || 0) +
      (item.cost_transport || 0) + (item.cost_makan || 0) +
      (item.cost_snack || 0) + (item.cost_emergency || 0);

    const gt = (pa || 0) + (ph || 0) + (ma || 0) + (mh || 0) || null;

    const approvalToken = crypto.randomBytes(32).toString('hex');

    const [result] = await conn.query(
      `INSERT INTO trx_training_request (
        department, training_name, training_date_start, training_date_end,
        training_type, organizer, instruktur, kompetensi, training_reason,
        cost_training_fee, cost_akomodasi, cost_transport, cost_makan, cost_snack, cost_emergency, cost_total,
        eq_proyektor, eq_laptop, eq_kabel_hdmi, eq_pointer, eq_flipchart, eq_notebook, eq_ruangan, eq_colokan,
        coffee_break,
        score_peserta_atasan, score_peserta_hrd, score_materi_atasan, score_materi_hrd, score_grand_total,
        submitted_by, is_scheduled, approval_status, approval_token,
        approver_name, approver_email, approver_position
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        item.department, item.training_name,
        item.training_date_start, item.training_date_end || item.training_date_start,
        item.training_type, item.organizer || null, item.instruktur || null, item.kompetensi || null, item.training_reason || null,
        item.cost_training_fee || 0, item.cost_akomodasi || 0, item.cost_transport || 0,
        item.cost_makan || 0, item.cost_snack || 0, item.cost_emergency || 0, costTotal,
        item.eq_proyektor || 0, item.eq_laptop || 0, item.eq_kabel_hdmi || 0,
        item.eq_pointer || 0, item.eq_flipchart || 0, item.eq_notebook || 0,
        item.eq_ruangan || 0, item.eq_colokan || 0,
        item.coffee_break ? 1 : 0,
        pa, ph, ma, mh, gt,
        item.submitted_by || null,
        item.is_scheduled != null ? (item.is_scheduled ? 1 : 0) : 0,
        item.submitted_by_hr ? 'Submitted_HR' : 'Submitted',
        approvalToken,
        item.approver1_name || null, item.approver1_email || null, item.approver1_position || null,
      ]
    );

    const requestId = result.insertId;
    for (const name of item.participants) {
      if (name.trim()) {
        await conn.query('INSERT INTO trx_training_request_participant (request_id, participant_name) VALUES (?,?)', [requestId, name.trim()]);
      }
    }

    await logAudit({
      table_name: 'trx_training_request',
      record_id: requestId,
      operation: 'CREATE',
      new_data: { department: item.department, training_name: item.training_name, training_type: item.training_type, cost_total: costTotal, participant_count: item.participants.length },
      changed_by: req.changedBy,
      conn,
    });

    await conn.commit();

    res.status(201).json({ request_id: requestId, ...item, cost_total: costTotal, approval_status: item.submitted_by_hr ? 'Submitted_HR' : 'Submitted' });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

// ── Multi-Approval: kirim email ke beberapa approver sekaligus ───────────────
router.post('/send-multi-approval', async (req, res) => {
  const { request_ids } = req.body;
  if (!Array.isArray(request_ids) || !request_ids.length) {
    return res.status(400).json({ error: 'request_ids harus berupa array yang tidak kosong' });
  }

  if (!isEmailConfigured()) {
    return res.status(503).json({ error: 'Konfigurasi email belum tersedia — hubungi admin' });
  }

  // Ambil data semua request yang dipilih
  const placeholders = request_ids.map(() => '?').join(',');
  const [requests] = await pool.query(
    `SELECT r.request_id, r.department, r.training_name, r.training_date_start,
            r.training_type, r.cost_total, r.is_scheduled, r.approval_status,
            r.approval_token, r.approver_name, r.approver_email, r.approver_position,
            r.training_reason
     FROM trx_training_request r
     WHERE r.request_id IN (${placeholders})`,
    request_ids
  );

  if (!requests.length) {
    return res.status(404).json({ error: 'Tidak ada data ditemukan' });
  }

  // Ambil peserta untuk semua request
  const [allParticipants] = await pool.query(
    `SELECT request_id, participant_name FROM trx_training_request_participant WHERE request_id IN (${placeholders})`,
    request_ids
  );

  // Kelompokkan peserta per request
  const participantMap = {};
  for (const p of allParticipants) {
    if (!participantMap[p.request_id]) participantMap[p.request_id] = [];
    participantMap[p.request_id].push(p.participant_name);
  }

  // Jika approver_email kosong, coba lookup dari mst_employee berdasarkan approver_name
  for (const r of requests) {
    if (!r.approver_email && r.approver_name) {
      try {
        const [empRows] = await pool.query(
          'SELECT email FROM mst_employee WHERE full_name = ? AND email IS NOT NULL AND email != \'\' LIMIT 1',
          [r.approver_name]
        );
        if (empRows.length && empRows[0].email) {
          r.approver_email = empRows[0].email;
          // Simpan ke record agar tidak perlu lookup ulang di masa depan
          await pool.query(
            'UPDATE trx_training_request SET approver_email = ? WHERE request_id = ? AND (approver_email IS NULL OR approver_email = \'\')',
            [empRows[0].email, r.request_id]
          );
        }
      } catch { /* abaikan jika tabel tidak ada */ }
    }
  }

  // Kelompokkan request per approver email
  const approverGroups = {};
  const skipped = [];
  for (const r of requests) {
    if (!r.approver_email) {
      skipped.push({ request_id: r.request_id, training_name: r.training_name, reason: 'Email approver tidak ditemukan — tambahkan email di data karyawan' });
      continue;
    }
    if (r.approval_status !== 'Submitted') {
      skipped.push({ request_id: r.request_id, training_name: r.training_name, reason: `Status tidak valid untuk dikirim: ${r.approval_status}` });
      continue;
    }
    const key = r.approver_email;
    if (!approverGroups[key]) {
      approverGroups[key] = {
        approver: { name: r.approver_name, email: r.approver_email, position: r.approver_position },
        requests: [],
      };
    }
    approverGroups[key].requests.push({
      ...r,
      participants: participantMap[r.request_id] || [],
    });
  }

  const appUrl = getAppUrl(req);
  const results = [];

  for (const [email, group] of Object.entries(approverGroups)) {
    try {
      await sendMultiApprovalEmail({ approver: group.approver, requests: group.requests, appUrl });
      // Naikkan status ke PendingBODDept setelah email berhasil dikirim
      const sentIds = group.requests.map(r => r.request_id);
      const ph2 = sentIds.map(() => '?').join(',');
      await pool.query(
        `UPDATE trx_training_request SET approval_status = 'PendingBODDept' WHERE request_id IN (${ph2}) AND approval_status = 'Submitted'`,
        sentIds
      );
      results.push({ approver_email: email, count: group.requests.length, status: 'sent' });
    } catch (err) {
      results.push({ approver_email: email, count: group.requests.length, status: 'failed', error: err.message });
    }
  }

  res.json({ results, skipped });
});

// ── Layer 1: Direktur Departemen ─────────────────────────────────────────────

// Handle klik Setujui dari email (Direktur Dept)
router.get('/approve/:token', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM trx_training_request WHERE approval_token = ?',
    [req.params.token]
  );
  if (!rows.length) return res.status(404).send(approvalPage('not_found'));

  const req_ = rows[0];
  if (req_.approval_status !== 'PendingBODDept') {
    return res.send(approvalPage('already_done', req_.approval_status, req_));
  }

  const hrdToken = crypto.randomBytes(32).toString('hex');

  await pool.query(
    'UPDATE trx_training_request SET approval_status = ?, approval_token = NULL, approval_hrd_token = ? WHERE request_id = ?',
    ['PendingBODHR', hrdToken, req_.request_id]
  );

  // Ambil info Direktur HRD dari tabel config atau env
  let hrdApprover = null;
  try {
    const [hrdRows] = await pool.query(`
      SELECT c.id, c.employee_id, c.full_name, c.position, c.department, c.set_at,
             COALESCE(e.email, c.email) AS email
      FROM cfg_approver_hrd c
      LEFT JOIN mst_employee e ON e.employee_id = c.employee_id
      ORDER BY c.id DESC LIMIT 1
    `);
    if (hrdRows.length && hrdRows[0].email) hrdApprover = hrdRows[0];
  } catch { /* tabel belum ada */ }

  if (!hrdApprover && process.env.HRD_DIRECTOR_EMAIL) {
    hrdApprover = {
      full_name: process.env.HRD_DIRECTOR_NAME || 'Direktur HRD',
      email:     process.env.HRD_DIRECTOR_EMAIL,
      position:  'Direktur HRD',
    };
  }

  if (hrdApprover && isEmailConfigured()) {
    const [parts] = await pool.query(
      'SELECT participant_name FROM trx_training_request_participant WHERE request_id = ?',
      [req_.request_id]
    );
    const appUrl = getAppUrl(req);
    sendHrdApprovalEmail({
      request: req_,
      token:   hrdToken,
      participants: parts.map(p => p.participant_name),
      approver: {
        name:     hrdApprover.full_name,
        email:    hrdApprover.email,
        position: hrdApprover.position || 'Direktur HRD',
      },
      appUrl,
    }).catch(err => console.error('[Mailer] Gagal kirim email HRD:', err.message));
  }

  res.send(approvalPage('approved_l1', 'PendingBODHR', req_));
});

// Handle klik Tolak dari email (Direktur Dept)
router.get('/reject/:token', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM trx_training_request WHERE approval_token = ?',
    [req.params.token]
  );
  if (!rows.length) return res.status(404).send(approvalPage('not_found'));

  const req_ = rows[0];
  if (req_.approval_status !== 'PendingBODDept') {
    return res.send(approvalPage('already_done', req_.approval_status, req_));
  }

  await pool.query(
    'UPDATE trx_training_request SET approval_status = ?, approval_token = NULL WHERE request_id = ?',
    ['Rejected_BODDept', req_.request_id]
  );
  res.send(approvalPage('rejected_dept', 'Rejected_BODDept', req_));
});

// ── Layer 2: Direktur HRD ────────────────────────────────────────────────────

// Handle klik Setujui dari email (Direktur HRD)
router.get('/approve-hrd/:token', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM trx_training_request WHERE approval_hrd_token = ?',
    [req.params.token]
  );
  if (!rows.length) return res.status(404).send(approvalPage('not_found'));

  const req_ = rows[0];
  if (req_.approval_status !== 'PendingBODHR') {
    return res.send(approvalPage('already_done', req_.approval_status, req_));
  }

  await pool.query(
    'UPDATE trx_training_request SET approval_status = ?, approval_hrd_token = NULL WHERE request_id = ?',
    ['Approved', req_.request_id]
  );
  res.send(approvalPage('approved', 'Approved', req_));
});

// Handle klik Tolak dari email (Direktur HRD)
router.get('/reject-hrd/:token', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM trx_training_request WHERE approval_hrd_token = ?',
    [req.params.token]
  );
  if (!rows.length) return res.status(404).send(approvalPage('not_found'));

  const req_ = rows[0];
  if (req_.approval_status !== 'PendingBODHR') {
    return res.send(approvalPage('already_done', req_.approval_status, req_));
  }

  await pool.query(
    'UPDATE trx_training_request SET approval_status = ?, approval_hrd_token = NULL WHERE request_id = ?',
    ['Rejected_BODHR', req_.request_id]
  );
  res.send(approvalPage('rejected_hrd', 'Rejected_BODHR', req_));
});

// Approve by BOD HR (via web UI, no token needed)
router.patch('/:id/approve-hrd', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM trx_training_request WHERE request_id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Data tidak ditemukan' });
  const req_ = rows[0];
  if (req_.approval_status !== 'PendingBODHR') {
    return res.status(400).json({ error: `Status tidak valid: ${req_.approval_status}. Hanya PendingBODHR yang dapat disetujui di sini.` });
  }
  await pool.query(
    'UPDATE trx_training_request SET approval_status = ?, approval_hrd_token = NULL WHERE request_id = ?',
    ['Approved', req.params.id]
  );
  await logAudit({
    table_name: 'trx_training_request',
    record_id: req.params.id,
    operation: 'UPDATE',
    old_data: { approval_status: req_.approval_status },
    new_data: { approval_status: 'Approved' },
    changed_by: req.changedBy,
  });
  res.json({ updated: true, approval_status: 'Approved' });
});

// Reject by BOD HR (via web UI, no token needed)
router.patch('/:id/reject-hrd', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM trx_training_request WHERE request_id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Data tidak ditemukan' });
  const req_ = rows[0];
  if (req_.approval_status !== 'PendingBODHR') {
    return res.status(400).json({ error: `Status tidak valid: ${req_.approval_status}. Hanya PendingBODHR yang dapat ditolak di sini.` });
  }
  await pool.query(
    'UPDATE trx_training_request SET approval_status = ?, approval_hrd_token = NULL WHERE request_id = ?',
    ['Rejected_BODHR', req.params.id]
  );
  await logAudit({
    table_name: 'trx_training_request',
    record_id: req.params.id,
    operation: 'UPDATE',
    old_data: { approval_status: req_.approval_status },
    new_data: { approval_status: 'Rejected_BODHR' },
    changed_by: req.changedBy,
  });
  res.json({ updated: true, approval_status: 'Rejected_BODHR' });
});

router.patch('/:id/dates', async (req, res) => {
  const { actual_date_start, actual_date_end } = req.body;
  if (!actual_date_start || !actual_date_end) {
    return res.status(400).json({ error: 'Tanggal mulai dan tanggal selesai wajib diisi' });
  }
  if (actual_date_end < actual_date_start) {
    return res.status(400).json({ error: 'Tanggal selesai tidak boleh sebelum tanggal mulai' });
  }
  const [result] = await pool.query(
    'UPDATE trx_training_request SET actual_date_start = ?, actual_date_end = ? WHERE request_id = ?',
    [actual_date_start, actual_date_end, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Data tidak ditemukan' });
  await logAudit({
    table_name: 'trx_training_request',
    record_id: req.params.id,
    operation: 'UPDATE',
    new_data: { actual_date_start, actual_date_end },
    changed_by: req.changedBy,
  });
  res.json({ updated: true, actual_date_start, actual_date_end });
});

router.patch('/:id/organizer-participants', async (req, res) => {
  const { organizer, participants, kompetensi, instruktur, department, training_selesai } = req.body;
  if (!Array.isArray(participants) || !participants.length) {
    return res.status(400).json({ error: 'Minimal 1 peserta wajib diisi' });
  }

  const [existing] = await pool.query('SELECT request_id, department, organizer, kompetensi, instruktur, training_selesai FROM trx_training_request WHERE request_id = ?', [req.params.id]);
  if (!existing.length) return res.status(404).json({ error: 'Data tidak ditemukan' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const newDept = department || existing[0].department;
    // training_selesai: 1 = selesai (tersembunyi dari daftar hadir), 0 = belum selesai
    const selesai = training_selesai ? 1 : 0;
    await conn.query(
      'UPDATE trx_training_request SET department = ?, organizer = ?, kompetensi = ?, instruktur = ?, training_selesai = ? WHERE request_id = ?',
      [newDept, organizer || null, kompetensi || null, instruktur || null, selesai, req.params.id]
    );

    await conn.query('DELETE FROM trx_training_request_participant WHERE request_id = ?', [req.params.id]);
    for (const name of participants) {
      if ((name || '').trim()) {
        await conn.query('INSERT INTO trx_training_request_participant (request_id, participant_name) VALUES (?,?)', [req.params.id, name.trim()]);
      }
    }

    await logAudit({
      table_name: 'trx_training_request',
      record_id: req.params.id,
      operation: 'UPDATE',
      old_data: { department: existing[0].department, organizer: existing[0].organizer, kompetensi: existing[0].kompetensi, instruktur: existing[0].instruktur, training_selesai: existing[0].training_selesai },
      new_data: { department: newDept, organizer, kompetensi, instruktur, training_selesai: selesai, participant_count: participants.length },
      changed_by: req.changedBy,
      conn,
    });

    await conn.commit();
    res.json({ updated: true, department: newDept, organizer, kompetensi, instruktur, training_selesai: selesai, participant_count: participants.length });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

router.delete('/:id', async (req, res) => {
  const [old] = await pool.query('SELECT * FROM trx_training_request WHERE request_id = ?', [req.params.id]);
  const [oldParts] = await pool.query('SELECT participant_name FROM trx_training_request_participant WHERE request_id = ?', [req.params.id]);

  if (old.length) {
    await logAudit({
      table_name: 'trx_training_request',
      record_id: req.params.id,
      operation: 'DELETE',
      old_data: { ...old[0], participants: oldParts.map(p => p.participant_name) },
      changed_by: req.changedBy,
    });
  }

  await pool.query('DELETE FROM trx_training_request WHERE request_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

function approvalPage(state, status, req_) {
  const statusLabel = {
    'PendingBODDept':  'Menunggu Direktur Dept',
    'PendingBODHR':    'Menunggu Direktur HRD',
    'Approved':        'Disetujui',
    'Rejected_BODDept': 'Ditolak oleh Direktur Dept',
    'Rejected_BODHR':  'Ditolak oleh Direktur HRD',
  }[status] || status;

  const alreadyIcon  = ['Approved'].includes(status) ? '✅' : '❌';
  const alreadyColor = ['Approved'].includes(status) ? '#00a86b' : '#d63031';

  const configs = {
    approved: {
      icon: '✅', color: '#00a86b', title: 'Permohonan Disetujui — Final',
      msg: `Permohonan pelatihan <strong>${req_?.training_name}</strong> dari departemen <strong>${req_?.department}</strong> telah <strong style="color:#00a86b">disetujui sepenuhnya</strong>. Proses persetujuan selesai.`,
      showBack: false,
    },
    approved_l1: {
      icon: '✅', color: '#2a5298', title: 'Disetujui — Diteruskan ke Direktur HRD',
      msg: `Permohonan pelatihan <strong>${req_?.training_name}</strong> dari departemen <strong>${req_?.department}</strong> telah disetujui. Permohonan <strong>diteruskan ke Direktur HRD</strong> untuk persetujuan akhir.`,
      showBack: false,
    },
    rejected_dept: {
      icon: '❌', color: '#d63031', title: 'Ditolak oleh Direktur Departemen',
      msg: `Permohonan pelatihan <strong>${req_?.training_name}</strong> dari departemen <strong>${req_?.department}</strong> telah <strong style="color:#d63031">ditolak oleh Direktur Departemen</strong>.`,
      showBack: false,
    },
    rejected_hrd: {
      icon: '❌', color: '#d63031', title: 'Ditolak oleh Direktur HRD',
      msg: `Permohonan pelatihan <strong>${req_?.training_name}</strong> dari departemen <strong>${req_?.department}</strong> telah <strong style="color:#d63031">ditolak oleh Direktur HRD</strong>.`,
      showBack: false,
    },
    already_done: {
      icon: alreadyIcon, color: alreadyColor, title: 'Sudah Diproses',
      msg: `Permohonan pelatihan <strong>${req_?.training_name}</strong> sudah diproses sebelumnya dengan status <strong>${statusLabel}</strong>.`,
    },
    not_found: {
      icon: '⚠️', color: '#e8a020', title: 'Link Tidak Valid',
      msg: 'Link persetujuan ini tidak valid atau sudah kadaluarsa.',
      showBack: false,
    },
  };
  const c = configs[state] || configs.not_found;
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${c.title} — CCSI Training</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f3f8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border-radius:12px;padding:40px 36px;max-width:440px;width:100%;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08);border-top:4px solid ${c.color}}
    .icon{font-size:52px;margin-bottom:16px}
    h2{font-size:1.3rem;color:#1a3c6e;margin-bottom:10px}
    p{font-size:.9rem;color:#64748b;line-height:1.6;margin-bottom:20px}
    .home{display:inline-block;background:#1a3c6e;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:.85rem;font-weight:600;transition:background .15s}
    .home:hover{background:#12294d}
    .brand{font-size:.75rem;color:#94a3b8;margin-top:20px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${c.icon}</div>
    <h2>${c.title}</h2>
    <p>${c.msg}</p>
    ${c.showBack !== false ? '<a class="home" href="/">Kembali ke Dashboard</a>' : ''}
    <div class="brand">PT Communication Cable Systems Indonesia</div>
  </div>
</body>
</html>`;
}

module.exports = router;
