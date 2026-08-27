const express = require('express');
const router = express.Router();
const pool = require('../db');
const { logAudit } = require('../middleware/auditLog');

const VALID_PROGRAM_TYPE    = ['Training', 'Sosialisasi', 'Sertifikasi'];
const VALID_DELIVERY_METHOD = ['Offline', 'Online', 'Hybrid', 'Vendor'];
const VALID_PROGRAM_STATUS  = ['Waiting', 'On Process', 'Done'];
const VALID_ORGANIZER_TYPE  = ['Internal', 'Eksternal'];

function validateProgram(body) {
  const { program_type, delivery_method, program_status, organizer_type } = body;
  if (program_type && !VALID_PROGRAM_TYPE.includes(program_type))
    return `program_type must be one of: ${VALID_PROGRAM_TYPE.join(', ')}`;
  if (delivery_method && !VALID_DELIVERY_METHOD.includes(delivery_method))
    return `delivery_method must be one of: ${VALID_DELIVERY_METHOD.join(', ')}`;
  if (program_status && !VALID_PROGRAM_STATUS.includes(program_status))
    return `program_status must be one of: ${VALID_PROGRAM_STATUS.join(', ')}`;
  if (organizer_type && !VALID_ORGANIZER_TYPE.includes(organizer_type))
    return `organizer_type must be one of: ${VALID_ORGANIZER_TYPE.join(', ')}`;
  return null;
}

const PROGRAM_COLS = 'program_id, program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory, program_status, start_date, end_date, organizer_type, created_at';

router.get('/', async (req, res) => {
  const [rows] = await pool.query(`SELECT ${PROGRAM_COLS} FROM mst_program ORDER BY program_id`);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory, program_status, start_date, end_date, organizer_type } = req.body;
  if (!program_name || !program_type) return res.status(400).json({ error: 'program_name and program_type required' });

  const validErr = validateProgram(req.body);
  if (validErr) return res.status(400).json({ error: validErr });

  const [result] = await pool.query(
    'INSERT INTO mst_program (program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory, program_status, start_date, end_date, organizer_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [program_name, program_type, competency_id || null, delivery_method || 'Offline', conducted_by || null, trainer_name || null, location || null, is_mandatory ?? 0, program_status || 'Waiting', start_date || null, end_date || null, organizer_type || 'Eksternal']
  );

  await logAudit({
    table_name: 'mst_program',
    record_id: result.insertId,
    operation: 'CREATE',
    new_data: { program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory, program_status, start_date, end_date, organizer_type },
    changed_by: req.changedBy,
  });

  res.status(201).json({ program_id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const { program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory, program_status, start_date, end_date, organizer_type } = req.body;

  const validErr = validateProgram(req.body);
  if (validErr) return res.status(400).json({ error: validErr });

  const [old] = await pool.query(`SELECT ${PROGRAM_COLS} FROM mst_program WHERE program_id = ?`, [req.params.id]);
  if (!old.length) return res.status(404).json({ error: 'Not found' });

  await logAudit({
    table_name: 'mst_program',
    record_id: req.params.id,
    operation: 'UPDATE',
    old_data: old[0],
    new_data: { program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory, program_status, start_date, end_date, organizer_type },
    changed_by: req.changedBy,
  });

  const [result] = await pool.query(
    'UPDATE mst_program SET program_name=?, program_type=?, competency_id=?, delivery_method=?, conducted_by=?, trainer_name=?, location=?, is_mandatory=?, program_status=?, start_date=?, end_date=?, organizer_type=? WHERE program_id=?',
    [program_name, program_type, competency_id || null, delivery_method || 'Offline', conducted_by || null, trainer_name || null, location || null, is_mandatory ?? 0, program_status || 'Waiting', start_date || null, end_date || null, organizer_type || 'Eksternal', req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
  res.json({ program_id: parseInt(req.params.id) });
});

router.delete('/:id', async (req, res) => {
  const [old] = await pool.query(`SELECT ${PROGRAM_COLS} FROM mst_program WHERE program_id = ?`, [req.params.id]);
  if (old.length) {
    await logAudit({
      table_name: 'mst_program',
      record_id: req.params.id,
      operation: 'DELETE',
      old_data: old[0],
      changed_by: req.changedBy,
    });
  }

  await pool.query('DELETE FROM mst_program WHERE program_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
