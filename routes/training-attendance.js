const express = require('express');
const router = express.Router();
const pool = require('../db');
const { logAudit } = require('../middleware/auditLog');

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT attendance_id, training_title, instructor, department, training_date_start, training_date_end, submitted_at FROM trx_training_attendance ORDER BY attendance_id DESC'
  );
  const [parts] = await pool.query(
    'SELECT participant_id, attendance_id, employee_id, employee_name, eval_json FROM trx_training_attendance_participant ORDER BY participant_id'
  );
  const result = rows.map(r => ({
    ...r,
    participants: parts.filter(p => p.attendance_id === r.attendance_id).map(p => ({
      employee_id: p.employee_id,
      employee_name: p.employee_name,
      eval_json: p.eval_json ? JSON.parse(p.eval_json) : null,
    })),
  }));
  res.json(result);
});

router.post('/', async (req, res) => {
  const { training_title, instructor, department, training_date_start, training_date_end, participants } = req.body;
  if (!training_title || !department || !training_date_start || !participants?.length) {
    return res.status(400).json({ error: 'Field wajib belum lengkap' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      'INSERT INTO trx_training_attendance (training_title, instructor, department, training_date_start, training_date_end) VALUES (?,?,?,?,?)',
      [training_title, instructor || null, department, training_date_start, training_date_end || training_date_start]
    );
    const id = result.insertId;

    for (const p of participants) {
      if (p.employee_id && p.employee_name) {
        const evalJson = p.eval_json ? JSON.stringify(p.eval_json) : null;
        await conn.query(
          'INSERT INTO trx_training_attendance_participant (attendance_id, employee_id, employee_name, eval_json) VALUES (?,?,?,?)',
          [id, p.employee_id, p.employee_name, evalJson]
        );
      }
    }

    await logAudit({
      table_name: 'trx_training_attendance',
      record_id: id,
      operation: 'CREATE',
      new_data: { training_title, instructor, department, training_date_start, training_date_end, participant_count: participants.length },
      changed_by: req.changedBy,
      conn,
    });

    await conn.commit();
    res.status(201).json({ attendance_id: id });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

router.delete('/:id', async (req, res) => {
  const [old] = await pool.query('SELECT attendance_id, training_title, department, training_date_start FROM trx_training_attendance WHERE attendance_id = ?', [req.params.id]);
  const [oldParts] = await pool.query('SELECT employee_id, employee_name, eval_json FROM trx_training_attendance_participant WHERE attendance_id = ?', [req.params.id]);

  if (old.length) {
    await logAudit({
      table_name: 'trx_training_attendance',
      record_id: req.params.id,
      operation: 'DELETE',
      old_data: {
        ...old[0],
        participants: oldParts.map(p => ({
          employee_id: p.employee_id,
          employee_name: p.employee_name,
          eval_json: p.eval_json ? JSON.parse(p.eval_json) : null,
        })),
      },
      changed_by: req.changedBy,
    });
  }

  await pool.query('DELETE FROM trx_training_attendance WHERE attendance_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
