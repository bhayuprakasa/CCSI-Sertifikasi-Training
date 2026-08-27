const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db');
const { logAudit } = require('../middleware/auditLog');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(csv)$/i)) {
      return cb(new Error('Hanya file CSV yang diperbolehkan'));
    }
    cb(null, true);
  },
});

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    if (fields.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = fields[idx] ?? ''; });
    rows.push(obj);
  }
  return rows;
}

function toNull(v) { return (v === '' || v === undefined) ? null : v; }
function toDate(v) { return (v === '' || v === undefined || v === null) ? null : v; }
function toInt(v, def = 0) { const n = parseInt(v); return isNaN(n) ? def : n; }

// ── POST /api/upload/karyawan ─────────────────────────────────────────────────
router.post('/karyawan', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

  const rows = parseCSV(req.file.buffer.toString('utf8'));
  if (!rows.length) return res.status(400).json({ error: 'File kosong atau format tidak sesuai' });

  const VALID_STATUS = ['PKWTT', 'PKWT'];
  const VALID_SITE = ['HO Jakarta', 'Cilegon'];
  const results = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;

    if (!r.employee_id || !r.full_name || !r.department || !r.position || !r.site) {
      results.errors.push(`Baris ${rowNum}: kolom wajib (employee_id, full_name, department, position, site) tidak lengkap`);
      results.skipped++;
      continue;
    }
    if (!VALID_SITE.includes(r.site)) {
      results.errors.push(`Baris ${rowNum}: site '${r.site}' tidak valid (HO Jakarta / Cilegon)`);
      results.skipped++;
      continue;
    }
    const empStatus = r.employment_status || 'PKWTT';
    if (!VALID_STATUS.includes(empStatus)) {
      results.errors.push(`Baris ${rowNum}: employment_status '${empStatus}' tidak valid (PKWTT / PKWT)`);
      results.skipped++;
      continue;
    }

    try {
      const [existing] = await pool.query('SELECT employee_id FROM mst_employee WHERE employee_id = ?', [r.employee_id]);
      if (existing.length) {
        await pool.query(
          'UPDATE mst_employee SET full_name=?, department=?, position=?, site=?, email=?, employment_status=?, join_date=?, is_active=?, is_dept_head=? WHERE employee_id=?',
          [r.full_name, r.department, r.position, r.site, toNull(r.email), empStatus, toDate(r.join_date), toInt(r.is_active, 1), toInt(r.is_dept_head, 0), r.employee_id]
        );
        results.updated++;
      } else {
        await pool.query(
          'INSERT INTO mst_employee (employee_id, full_name, department, position, site, email, employment_status, join_date, is_active, is_dept_head) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [r.employee_id, r.full_name, r.department, r.position, r.site, toNull(r.email), empStatus, toDate(r.join_date), toInt(r.is_active, 1), toInt(r.is_dept_head, 0)]
        );
        results.inserted++;
      }
      await logAudit({ table_name: 'mst_employee', record_id: r.employee_id, operation: existing.length ? 'UPDATE' : 'CREATE', new_data: r, changed_by: req.changedBy });
    } catch (e) {
      results.errors.push(`Baris ${rowNum}: ${e.message}`);
      results.skipped++;
    }
  }

  res.json({ ...results, total: rows.length });
});

