const express = require('express');
const router = express.Router();
const pool = require('../db');
const { logAudit } = require('../middleware/auditLog');

const VALID_DELIVERY_METHOD   = ['Online', 'Offline'];
const VALID_CERT_TYPE         = ['Internal', 'Eksternal'];

const CERT_COLS = 'c.cert_id, c.employee_id, c.trx_id, c.sertif_name, c.certificate_number, c.issue_date, c.expiry_date, c.issuing_body, c.card_number, c.card_date, c.competency_id, c.delivery_method, c.certification_type, c.location, c.is_lifetime, c.is_active, c.renewal_count, c.notes, c.renewal_action, c.renewal_cert_id, c.created_at, c.updated_at';

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT ${CERT_COLS}, e.full_name, e.department, co.competency_name
     FROM trx_certification c
     LEFT JOIN mst_employee e ON c.employee_id = e.employee_id
     LEFT JOIN mst_competency co ON c.competency_id = co.competency_id
     ORDER BY c.cert_id DESC`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { employee_id, trx_id, sertif_name, certificate_number, issue_date, expiry_date, issuing_body, card_number, card_date, competency_id, delivery_method, certification_type, location, is_lifetime, is_active, renewal_count, notes, renewal_action, renewal_cert_id } = req.body;
  if (!employee_id || !sertif_name || !issue_date) return res.status(400).json({ error: 'employee_id, sertif_name, and issue_date required' });
  if (delivery_method && !VALID_DELIVERY_METHOD.includes(delivery_method)) {
    return res.status(400).json({ error: `delivery_method must be one of: ${VALID_DELIVERY_METHOD.join(', ')}` });
  }
  if (certification_type && !VALID_CERT_TYPE.includes(certification_type)) {
    return res.status(400).json({ error: `certification_type must be one of: ${VALID_CERT_TYPE.join(', ')}` });
  }

  const [result] = await pool.query(
    `INSERT INTO trx_certification (employee_id, trx_id, sertif_name, certificate_number, issue_date, expiry_date, issuing_body, card_number, card_date, competency_id, delivery_method, certification_type, location, is_lifetime, is_active, renewal_count, notes, renewal_action, renewal_cert_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [employee_id, trx_id || null, sertif_name, certificate_number || null, issue_date, is_lifetime ? null : (expiry_date || null), issuing_body || null, card_number || null, card_date || null, competency_id || null, delivery_method || 'Offline', certification_type || 'Eksternal', location || null, is_lifetime ?? 0, is_active ?? 1, renewal_count || 0, notes || null, renewal_action || null, renewal_cert_id || null]
  );

  await logAudit({
    table_name: 'trx_certification',
    record_id: result.insertId,
    operation: 'CREATE',
    new_data: { employee_id, trx_id, sertif_name, certificate_number, issue_date, expiry_date, issuing_body, card_number, card_date, competency_id, delivery_method, certification_type, location, is_lifetime, is_active, renewal_count, notes, renewal_action, renewal_cert_id },
    changed_by: req.changedBy,
  });

  res.status(201).json({ cert_id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const { employee_id, trx_id, sertif_name, certificate_number, issue_date, expiry_date, issuing_body, card_number, card_date, competency_id, delivery_method, certification_type, location, is_lifetime, is_active, renewal_count, notes, renewal_action, renewal_cert_id } = req.body;

  if (delivery_method && !VALID_DELIVERY_METHOD.includes(delivery_method)) {
    return res.status(400).json({ error: `delivery_method must be one of: ${VALID_DELIVERY_METHOD.join(', ')}` });
  }
  if (certification_type && !VALID_CERT_TYPE.includes(certification_type)) {
    return res.status(400).json({ error: `certification_type must be one of: ${VALID_CERT_TYPE.join(', ')}` });
  }

  const [old] = await pool.query('SELECT cert_id, employee_id, trx_id, sertif_name, certificate_number, issue_date, expiry_date, issuing_body, card_number, card_date, competency_id, delivery_method, certification_type, location, is_lifetime, is_active, renewal_count, notes, renewal_action, renewal_cert_id FROM trx_certification WHERE cert_id = ?', [req.params.id]);
  if (!old.length) return res.status(404).json({ error: 'Not found' });

  await logAudit({
    table_name: 'trx_certification',
    record_id: req.params.id,
    operation: 'UPDATE',
    old_data: old[0],
    new_data: { employee_id, trx_id, sertif_name, certificate_number, issue_date, expiry_date, issuing_body, card_number, card_date, competency_id, delivery_method, certification_type, location, is_lifetime, is_active, renewal_count, notes, renewal_action, renewal_cert_id },
    changed_by: req.changedBy,
  });

  const [result] = await pool.query(
    `UPDATE trx_certification
     SET employee_id=?, trx_id=?, sertif_name=?, certificate_number=?, issue_date=?, expiry_date=?, issuing_body=?, card_number=?, card_date=?, competency_id=?, delivery_method=?, certification_type=?, location=?, is_lifetime=?, is_active=?, renewal_count=?, notes=?, renewal_action=?, renewal_cert_id=?
     WHERE cert_id=?`,
    [employee_id, trx_id || null, sertif_name, certificate_number || null, issue_date, is_lifetime ? null : (expiry_date || null), issuing_body || null, card_number || null, card_date || null, competency_id || null, delivery_method || 'Offline', certification_type || 'Eksternal', location || null, is_lifetime ?? 0, is_active ?? 1, renewal_count || 0, notes || null, renewal_action || null, renewal_cert_id || null, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
  res.json({ cert_id: parseInt(req.params.id) });
});

router.delete('/:id', async (req, res) => {
  const [old] = await pool.query('SELECT cert_id, employee_id, sertif_name, certificate_number, issue_date, issuing_body FROM trx_certification WHERE cert_id = ?', [req.params.id]);
  if (old.length) {
    await logAudit({
      table_name: 'trx_certification',
      record_id: req.params.id,
      operation: 'DELETE',
      old_data: old[0],
      changed_by: req.changedBy,
    });
  }

  await pool.query('DELETE FROM trx_certification WHERE cert_id = ?', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
