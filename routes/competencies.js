const express = require('express');
const router = express.Router();
const pool = require('../db');
const { logAudit } = require('../middleware/auditLog');

const VALID_COMPETENCY_TYPE = ['Hard Skill', 'Soft Skill', 'Safety', 'Leadership'];

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT competency_id, competency_name, competency_type, category FROM mst_competency ORDER BY competency_id');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { competency_name, competency_type, category } = req.body;
  if (!competency_name || !competency_type) return res.status(400).json({ error: 'competency_name and competency_type required' });
  if (!VALID_COMPETENCY_TYPE.includes(competency_type)) {
    return res.status(400).json({ error: `competency_type must be one of: ${VALID_COMPETENCY_TYPE.join(', ')}` });
  }

  const [result] = await pool.query(
    'INSERT INTO mst_competency (competency_name, competency_type, category) VALUES (?,?,?)',
    [competency_name, competency_type, category || null]
  );

  await logAudit({
    table_name: 'mst_competency',
    record_id: result.insertId,
    operation: 'CREATE',
    new_data: { competency_name, competency_type, category },
    changed_by: req.changedBy,
  });

  res.status(201).json({ competency_id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const { competency_name, competency_type, category } = req.body;

  if (competency_type && !VALID_COMPETENCY_TYPE.includes(competency_type)) {
    return res.status(400).json({ error: `competency_type must be one of: ${VALID_COMPETENCY_TYPE.join(', ')}` });
  }

  const [old] = await pool.query('SELECT competency_id, competency_name, competency_type, category FROM mst_competency WHERE competency_id = ?', [req.params.id]);
  if (!old.length) return res.status(404).json({ error: 'Not found' });

  await logAudit({
    table_name: 'mst_competency',
    record_id: req.params.id,
    operation: 'UPDATE',
    old_data: old[0],
    new_data: { competency_name, competency_type, category },
    changed_by: req.changedBy,
  });

  const [result] = await pool.query(
    'UPDATE mst_competency SET competency_name=?, competency_type=?, category=? WHERE competency_id=?',
    [competency_name, competency_type, category || null, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
  res.json({ competency_id: parseInt(req.params.id) });
});

router.delete('/:id', async (req, res) => {
  const [progs] = await pool.query('SELECT 1 FROM mst_program WHERE competency_id = ? LIMIT 1', [req.params.id]);
  if (progs.length) return res.status(409).json({ error: 'Cannot delete: used in programs' });

  const [old] = await pool.query('SELECT competency_id, competency_name, competency_type, category FROM mst_competency WHERE competency_id = ?', [req.params.id]);
  if (old.length) {
    await logAudit({
      table_name: 'mst_competency',
      record_id: req.params.id,
      operation: 'DELETE',
      old_data: old[0],
      changed_by: req.changedBy,
    });
  }

  await pool.query('DELETE FROM mst_competency WHERE competency_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
