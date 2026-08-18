const express = require('express');
const router = express.Router();
const pool = require('../db');
const { logAudit } = require('../middleware/auditLog');

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM trx_employee_program ORDER BY trx_id');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { employee_id, program_id, start_date, end_date, status, aktivitas, pre_test_score, post_test_score, reaction_score, training_cost, notes, recorded_by } = req.body;
  if (!employee_id || !program_id) return res.status(400).json({ error: 'employee_id and program_id required' });
  const [result] = await pool.query(
    'INSERT INTO trx_employee_program (employee_id, program_id, start_date, end_date, status, aktivitas, pre_test_score, post_test_score, reaction_score, training_cost, notes, recorded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [employee_id, program_id, start_date || null, end_date || null, status || 'Ongoing', aktivitas || null, pre_test_score ?? null, post_test_score ?? null, reaction_score ?? null, training_cost || 0, notes || null, recorded_by || null]
  );
  res.status(201).json({ trx_id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const { employee_id, program_id, start_date, end_date, status, aktivitas, pre_test_score, post_test_score, reaction_score, training_cost, notes, recorded_by, changed_by } = req.body;

  const [old] = await pool.query('SELECT * FROM trx_employee_program WHERE trx_id = ?', [req.params.id]);
  if (!old.length) return res.status(404).json({ error: 'Not found' });

  await logAudit({
    table_name: 'trx_employee_program',
    record_id: req.params.id,
    operation: 'UPDATE',
    old_data: old[0],
    new_data: req.body,
    changed_by,
  });

  const [result] = await pool.query(
    'UPDATE trx_employee_program SET employee_id=?, program_id=?, start_date=?, end_date=?, status=?, aktivitas=?, pre_test_score=?, post_test_score=?, reaction_score=?, training_cost=?, notes=?, recorded_by=? WHERE trx_id=?',
    [employee_id, program_id, start_date || null, end_date || null, status, aktivitas || null, pre_test_score ?? null, post_test_score ?? null, reaction_score ?? null, training_cost || 0, notes || null, recorded_by || null, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
  res.json({ trx_id: parseInt(req.params.id) });
});

router.delete('/:id', async (req, res) => {
  const [old] = await pool.query('SELECT * FROM trx_employee_program WHERE trx_id = ?', [req.params.id]);
  if (old.length) {
    await logAudit({
      table_name: 'trx_employee_program',
      record_id: req.params.id,
      operation: 'DELETE',
      old_data: old[0],
      changed_by: req.query.changed_by || null,
    });
  }

  await pool.query('DELETE FROM trx_employee_program WHERE trx_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
