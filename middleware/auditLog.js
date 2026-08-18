const pool = require('../db');

// Pass `conn` to run the log inside an existing transaction
async function logAudit({ table_name, record_id, operation, old_data, new_data, changed_by, conn }) {
  try {
    const db = conn || pool;
    await db.query(
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
