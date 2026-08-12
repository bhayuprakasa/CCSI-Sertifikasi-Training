const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, e.full_name, e.department, co.competency_name
     FROM trx_certification c
     LEFT JOIN mst_employee e ON c.employee_id = e.employee_id
     LEFT JOIN mst_competency co ON c.competency_id = co.competency_id
     ORDER BY c.cert_id DESC`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { employee_id, trx_id, sertif_name, certificate_number, issue_date, expiry_date, issuing_body, card_number, card_date, competency_id, delivery_method, certification_type, location, is_lifetime, is_active, renewal_count, notes } = req.body;
  if (!employee_id || !sertif_name || !issue_date) return res.status(400).json({ error: 'employee_id, sertif_name, and issue_date required' });

  const [result] = await pool.query(
    `INSERT INTO trx_certification (employee_id, trx_id, sertif_name, certificate_number, issue_date, expiry_date, issuing_body, card_number, card_date, competency_id, delivery_method, certification_type, location, is_lifetime, is_active, renewal_count, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [employee_id, trx_id || null, sertif_name, certificate_number || null, issue_date, is_lifetime ? null : (expiry_date || null), issuing_body || null, card_number || null, card_date || null, competency_id || null, delivery_method || 'Offline', certification_type || 'Eksternal', location || null, is_lifetime ?? 0, is_active ?? 1, renewal_count || 0, notes || null]
  );
  res.status(201).json({ cert_id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const { employee_id, trx_id, sertif_name, certificate_number, issue_date, expiry_date, issuing_body, card_number, card_date, competency_id, delivery_method, certification_type, location, is_lifetime, is_active, renewal_count, notes } = req.body;
  const [result] = await pool.query(
    `UPDATE trx_certification
     SET employee_id=?, trx_id=?, sertif_name=?, certificate_number=?, issue_date=?, expiry_date=?, issuing_body=?, card_number=?, card_date=?, competency_id=?, delivery_method=?, certification_type=?, location=?, is_lifetime=?, is_active=?, renewal_count=?, notes=?
     WHERE cert_id=?`,
    [employee_id, trx_id || null, sertif_name, certificate_number || null, issue_date, is_lifetime ? null : (expiry_date || null), issuing_body || null, card_number || null, card_date || null, competency_id || null, delivery_method || 'Offline', certification_type || 'Eksternal', location || null, is_lifetime ?? 0, is_active ?? 1, renewal_count || 0, notes || null, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
  res.json({ cert_id: parseInt(req.params.id) });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM trx_certification WHERE cert_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
