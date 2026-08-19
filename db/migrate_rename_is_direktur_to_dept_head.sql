-- Rename column is_direktur -> is_dept_head in mst_employee
-- Direktur/BOD kini diidentifikasi via department (direksi/bod), bukan flag
-- Flag is_dept_head digunakan untuk menandai karyawan sebagai Dept Head

ALTER TABLE mst_employee
  CHANGE COLUMN is_direktur is_dept_head TINYINT(1) NOT NULL DEFAULT 0;
