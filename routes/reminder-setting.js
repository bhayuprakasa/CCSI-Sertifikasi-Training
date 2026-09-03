const express = require('express');
const router = express.Router();
const pool = require('../db');

// Nilai yang diizinkan untuk frekuensi reminder
const VALID_FREQUENCY = ['hari', 'minggu', 'bulan'];

// GET — ambil konfigurasi reminder sertifikasi (selalu satu baris)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM cfg_reminder_setting ORDER BY id DESC LIMIT 1'
    );
    // Kembalikan default jika tabel masih kosong
    res.json(rows[0] || {
      id: null,
      interval_value: 1,
      frequency: 'minggu',
      days_before: 30,
      updated_at: null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST — simpan / update konfigurasi reminder
router.post('/', async (req, res) => {
  const { interval_value, frequency, days_before } = req.body;

  // Validasi interval: harus angka positif
  const iv = parseInt(interval_value, 10);
  if (!iv || iv < 1) {
    return res.status(400).json({ error: 'interval_value harus angka >= 1' });
  }

  // Validasi frequency
  if (!VALID_FREQUENCY.includes(frequency)) {
    return res.status(400).json({
      error: `frequency harus salah satu dari: ${VALID_FREQUENCY.join(', ')}`,
    });
  }

  // Validasi days_before: harus angka positif
  const db = parseInt(days_before, 10);
  if (!db || db < 1) {
    return res.status(400).json({ error: 'days_before harus angka >= 1' });
  }

  try {
    // Gunakan INSERT … ON DUPLICATE KEY UPDATE agar tabel selalu punya tepat 1 baris
    // (PRIMARY KEY id=1 dijaga dengan default-insert saat tabel masih kosong)
    const [existing] = await pool.query('SELECT id FROM cfg_reminder_setting LIMIT 1');

    if (existing.length) {
      await pool.query(
        `UPDATE cfg_reminder_setting
         SET interval_value = ?, frequency = ?, days_before = ?, updated_at = NOW()
         WHERE id = ?`,
        [iv, frequency, db, existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO cfg_reminder_setting (interval_value, frequency, days_before)
         VALUES (?, ?, ?)`,
        [iv, frequency, db]
      );
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
