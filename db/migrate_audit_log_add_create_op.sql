-- Tambah nilai 'CREATE' ke ENUM operation di trx_audit_log
-- Diperlukan karena POST /api/employees mencatat operasi CREATE
ALTER TABLE trx_audit_log
  MODIFY COLUMN operation ENUM('CREATE','UPDATE','DELETE') NOT NULL;
