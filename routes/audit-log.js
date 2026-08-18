const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const { table_name, operation, limit = 100 } = req.query;
  const conditions = [];
  const params = [];

  if (table_name) { conditions.push('table_name = ?'); params.push(table_name); }
  if (operation)   { conditions.push('operation = ?');   params.push(operation); }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const [rows] = await pool.query(
    `SELECT * FROM trx_audit_log${where} ORDER BY changed_at DESC LIMIT ?`,
    [...params, parseInt(limit)]
  );
  res.json(rows);
});

module.exports = router;
