const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const [requests] = await pool.query('SELECT * FROM trx_training_request ORDER BY request_id DESC');
  const [participants] = await pool.query('SELECT * FROM trx_training_request_participant ORDER BY participant_id');
  const result = requests.map(r => ({
    ...r,
    participants: participants.filter(p => p.request_id === r.request_id).map(p => p.participant_name),
  }));
  res.json(result);
});

router.post('/', async (req, res) => {
  const item = req.body;
  if (!item.department || !item.training_name || !item.training_date_start || !item.training_type || !item.participants?.length) {
    return res.status(400).json({ error: 'Field wajib belum lengkap' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const costTotal = (item.cost_training_fee || 0) + (item.cost_akomodasi || 0) +
      (item.cost_transport || 0) + (item.cost_makan || 0) +
      (item.cost_snack || 0) + (item.cost_emergency || 0);

    const pa = item.scores?.peserta_atasan || null;
    const ph = item.scores?.peserta_hrd || null;
    const ma = item.scores?.materi_atasan || null;
    const mh = item.scores?.materi_hrd || null;
    const gt = (pa || 0) + (ph || 0) + (ma || 0) + (mh || 0) || null;

    const [result] = await conn.query(
      `INSERT INTO trx_training_request (
        department, training_name, training_venue, training_date_start, training_date_end,
        training_type, organizer, training_reason,
        cost_training_fee, cost_akomodasi, cost_transport, cost_makan, cost_snack, cost_emergency, cost_total,
        eq_proyektor, eq_laptop, eq_kabel_hdmi, eq_pointer, eq_flipchart, eq_notebook, eq_ruangan, eq_colokan,
        coffee_break,
        score_peserta_atasan, score_peserta_hrd, score_materi_atasan, score_materi_hrd, score_grand_total,
        submitted_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        item.department, item.training_name, item.training_venue || null,
        item.training_date_start, item.training_date_end || item.training_date_start,
        item.training_type, item.organizer || null, item.training_reason || null,
        item.cost_training_fee || 0, item.cost_akomodasi || 0, item.cost_transport || 0,
        item.cost_makan || 0, item.cost_snack || 0, item.cost_emergency || 0, costTotal,
        item.eq_proyektor || 0, item.eq_laptop || 0, item.eq_kabel_hdmi || 0,
        item.eq_pointer || 0, item.eq_flipchart || 0, item.eq_notebook || 0,
        item.eq_ruangan || 0, item.eq_colokan || 0,
        item.coffee_break ? 1 : 0,
        pa, ph, ma, mh, gt,
        item.submitted_by || null
      ]
    );

    const requestId = result.insertId;
    for (const name of item.participants) {
      if (name.trim()) {
        await conn.query('INSERT INTO trx_training_request_participant (request_id, participant_name) VALUES (?,?)', [requestId, name.trim()]);
      }
    }

    await conn.commit();
    res.status(201).json({ request_id: requestId, ...item, cost_total: costTotal });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM trx_training_request WHERE request_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