// ── POST /api/upload/pelatihan ────────────────────────────────────────────────
router.post('/pelatihan', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

  const rows = parseCSV(req.file.buffer.toString('utf8'));
  if (!rows.length) return res.status(400).json({ error: 'File kosong atau format tidak sesuai' });

  const results = { inserted: 0, skipped: 0, errors: [] };
  const VALID_TYPE = ['Internal', 'Eksternal'];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;

    if (!r.department || !r.training_name) {
      results.errors.push(`Baris ${rowNum}: department dan training_name wajib diisi`);
      results.skipped++;
      continue;
    }
    if (r.training_type && !VALID_TYPE.includes(r.training_type)) {
      results.errors.push(`Baris ${rowNum}: training_type '${r.training_type}' tidak valid (Internal / Eksternal)`);
      results.skipped++;
      continue;
    }

    const dateStart = toDate(r.training_date_start) || new Date().toISOString().slice(0, 10);
    const dateEnd = toDate(r.training_date_end);
    const trainingType = VALID_TYPE.includes(r.training_type) ? r.training_type : 'Internal';

    try {
      const [result] = await pool.query(
        `INSERT INTO trx_training_request
          (department, training_name, training_venue, training_date_start, training_date_end,
           training_type, organizer, training_reason, submitted_by, is_scheduled, approval_status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [r.department, r.training_name, toNull(r.training_venue), dateStart, dateEnd,
         trainingType, toNull(r.organizer), toNull(r.training_reason),
         toNull(r.submitted_by), toInt(r.is_scheduled, 0), 'Submitted_HR']
      );

      const requestId = result.insertId;

      if (r.participants) {
        const names = r.participants.split(';').map(n => n.trim()).filter(Boolean);
        for (const name of names) {
          await pool.query(
            'INSERT INTO trx_training_request_participant (request_id, participant_name) VALUES (?,?)',
            [requestId, name]
          );
        }
      }

      await logAudit({ table_name: 'trx_training_request', record_id: String(requestId), operation: 'CREATE', new_data: r, changed_by: req.changedBy });
      results.inserted++;
    } catch (e) {
      results.errors.push(`Baris ${rowNum}: ${e.message}`);
      results.skipped++;
    }
  }

  res.json({ ...results, total: rows.length });
});

// ── POST /api/upload/absensi ──────────────────────────────────────────────────
router.post('/absensi', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

  const rows = parseCSV(req.file.buffer.toString('utf8'));
  if (!rows.length) return res.status(400).json({ error: 'File kosong atau format tidak sesuai' });

  const results = { inserted: 0, skipped: 0, errors: [], sessions: 0 };

  // Group rows by training session (same title + department + date_start)
  const sessions = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;

    if (!r.training_title || !r.department) {
      results.errors.push(`Baris ${rowNum}: training_title dan department wajib diisi`);
      results.skipped++;
      continue;
    }
    if (!r.employee_id || !r.employee_name) {
      results.errors.push(`Baris ${rowNum}: employee_id dan employee_name wajib diisi`);
      results.skipped++;
      continue;
    }

    const key = `${r.training_title}|${r.department}|${r.training_date_start || ''}|${r.instructor || ''}`;
    if (!sessions.has(key)) {
      sessions.set(key, { meta: r, participants: [] });
    }
    sessions.get(key).participants.push({ employee_id: r.employee_id, employee_name: r.employee_name });
  }

  for (const [, session] of sessions) {
    const { meta, participants } = session;
    try {
      const [result] = await pool.query(
        `INSERT INTO trx_training_attendance
          (training_title, instructor, location, department, training_date_start, training_date_end)
         VALUES (?,?,?,?,?,?)`,
        [meta.training_title, toNull(meta.instructor), toNull(meta.location), meta.department,
         toDate(meta.training_date_start), toDate(meta.training_date_end)]
      );

      const attendanceId = result.insertId;
      for (const p of participants) {
        await pool.query(
          'INSERT INTO trx_training_attendance_participant (attendance_id, employee_id, employee_name) VALUES (?,?,?)',
          [attendanceId, p.employee_id, p.employee_name]
        );
        results.inserted++;
      }

      await logAudit({ table_name: 'trx_training_attendance', record_id: String(attendanceId), operation: 'CREATE', new_data: meta, changed_by: req.changedBy });
      results.sessions++;
    } catch (e) {
      results.errors.push(`Session '${meta.training_title}': ${e.message}`);
      results.skipped += participants.length;
    }
  }

  res.json({ ...results, total: rows.length });
});

// ── POST /api/upload/evaluasi ─────────────────────────────────────────────────
router.post('/evaluasi', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

  const rows = parseCSV(req.file.buffer.toString('utf8'));
  if (!rows.length) return res.status(400).json({ error: 'File kosong atau format tidak sesuai' });

  const results = { inserted: 0, skipped: 0, errors: [], sessions: 0 };

  // Group by training session
  const sessions = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;

    if (!r.training_title || !r.department || !r.employee_id || !r.employee_name) {
      results.errors.push(`Baris ${rowNum}: training_title, department, employee_id, employee_name wajib diisi`);
      results.skipped++;
      continue;
    }

    const key = `${r.training_title}|${r.department}|${r.training_date_start || ''}|${r.instructor || ''}`;
    if (!sessions.has(key)) {
      sessions.set(key, { meta: r, participants: [] });
    }
    sessions.get(key).participants.push(r);
  }

  for (const [, session] of sessions) {
    const { meta, participants } = session;
    try {
      const [result] = await pool.query(
        `INSERT INTO trx_training_attendance
          (training_title, instructor, location, department, training_date_start, training_date_end)
         VALUES (?,?,?,?,?,?)`,
        [meta.training_title, toNull(meta.instructor), toNull(meta.location || null),
         meta.department, toDate(meta.training_date_start), toDate(meta.training_date_end || null)]
      );

      const attendanceId = result.insertId;
      for (const p of participants) {
        const evalObj = {
          score_materi: toInt(p.score_materi, 0),
          score_instruktur: toInt(p.score_instruktur, 0),
          score_fasilitas: toInt(p.score_fasilitas, 0),
          score_organisasi: toInt(p.score_organisasi, 0),
          saran: p.saran || '',
        };
        await pool.query(
          'INSERT INTO trx_training_attendance_participant (attendance_id, employee_id, employee_name, eval_json) VALUES (?,?,?,?)',
          [attendanceId, p.employee_id, p.employee_name, JSON.stringify(evalObj)]
        );
        results.inserted++;
      }

      await logAudit({ table_name: 'trx_training_attendance', record_id: String(attendanceId), operation: 'CREATE', new_data: meta, changed_by: req.changedBy });
      results.sessions++;
    } catch (e) {
      results.errors.push(`Session '${meta.training_title}': ${e.message}`);
      results.skipped += participants.length;
    }
  }

  res.json({ ...results, total: rows.length });
});

// ── POST /api/upload/sertifikasi ──────────────────────────────────────────────
router.post('/sertifikasi', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

  const rows = parseCSV(req.file.buffer.toString('utf8'));
  if (!rows.length) return res.status(400).json({ error: 'File kosong atau format tidak sesuai' });

  const results = { inserted: 0, skipped: 0, errors: [] };
  const VALID_TYPE = ['Internal', 'Eksternal'];
  const VALID_METHOD = ['Online', 'Offline'];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;

    if (!r.employee_id || !r.sertif_name || !r.issue_date) {
      results.errors.push(`Baris ${rowNum}: employee_id, sertif_name, dan issue_date wajib diisi`);
      results.skipped++;
      continue;
    }

    const certType = VALID_TYPE.includes(r.certification_type) ? r.certification_type : 'Eksternal';
    const delivMethod = VALID_METHOD.includes(r.delivery_method) ? r.delivery_method : 'Offline';

    try {
      const [result] = await pool.query(
        `INSERT INTO trx_certification
          (employee_id, sertif_name, certificate_number, issue_date, expiry_date,
           issuing_body, certification_type, delivery_method, notes)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [r.employee_id, r.sertif_name, toNull(r.certificate_number), r.issue_date,
         toDate(r.expiry_date), toNull(r.issuing_body), certType, delivMethod, toNull(r.notes)]
      );

      await logAudit({ table_name: 'trx_certification', record_id: String(result.insertId), operation: 'CREATE', new_data: r, changed_by: req.changedBy });
      results.inserted++;
    } catch (e) {
      results.errors.push(`Baris ${rowNum}: ${e.message}`);
      results.skipped++;
    }
  }

  res.json({ ...results, total: rows.length });
});

// Error handler for multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
