const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const [needs] = await pool.query('SELECT * FROM trx_training_need ORDER BY need_id DESC');
  const [participants] = await pool.query('SELECT * FROM trx_training_need_participant ORDER BY participant_id');
  const result = needs.map(n => ({
    ...n,
    participants: participants.filter(p => p.need_id === n.need_id).map(p => p.participant_name),
  }));
  res.json(result);
});

router.post('/batch', async (req, res) => {
  const { items, submitted_by } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items array required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const inserted = [];

    for (const item of items) {
      const { department, training_type, competency_desc, training_name, organizer, target_date, estimated_cost, participants, plan_year, scores } = item;
      if (!department || !training_type || !competency_desc || !training_name || !organizer || !target_date || !participants?.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'All fields required, including at least 1 participant' });
      }

      const pa = scores?.peserta_atasan || null;
      const ph = scores?.peserta_hrd || null;
      const ma = scores?.materi_atasan || null;
      const mh = scores?.materi_hrd || null;
      const gt = (pa || 0) + (ph || 0) + (ma || 0) + (mh || 0) || null;

      const [result] = await conn.query(
        'INSERT INTO trx_training_need (department, training_type, competency_desc, training_name, organizer, target_date, estimated_cost, plan_year, submitted_by, score_peserta_atasan, score_peserta_hrd, score_materi_atasan, score_materi_hrd, score_grand_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [department, training_type, competency_desc, training_name, organizer, target_date, estimated_cost || 0, plan_year || new Date().getFullYear(), submitted_by || null, pa, ph, ma, mh, gt]
      );
      const needId = result.insertId;

      for (const name of participants) {
        if (name.trim()) {
          await conn.query('INSERT INTO trx_training_need_participant (need_id, participant_name) VALUES (?,?)', [needId, name.trim()]);
        }
      }

      inserted.push({ need_id: needId, ...item });
    }

    await conn.commit();
    res.status(201).json({ count: inserted.length, items: inserted });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM trx_training_need WHERE need_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
