/**
 * Script diagnostik & fix: approval_status ENUM
 * Jalankan di server: node db/fix_approval_status.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ccsi_training',
  });

  try {
    // 1. Cek definisi kolom saat ini
    const [cols] = await conn.query(`
      SELECT COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'trx_training_request'
        AND COLUMN_NAME = 'approval_status'
    `);

    if (!cols.length) {
      console.log('❌ Kolom approval_status tidak ditemukan!');
      return;
    }

    const colType = cols[0].COLUMN_TYPE;
    console.log('\n📋 Definisi kolom saat ini:');
    console.log('   COLUMN_TYPE :', colType);
    console.log('   DEFAULT     :', cols[0].COLUMN_DEFAULT);
    console.log('   IS_NULLABLE :', cols[0].IS_NULLABLE);

    const hasSubmitted = colType.includes("'Submitted'");
    console.log('\n✅ Nilai Submitted ada di ENUM:', hasSubmitted ? 'YA' : 'TIDAK ← ini masalahnya!');

    // 2. Cek data aktual (5 record terbaru)
    const [rows] = await conn.query(`
      SELECT request_id, training_name, approval_status, submitted_at
      FROM trx_training_request
      ORDER BY request_id DESC LIMIT 5
    `);
    console.log('\n📊 5 record terbaru:');
    rows.forEach(r => {
      const s = r.approval_status === '' ? '(empty string! ← ini masalahnya)' : (r.approval_status || '(NULL!)');
      console.log(`   #${r.request_id} | ${r.training_name} | "${s}" | ${r.submitted_at}`);
    });

    // 3. Perbaiki ENUM jika belum ada 'Submitted'
    if (!hasSubmitted) {
      console.log('\n🔧 Menjalankan ALTER TABLE...');
      await conn.query(`
        ALTER TABLE trx_training_request
          MODIFY COLUMN approval_status
            ENUM('Submitted','PendingBODDept','PendingBODHR','Approved','Rejected_BODDept','Rejected_BODHR','Submitted_HR')
            NOT NULL DEFAULT 'Submitted'
      `);
      console.log('✅ ALTER berhasil!');
    }

    // 4. Perbaiki record yang tersimpan sebagai empty string
    const [empties] = await conn.query(
      `SELECT COUNT(*) as cnt FROM trx_training_request WHERE approval_status = '' OR approval_status IS NULL`
    );
    if (empties[0].cnt > 0) {
      const [upd] = await conn.query(
        `UPDATE trx_training_request SET approval_status = 'Submitted' WHERE approval_status = '' OR approval_status IS NULL`
      );
      console.log(`✅ ${upd.affectedRows} record diperbaiki ke status Submitted.`);
    } else {
      console.log('\n✅ Tidak ada record dengan status kosong.');
    }

    console.log('\n✅ Selesai. Restart aplikasi Node.js agar perubahan db.js berlaku.\n');
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
