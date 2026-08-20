const express = require('express');
const router = express.Router();
const pool = require('../db');
const { logAudit } = require('../middleware/auditLog');

const SAFE_COLS = 'employee_id, full_name, department, position, site, email, employment_status, join_date, is_active, is_dept_head';
const BOD_COLS  = 'employee_id, full_name, department, position, site, email, employment_status, join_date, is_active';
const VALID_EMPLOYMENT_STATUS = ['PKWTT', 'PKWT'];

router.get('/', async (req, res) => {
  const { dept, direktur, dept_head, active } = req.query;
  if (direktur === '1') {
    try {
      const [allRows] = await pool.query(`SELECT employee_id, full_name, department, is_active FROM mst_employee`);
      console.log('[DEBUG direktur=1] semua karyawan:', JSON.stringify(allRows));
      const [rows] = await pool.query(
        `SELECT ${BOD_COLS} FROM mst_employee WHERE is_active = 1 AND LOWER(TRIM(department)) = 'bod' ORDER BY full_name`
      );
      console.log('[DEBUG direktur=1] hasil filter BOD:', JSON.stringify(rows));
      return res.json(rows);
    } catch (e) {
      console.error('[DEBUG direktur=1] error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
  if (dept_head === '1') {
    // Coba is_dept_head dulu, fallback ke is_direktur
    const flagCol = await (async () => {
      try { await pool.query('SELECT is_dept_head FROM mst_employee LIMIT 0'); return 'is_dept_head'; }
      catch { return 'is_direktur'; }
    })();
    if (dept) {
      const [rows] = await pool.query(
        `SELECT ${SAFE_COLS.replace('is_dept_head', `${flagCol} AS is_dept_head`)} FROM mst_employee WHERE is_active = 1 AND ${flagCol} = 1 AND department = ? ORDER BY full_name`,
        [dept]
      );
      return res.json(rows);
    }
    const [rows] = await pool.query(
      `SELECT ${SAFE_COLS.replace('is_dept_head', `${flagCol} AS is_dept_head`)} FROM mst_employee WHERE is_active = 1 AND ${flagCol} = 1 ORDER BY full_name`,
    );
    return res.json(rows);
  }
  if (dept) {
    const [rows] = await pool.query(
      `SELECT ${SAFE_COLS} FROM mst_employee WHERE department = ? AND is_active = 1 ORDER BY full_name`,
      [dept]
    );
    return res.json(rows);
  }
  if (active === '1') {
    const [rows] = await pool.query(
      'SELECT employee_id, full_name, department, position, email, is_active FROM mst_employee WHERE is_active = 1 ORDER BY full_name'
    );
    return res.json(rows);
  }
  const [rows] = await pool.query(`SELECT ${SAFE_COLS} FROM mst_employee ORDER BY employee_id`);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT ${SAFE_COLS} FROM mst_employee WHERE employee_id = ?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { employee_id, full_name, department, position, site, email, employment_status, join_date, is_active, is_dept_head } = req.body;
  if (!employee_id || !full_name) return res.status(400).json({ error: 'employee_id and full_name required' });
  if (employment_status && !VALID_EMPLOYMENT_STATUS.includes(employment_status)) {
    return res.status(400).json({ error: `employment_status must be one of: ${VALID_EMPLOYMENT_STATUS.join(', ')}` });
  }

  await pool.query(
    'INSERT INTO mst_employee (employee_id, full_name, department, position, site, email, employment_status, join_date, is_active, is_dept_head) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [employee_id, full_name, department, position, site, email || null, employment_status || 'PKWTT', join_date || null, is_active ?? 1, is_dept_head ?? 0]
  );

  await logAudit({
    table_name: 'mst_employee',
    record_id: employee_id,
    operation: 'CREATE',
    new_data: req.body,
    changed_by: req.changedBy,
  });

  res.status(201).json({ employee_id });
});

router.put('/:id', async (req, res) => {
  const { full_name, department, position, site, email, employment_status, join_date, is_active, is_dept_head } = req.body;

  if (employment_status && !VALID_EMPLOYMENT_STATUS.includes(employment_status)) {
    return res.status(400).json({ error: `employment_status must be one of: ${VALID_EMPLOYMENT_STATUS.join(', ')}` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [old] = await conn.query(
      `SELECT ${SAFE_COLS} FROM mst_employee WHERE employee_id = ? FOR UPDATE`,
      [req.params.id]
    );
    if (!old.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Not found' });
    }

    await logAudit({
      table_name: 'mst_employee',
      record_id: req.params.id,
      operation: 'UPDATE',
      old_data: old[0],
      new_data: { full_name, department, position, site, email, employment_status, join_date, is_active, is_dept_head },
      changed_by: req.changedBy,
      conn,
    });

    const [result] = await conn.query(
      'UPDATE mst_employee SET full_name=?, department=?, position=?, site=?, email=?, employment_status=?, join_date=?, is_active=?, is_dept_head=? WHERE employee_id=?',
      [full_name, department, position, site, email || null, employment_status, join_date || null, is_active ?? 1, is_dept_head ?? 0, req.params.id]
    );
    if (!result.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ error: 'Not found' });
    }

    await conn.commit();
    res.json({ employee_id: req.params.id });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

router.delete('/:id', async (req, res) => {
  const [trx] = await pool.query('SELECT 1 FROM trx_employee_program WHERE employee_id = ? LIMIT 1', [req.params.id]);
  const [cert] = await pool.query('SELECT 1 FROM trx_certification WHERE employee_id = ? LIMIT 1', [req.params.id]);
  if (trx.length || cert.length) return res.status(409).json({ error: 'Cannot delete: used in transactions' });

  const [old] = await pool.query(`SELECT ${SAFE_COLS} FROM mst_employee WHERE employee_id = ?`, [req.params.id]);
  if (old.length) {
    await logAudit({
      table_name: 'mst_employee',
      record_id: req.params.id,
      operation: 'DELETE',
      old_data: old[0],
      changed_by: req.changedBy,
    });
  }

  await pool.query('DELETE FROM mst_employee WHERE employee_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
