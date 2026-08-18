const express = require('express');
const router = express.Router();
const pool = require('../db');

const VALID_OPERATIONS = ['CREATE', 'UPDATE', 'DELETE'];

router.get('/', async (req, res) => {
  const { table_name, operation, limit = 100 } = req.query;
  const conditions = [];
  const params = [];

  if (table_name) { conditions.push('table_name = ?'); params.push(table_name); }
  if (operation) {
    if (!VALID_OPERATIONS.includes(operation)) {
      return res.status(400).json({ error: `operation must be one of: ${VALID_OPERATIONS.join(', ')}` });
    }
    conditions.push('operation = ?');
    params.push(operation);
  }

  const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 100), 1000);
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const [rows] = await pool.query(
    `SELECT log_id, table_name, record_id, operation, old_data, new_data, changed_by, changed_at FROM trx_audit_log${where} ORDER BY changed_at DESC LIMIT ?`,
    [...params, parsedLimit]
  );
  res.json(rows);
});

module.exports = router;
