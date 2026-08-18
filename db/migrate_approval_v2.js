require('dotenv').config();
const pool = require('../db');

const MIGRATIONS = [
  {
    name: 'cfg_approval_layer: add criteria columns',
    sql: `ALTER TABLE cfg_approval_layer
      ADD COLUMN criteria_field VARCHAR(50) NOT NULL DEFAULT 'all_employee' AFTER layer_name,
      ADD COLUMN criteria_value VARCHAR(200) NULL AFTER criteria_field,
      ADD COLUMN auto_ascend TINYINT NOT NULL DEFAULT 0 AFTER criteria_value`,
  },
  {
    name: 'cfg_approval_approver: add dynamic approver columns',
    sql: `ALTER TABLE cfg_approval_approver
      ADD COLUMN approver_order INT NOT NULL DEFAULT 1 AFTER layer_id,
      ADD COLUMN approver_field VARCHAR(50) NOT NULL DEFAULT 'employee_id' AFTER approver_order,
      ADD COLUMN approver_action VARCHAR(50) NOT NULL DEFAULT 'requested' AFTER approver_field,
      ADD COLUMN approver_value VARCHAR(200) NULL AFTER approver_action,
      ADD COLUMN approver_display VARCHAR(200) NULL AFTER approver_value`,
  },
];

async function run() {
  const conn = await pool.getConnection();
  try {
    for (const m of MIGRATIONS) {
      try {
        await conn.query(m.sql);
        console.log('✅', m.name);
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
          console.log('⏭  (sudah ada):', m.name);
        } else {
          throw e;
        }
      }
    }
    console.log('\n✅ Approval v2 migration selesai!');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
