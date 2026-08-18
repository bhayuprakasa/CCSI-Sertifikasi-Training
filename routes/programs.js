const express = require('express');
const router = express.Router();
const pool = require('../db');
const { logAudit } = require('../middleware/auditLog');

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM mst_program ORDER BY program_id');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory, program_status, start_date, end_date, organizer_type } = req.body;
  if (!program_name || !program_type) return res.status(400).json({ error: 'program_name and program_type required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO mst_program (program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory, program_status, start_date, end_date, organizer_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [program_name, program_type, competency_id || null, delivery_method || 'Offline', conducted_by || null, trainer_name || null, location || null, is_mandatory ?? 0, program_status || 'Waiting', start_date || null, end_date || null, organizer_type || 'Eksternal']
    );
    res.status(201).json({ program_id: result.insertId });
  } catch (e) {
    if (e.code === 'ER_BAD_FIELD_ERROR') {
      const [result] = await pool.query(
        'INSERT INTO mst_program (program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory) VALUES (?,?,?,?,?,?,?,?)',
        [program_name, program_type, competency_id || null, delivery_method || 'Offline', conducted_by || null, trainer_name || null, location || null, is_mandatory ?? 0]
      );
      res.status(201).json({ program_id: result.insertId });
    } else { throw e; }
  }
});

router.put('/:id', async (req, res) => {
  const { program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory, program_status, start_date, end_date, organizer_type, changed_by } = req.body;

  const [old] = await pool.query('SELECT * FROM mst_program WHERE program_id = ?', [req.params.id]);
  if (!old.length) return res.status(404).json({ error: 'Not found' });

  await logAudit({
    table_name: 'mst_program',
    record_id: req.params.id,
    operation: 'UPDATE',
    old_data: old[0],
    new_data: req.body,
    changed_by,
  });

  try {
    const [result] = await pool.query(
      'UPDATE mst_program SET program_name=?, program_type=?, competency_id=?, delivery_method=?, conducted_by=?, trainer_name=?, location=?, is_mandatory=?, program_status=?, start_date=?, end_date=?, organizer_type=? WHERE program_id=?',
      [program_name, program_type, competency_id || null, delivery_method || 'Offline', conducted_by || null, trainer_name || null, location || null, is_mandatory ?? 0, program_status || 'Waiting', start_date || null, end_date || null, organizer_type || 'Eksternal', req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
  } catch (e) {
    if (e.code === 'ER_BAD_FIELD_ERROR') {
      const [result] = await pool.query(
        'UPDATE mst_program SET program_name=?, program_type=?, competency_id=?, delivery_method=?, conducted_by=?, trainer_name=?, location=?, is_mandatory=? WHERE program_id=?',
        [program_name, program_type, competency_id || null, delivery_method || 'Offline', conducted_by || null, trainer_name || null, location || null, is_mandatory ?? 0, req.params.id]
      );
      if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
    } else { throw e; }
  }
  res.json({ program_id: parseInt(req.params.id) });
});

router.delete('/:id', async (req, res) => {
  const [trx] = await pool.query('SELECT 1 FROM trx_employee_program WHERE program_id = ? LIMIT 1', [req.params.id]);
  if (trx.length) return res.status(409).json({ error: 'Cannot delete: used in transactions' });

  const [old] = await pool.query('SELECT * FROM mst_program WHERE program_id = ?', [req.params.id]);
  if (old.length) {
    await logAudit({
      table_name: 'mst_program',
      record_id: req.params.id,
      operation: 'DELETE',
      old_data: old[0],
      changed_by: req.query.changed_by || null,
    });
  }

  await pool.query('DELETE FROM mst_program WHERE program_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
