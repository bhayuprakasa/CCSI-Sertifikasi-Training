const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ccsi_training',
  });

  try {
    const [existing] = await conn.query(
      "SELECT employee_id FROM mst_employee WHERE employee_id = 'CC011'"
    );

    if (existing.length > 0) {
      console.log('✅ Annisa (CC011) sudah ada — tidak perlu insert ulang.');
      return;
    }

    await conn.query(
      `INSERT INTO mst_employee
        (employee_id, full_name, department, position, site, email, employment_status, join_date, is_active, is_dept_head)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['CC011', 'Annisa', 'BOD', 'Direktur', 'HO Jakarta', null, 'PKWTT', '2020-01-01', 1, 0]
    );

    console.log('✅ Annisa (CC011) dept BOD berhasil ditambahkan ke MySQL.');
  } finally {
    await conn.end();
  }
}

run().catch(err => {
  console.error('❌ Gagal:', err.message);
  process.exit(1);
});
