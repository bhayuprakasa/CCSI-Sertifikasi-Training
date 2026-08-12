const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM mst_program ORDER BY program_id');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory } = req.body;
  if (!program_name || !program_type) return res.status(400).json({ error: 'program_name and program_type required' });
  const [result] = await pool.query(
    'INSERT INTO mst_program (program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory) VALUES (?,?,?,?,?,?,?,?)',
    [program_name, program_type, competency_id || null, delivery_method || 'Offline', conducted_by || null, trainer_name || null, location || null, is_mandatory ?? 0]
  );
  res.status(201).json({ program_id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const { program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory } = req.body;
  const [result] = await pool.query(
    'UPDATE mst_program SET program_name=?, program_type=?, competency_id=?, delivery_method=?, conducted_by=?, trainer_name=?, location=?, is_mandatory=? WHERE program_id=?',
    [program_name, program_type, competency_id || null, delivery_method || 'Offline', conducted_by || null, trainer_name || null, location || null, is_mandatory ?? 0, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
  res.json({ program_id: parseInt(req.params.id) });
});

router.delete('/:id', async (req, res) => {
  const [trx] = await pool.query('SELECT 1 FROM trx_employee_program WHERE program_id = ? LIMIT 1', [req.params.id]);
  if (trx.length) return res.status(409).json({ error: 'Cannot delete: used in transactions' });
  await pool.query('DELETE FROM mst_program WHERE program_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
