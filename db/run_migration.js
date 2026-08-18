const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ccsi_training',
    multipleStatements: true,
  });
  try {
    const sql = fs.readFileSync(__dirname + '/migrate_add_is_scheduled.sql', 'utf8');
    await conn.query(sql);
    console.log('Migration berhasil: kolom is_scheduled ditambahkan.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Kolom is_scheduled sudah ada, tidak perlu migrasi.');
    } else {
      console.error('Migration gagal:', e.message);
    }
  } finally {
    await conn.end();
  }
})();
