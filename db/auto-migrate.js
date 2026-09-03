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

    // 2. instruktur & kompetensi
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS instruktur VARCHAR(100) NULL AFTER organizer
    `);
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS kompetensi TEXT NULL AFTER instruktur
    `);

    // 3. score_grand_total: TINYINT (max 127) overflows when sum of 4 scores > 127; use SMALLINT
    await conn.query(`
      ALTER TABLE trx_training_request
        MODIFY COLUMN IF EXISTS score_grand_total SMALLINT NULL DEFAULT NULL
    `).catch(() => {
      // Fallback for MySQL versions without MODIFY COLUMN IF EXISTS
      return conn.query(`
        ALTER TABLE trx_training_request
          MODIFY COLUMN score_grand_total SMALLINT NULL DEFAULT NULL
      `).catch(() => {});
    });

    // 4. is_scheduled
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS is_scheduled TINYINT(1) NOT NULL DEFAULT 0 AFTER submitted_by
    `);

    // 5. approval_status — ensure the column exists with the full ENUM set
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

    // 6. approval_token
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS approval_token VARCHAR(64) NULL AFTER approval_status
    `);

    // 7. approval_hrd_token
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS approval_hrd_token VARCHAR(64) NULL AFTER approval_token
    `);

    // 8. approver_name / approver_email / approver_position
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS approver_name     VARCHAR(100) NULL AFTER approval_hrd_token,
        ADD COLUMN IF NOT EXISTS approver_email    VARCHAR(150) NULL AFTER approver_name,
        ADD COLUMN IF NOT EXISTS approver_position VARCHAR(100) NULL AFTER approver_email
    `);

    // 9a. training_selesai — flag training sudah selesai, sembunyikan dari daftar hadir
    await conn.query(`
      ALTER TABLE trx_training_request
        ADD COLUMN IF NOT EXISTS training_selesai TINYINT(1) NOT NULL DEFAULT 0 AFTER approval_status
    `);

    console.log('[AutoMigrate] Schema trx_training_request OK');

    // 10. trx_certification: tambah kolom renewal_action dan renewal_cert_id
    //     untuk menyimpan status perpanjangan sertifikat
    await conn.query(`
      ALTER TABLE trx_certification
        ADD COLUMN IF NOT EXISTS renewal_action  VARCHAR(50) NULL AFTER notes,
        ADD COLUMN IF NOT EXISTS renewal_cert_id INT         NULL AFTER renewal_action
    `);
    console.log('[AutoMigrate] Schema trx_certification OK');

    // 9. cfg_approver_hrd — simplify: drop employee/personal columns, keep only email
    //    Ensure email column exists (for fresh installs from old schema)
    await conn.query(`
      ALTER TABLE cfg_approver_hrd
        ADD COLUMN IF NOT EXISTS email VARCHAR(150) NOT NULL DEFAULT '' AFTER id
    `).catch(() => {});
    //    Drop columns no longer needed (IF EXISTS guards against fresh installs)
    for (const col of ['employee_id', 'full_name', 'position', 'department']) {
      await conn.query(`ALTER TABLE cfg_approver_hrd DROP COLUMN IF EXISTS ${col}`).catch(() => {});
    }
    console.log('[AutoMigrate] Schema cfg_approver_hrd OK');

    // cfg_reminder_setting — konfigurasi reminder expiry sertifikasi
    // interval_value : seberapa sering reminder dikirim (angka)
    // frequency      : satuan interval (hari/minggu/bulan)
    // days_before    : mulai kirim reminder berapa hari sebelum expiry
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cfg_reminder_setting (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        interval_value  INT           NOT NULL DEFAULT 1,
        frequency       ENUM('hari','minggu','bulan') NOT NULL DEFAULT 'minggu',
        days_before     INT           NOT NULL DEFAULT 30,
        updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    console.log('[AutoMigrate] Schema cfg_reminder_setting OK');

    // cfg_cert_reminder_log — log kapan terakhir kali reminder dikirim per sertifikat
    // Dipakai scheduler untuk menentukan apakah interval sudah terpenuhi sebelum kirim ulang
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cfg_cert_reminder_log (
        log_id   INT      AUTO_INCREMENT PRIMARY KEY,
        cert_id  INT      NOT NULL,
        sent_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cert_sent (cert_id, sent_at)
      ) ENGINE=InnoDB
    `);
    console.log('[AutoMigrate] Schema cfg_cert_reminder_log OK');
  } catch (err) {
    console.error('[AutoMigrate] Error:', err.message);
    // Non-fatal: server still starts; routes will surface real DB errors.
  } finally {
    conn.release();
  }
}

module.exports = autoMigrate;
