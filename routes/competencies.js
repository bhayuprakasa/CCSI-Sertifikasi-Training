const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM mst_competency ORDER BY competency_id');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { competency_name, competency_type, category } = req.body;
  if (!competency_name || !competency_type) return res.status(400).json({ error: 'competency_name and competency_type required' });
  const [result] = await pool.query(
    'INSERT INTO mst_competency (competency_name, competency_type, category) VALUES (?,?,?)',
    [competency_name, competency_type, category || null]
  );
  res.status(201).json({ competency_id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const { competency_name, competency_type, category } = req.body;
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
  await pool.query('DELETE FROM mst_competency WHERE competency_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
