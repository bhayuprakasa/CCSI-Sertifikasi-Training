require('dotenv').config();
const pool = require('../db');
const fs = require('fs');
const path = require('path');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrate_add_approval.sql'), 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
  const conn = await pool.getConnection();
  try {
    for (const stmt of statements) {
      if (stmt.startsWith('--')) continue;
      console.log('Running:', stmt.substring(0, 60) + '...');
      await conn.query(stmt);
      console.log('  OK');
    }
    console.log('\nMigrasi approval selesai.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Kolom sudah ada, migrasi dilewati.');
    } else {
      console.error('Error:', e.message);
    }
  } finally {
    conn.release();
    process.exit(0);
  }
}
run();
