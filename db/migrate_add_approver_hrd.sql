-- Tabel konfigurasi Approver Direktur HRD
-- Hanya menyimpan 1 baris (approver aktif)
CREATE TABLE IF NOT EXISTS cfg_approver_hrd (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  employee_id  VARCHAR(20)  NOT NULL,
  full_name    VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NULL,
  position     VARCHAR(100) NULL,
  department   VARCHAR(100) NULL,
  set_at       DATETIME     DEFAULT CURRENT_TIMESTAMP
);
