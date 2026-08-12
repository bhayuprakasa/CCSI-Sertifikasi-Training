const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ccsi_training',
  });

  try {
    // Cek apakah kolom sudah ada
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trx_training_attendance_participant'
       AND COLUMN_NAME = 'eval_json'`
    );

    if (cols.length > 0) {
      console.log('✅ Kolom eval_json sudah ada — tidak perlu migrasi.');
    } else {
      await conn.query(
        `ALTER TABLE trx_training_attendance_participant
         ADD COLUMN eval_json TEXT NULL AFTER employee_name`
      );
      console.log('✅ Kolom eval_json berhasil ditambahkan!');
    }
  } finally {
    await conn.end();
  }
}

migrate().catch(err => {
  console.error('❌ Migrasi gagal:', err.message);
  process.exit(1);
});
