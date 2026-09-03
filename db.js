const mysql = require('mysql2/promise');
require('dotenv').config();

if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
  console.error("🚨 ERROR: Konfigurasi Database (DB_HOST, DB_USER, DB_NAME) belum disetting di .env!");
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true, // return DATE/DATETIME as strings, prevents UTC timezone shift
});

pool.getConnection()
  .then(async connection => {
    console.log('✅ Berhasil terhubung ke database MySQL!');
    // Auto-migrate: pastikan tabel cfg_email_settings ada
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS cfg_email_settings (
          id               INT          AUTO_INCREMENT PRIMARY KEY,
          layer            ENUM('dept','hrd','cert') NOT NULL UNIQUE,
          sender_name      VARCHAR(100) NULL,
          reply_to         VARCHAR(150) NULL,
          cc_emails        TEXT         NULL,
          subject_template VARCHAR(300) NULL,
          updated_at       DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          updated_by       VARCHAR(100) NULL
        ) ENGINE=InnoDB
      `);
      // Jika tabel sudah ada dengan ENUM lama, tambahkan nilai 'cert' ke ENUM
      await connection.query(`
        ALTER TABLE cfg_email_settings
          MODIFY COLUMN layer ENUM('dept','hrd','cert') NOT NULL
      `).catch(err => {
        // Catat warning agar error nyata (privilege, lock) tidak hilang diam-diam
        console.warn('[db] ALTER TABLE cfg_email_settings:', err.message);
      });
      await connection.query(`
        INSERT IGNORE INTO cfg_email_settings (layer, sender_name, subject_template) VALUES
          ('dept', 'CCSI Training System', '[Persetujuan Diperlukan] Pelatihan: {training_name} — {department}'),
          ('hrd',  'CCSI Training System', '[Persetujuan HR] Pelatihan: {training_name} — {department}'),
          ('cert', 'CCSI Sertifikasi', '[Reminder] Sertifikat {cert_name} — {employee_name} berakhir {expiry_date}')
      `);
      console.log('✅ Tabel cfg_email_settings siap.');
    } catch (e) {
      console.error('⚠️  Migrasi cfg_email_settings gagal:', e.message);
    }

    // Auto-migrate: pastikan approval_status ENUM menyertakan 'Submitted'
    try {
      const [colRows] = await connection.query(`
        SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'trx_training_request'
          AND COLUMN_NAME = 'approval_status'
      `);
      if (colRows.length > 0 && !colRows[0].COLUMN_TYPE.includes("'Submitted'")) {
        await connection.query(`
          ALTER TABLE trx_training_request
            MODIFY COLUMN approval_status
              ENUM('Submitted','PendingBODDept','PendingBODHR','Approved','Rejected_BODDept','Rejected_BODHR','Submitted_HR')
              NOT NULL DEFAULT 'Submitted'
        `);
        // Perbaiki record lama yang tersimpan sebagai string kosong akibat ENUM tidak valid
        await connection.query(`
          UPDATE trx_training_request
          SET approval_status = 'Submitted'
          WHERE approval_status = ''
        `);
        console.log('✅ Migrasi approval_status: nilai Submitted ditambahkan dan record diperbaiki.');
      }
    } catch (e) {
      console.error('⚠️  Migrasi approval_status gagal:', e.message);
    }

    connection.release();
  })
  .catch(err => {
    console.error('❌ Gagal terhubung ke database:', err.message);
  });

module.exports = pool;
