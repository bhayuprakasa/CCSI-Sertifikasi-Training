require('dotenv').config();
const pool = require('../db');
async function check() {
  const conn = await pool.getConnection();
  const [rows] = await conn.query("SHOW TABLES LIKE 'cfg_%'");
  console.log('cfg_ tables:', rows.map(r => Object.values(r)[0]));
  const [db] = await conn.query('SELECT DATABASE() as db');
  console.log('Database:', db[0].db);
  conn.release();
  process.exit(0);
}
check().catch(e => { console.error(e.message); process.exit(1); });
