const express = require('express');
const router = express.Router();
const pool = require('../db');
const { logAudit } = require('../middleware/auditLog');

router.get('/', async (req, res) => {
  const { dept, direktur, active } = req.query;
  if (direktur === '1') {
    const [rows] = await pool.query(
      "SELECT * FROM mst_employee WHERE is_active = 1 AND (is_direktur = 1 OR LOWER(department) LIKE '%direksi%' OR LOWER(department) LIKE '%bod%') ORDER BY full_name"
    );
    return res.json(rows);
  }
  if (dept) {
    const [rows] = await pool.query('SELECT * FROM mst_employee WHERE department = ? AND is_active = 1 ORDER BY full_name', [dept]);
    return res.json(rows);
  }
  if (active === '1') {
    const [rows] = await pool.query('SELECT employee_id, full_name, department, position, email, is_active FROM mst_employee WHERE is_active = 1 ORDER BY full_name');
    return res.json(rows);
  }
  const [rows] = await pool.query('SELECT * FROM mst_employee ORDER BY employee_id');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM mst_employee WHERE employee_id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { employee_id, full_name, department, position, site, email, employment_status, join_date, is_active, is_direktur } = req.body;
  if (!employee_id || !full_name) return res.status(400).json({ error: 'employee_id and full_name required' });
  await pool.query(
    'INSERT INTO mst_employee (employee_id, full_name, department, position, site, email, employment_status, join_date, is_active, is_direktur) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [employee_id, full_name, department, position, site, email || null, employment_status || 'PKWTT', join_date || null, is_active ?? 1, is_direktur ?? 0]
  );
  res.status(201).json({ employee_id });
});

router.put('/:id', async (req, res) => {
  const { full_name, department, position, site, email, employment_status, join_date, is_active, is_direktur, changed_by } = req.body;

  const [old] = await pool.query('SELECT * FROM mst_employee WHERE employee_id = ?', [req.params.id]);
  if (!old.length) return res.status(404).json({ error: 'Not found' });

  await logAudit({
    table_name: 'mst_employee',
    record_id: req.params.id,
    operation: 'UPDATE',
    old_data: old[0],
    new_data: req.body,
    changed_by,
  });

  const [result] = await pool.query(
    'UPDATE mst_employee SET full_name=?, department=?, position=?, site=?, email=?, employment_status=?, join_date=?, is_active=?, is_direktur=? WHERE employee_id=?',
    [full_name, department, position, site, email || null, employment_status, join_date || null, is_active ?? 1, is_direktur ?? 0, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
  res.json({ employee_id: req.params.id });
});

router.delete('/:id', async (req, res) => {
  const [trx] = await pool.query('SELECT 1 FROM trx_employee_program WHERE employee_id = ? LIMIT 1', [req.params.id]);
  const [cert] = await pool.query('SELECT 1 FROM trx_certification WHERE employee_id = ? LIMIT 1', [req.params.id]);
  if (trx.length || cert.length) return res.status(409).json({ error: 'Cannot delete: used in transactions' });

  const [old] = await pool.query('SELECT * FROM mst_employee WHERE employee_id = ?', [req.params.id]);
  if (old.length) {
    await logAudit({
      table_name: 'mst_employee',
      record_id: req.params.id,
      operation: 'DELETE',
      old_data: old[0],
      changed_by: req.query.changed_by || null,
    });
  }

  await pool.query('DELETE FROM mst_employee WHERE employee_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
