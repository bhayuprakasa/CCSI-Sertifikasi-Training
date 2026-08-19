-- Konfigurasi pengiriman email approval per layer
CREATE TABLE IF NOT EXISTS cfg_email_settings (
  id               INT          AUTO_INCREMENT PRIMARY KEY,
  layer            ENUM('dept','hrd') NOT NULL UNIQUE,
  sender_name      VARCHAR(100) NULL     COMMENT 'Nama pengirim (display name)',
  reply_to         VARCHAR(150) NULL     COMMENT 'Alamat reply-to',
  cc_emails        TEXT         NULL     COMMENT 'Daftar CC, dipisah koma',
  subject_template VARCHAR(300) NULL     COMMENT 'Template subject — gunakan {training_name}, {department}, {request_id}',
  updated_at       DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       VARCHAR(100) NULL
) ENGINE=InnoDB;

-- Seed default agar langsung bisa dipakai
INSERT IGNORE INTO cfg_email_settings (layer, sender_name, subject_template) VALUES
  ('dept', 'CCSI Training System', '[Persetujuan Diperlukan] Pelatihan: {training_name} — {department}'),
  ('hrd',  'CCSI Training System', '[Persetujuan HRD] Pelatihan: {training_name} — {department}');
