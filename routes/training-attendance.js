const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM trx_training_attendance ORDER BY attendance_id DESC');
  const [parts] = await pool.query('SELECT * FROM trx_training_attendance_participant ORDER BY participant_id');
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
  const { training_title, instructor, location, department, training_date_start, training_date_end, participants } = req.body;
  if (!training_title || !department || !training_date_start || !participants?.length) {
    return res.status(400).json({ error: 'Field wajib belum lengkap' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      'INSERT INTO trx_training_attendance (training_title, instructor, location, department, training_date_start, training_date_end) VALUES (?,?,?,?,?,?)',
      [training_title, instructor || null, location || null, department, training_date_start, training_date_end || training_date_start]
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
  await pool.query('DELETE FROM trx_training_attendance WHERE attendance_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
