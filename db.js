const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ccsi_training',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Auto-migrate on startup: pastikan approval_status ENUM menyertakan 'Submitted'
pool.getConnection()
  .then(async conn => {
    try {
      const [rows] = await conn.query(`
        SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'trx_training_request'
          AND COLUMN_NAME = 'approval_status'
      `);
      if (rows.length > 0 && !rows[0].COLUMN_TYPE.includes("'Submitted'")) {
        await conn.query(`
          ALTER TABLE trx_training_request
            MODIFY COLUMN approval_status
              ENUM('Submitted','PendingBODDept','PendingBODHR','Approved','Rejected_BODDept','Rejected_BODHR','Submitted_HR')
              NOT NULL DEFAULT 'Submitted'
        `);
        console.log('✅ Migrasi approval_status: nilai Submitted ditambahkan.');
      }
    } catch (e) {
      console.error('⚠️  Migrasi approval_status gagal:', e.message);
    } finally {
      conn.release();
    }
  })
  .catch(() => {});

module.exports = pool;
