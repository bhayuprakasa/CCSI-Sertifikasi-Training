const pool = require('../db');

async function logAudit({ table_name, record_id, operation, old_data, new_data, changed_by }) {
  try {
    await pool.query(
      'INSERT INTO trx_audit_log (table_name, record_id, operation, old_data, new_data, changed_by) VALUES (?,?,?,?,?,?)',
      [
        table_name,
        String(record_id),
        operation,
        old_data != null ? JSON.stringify(old_data) : null,
        new_data != null ? JSON.stringify(new_data) : null,
        changed_by || null,
      ]
    );
  } catch (e) {
    console.error('[AuditLog] Failed to write log:', e.message);
  }
}

module.exports = { logAudit };
