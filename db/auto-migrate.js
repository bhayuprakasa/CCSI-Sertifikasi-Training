const pool = require('../db');

/**
 * Ensures all required columns exist in trx_training_request.
 * Uses IF NOT EXISTS so it is safe to run on every startup.
 */
async function autoMigrate() {
  const conn = await pool.getConnection();
  try {
    // 1. actual_date_start / actual_date_end
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS actual_date_start DATE NULL DEFAULT NULL AFTER training_date_end,
        ADD COLUMN IF NOT EXISTS actual_date_end   DATE NULL DEFAULT NULL AFTER actual_date_start
    `);

    // 2. kompetensi
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS kompetensi TEXT NULL AFTER organizer
    `);

    // 3. is_scheduled
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS is_scheduled TINYINT(1) NOT NULL DEFAULT 0 AFTER submitted_by
    `);

    // 4. approval_status — ensure the column exists with the full ENUM set
    //    We check first; if missing, create it; if present, MODIFY to include all values.
    const [cols] = await conn.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'trx_training_request'
        AND COLUMN_NAME  = 'approval_status'
    `);

    if (!cols.length) {
      await conn.query(`
        ALTER TABLE trx_training_request
          ADD COLUMN approval_status ENUM(
            'Submitted','PendingBODDept','PendingBODHR',
            'Approved','Rejected_BODDept','Rejected_BODHR','Submitted_HR'
          ) NOT NULL DEFAULT 'Submitted' AFTER is_scheduled
      `);
    } else {
      // Expand ENUM to include all required values (safe even if already present)
      await conn.query(`
        ALTER TABLE trx_training_request
          MODIFY COLUMN approval_status ENUM(
            'Submitted','Pending','PendingHRD','PendingBODDept','PendingBODHR',
            'Approved','Rejected','Rejected_Dept','Rejected_HRD',
            'Rejected_BODDept','Rejected_BODHR','Submitted_HR'
          ) NOT NULL DEFAULT 'Submitted'
      `);
    }

    // 5. approval_token
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS approval_token VARCHAR(64) NULL AFTER approval_status
    `);

    // 6. approval_hrd_token
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS approval_hrd_token VARCHAR(64) NULL AFTER approval_token
    `);

    // 7. approver_name / approver_email / approver_position
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS approver_name     VARCHAR(100) NULL AFTER approval_hrd_token,
        ADD COLUMN IF NOT EXISTS approver_email    VARCHAR(150) NULL AFTER approver_name,
        ADD COLUMN IF NOT EXISTS approver_position VARCHAR(100) NULL AFTER approver_email
    `);

    console.log('[AutoMigrate] Schema trx_training_request OK');
  } catch (err) {
    console.error('[AutoMigrate] Error:', err.message);
    // Non-fatal: server still starts; routes will surface real DB errors.
  } finally {
    conn.release();
  }
}

module.exports = autoMigrate;
