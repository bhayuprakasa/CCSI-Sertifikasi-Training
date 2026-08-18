CREATE TABLE IF NOT EXISTS trx_audit_log (
  log_id      INT AUTO_INCREMENT PRIMARY KEY,
  table_name  VARCHAR(100) NOT NULL,
  record_id   VARCHAR(50)  NOT NULL,
  operation   ENUM('UPDATE','DELETE') NOT NULL,
  old_data    JSON,
  new_data    JSON,
  changed_by  VARCHAR(100) DEFAULT NULL,
  changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_changed_at   (changed_at)
);
