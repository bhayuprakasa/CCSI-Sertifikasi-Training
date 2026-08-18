-- Migrasi: tambah kolom email dan is_direktur ke mst_employee
ALTER TABLE mst_employee
  ADD COLUMN email VARCHAR(100) NULL AFTER site,
  ADD COLUMN is_direktur TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;
