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
});

pool.getConnection()
  .then(async connection => {
    console.log('✅ Berhasil terhubung ke database MySQL!');
    // Auto-migrate: pastikan tabel cfg_email_settings ada
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS cfg_email_settings (
          id               INT          AUTO_INCREMENT PRIMARY KEY,
          layer            ENUM('dept','hrd') NOT NULL UNIQUE,
          sender_name      VARCHAR(100) NULL,
          reply_to         VARCHAR(150) NULL,
          cc_emails        TEXT         NULL,
          subject_template VARCHAR(300) NULL,
          updated_at       DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          updated_by       VARCHAR(100) NULL
        ) ENGINE=InnoDB
      `);
      await connection.query(`
        INSERT IGNORE INTO cfg_email_settings (layer, sender_name, subject_template) VALUES
          ('dept', 'CCSI Training System', '[Persetujuan Diperlukan] Pelatihan: {training_name} — {department}'),
          ('hrd',  'CCSI Training System', '[Persetujuan HRD] Pelatihan: {training_name} — {department}')
      `);
      console.log('✅ Tabel cfg_email_settings siap.');
    } catch (e) {
      console.error('⚠️  Migrasi cfg_email_settings gagal:', e.message);
    }
    connection.release();
  })
  .catch(err => {
    console.error('❌ Gagal terhubung ke database:', err.message);
  });

module.exports = pool;
