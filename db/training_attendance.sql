USE ccsi_training;

CREATE TABLE IF NOT EXISTS trx_training_attendance (
  attendance_id        INT           AUTO_INCREMENT PRIMARY KEY,
  training_title       VARCHAR(200)  NOT NULL,
  instructor           VARCHAR(100)  NULL,
  location             VARCHAR(200)  NULL,
  department           VARCHAR(50)   NOT NULL,
  training_date_start  DATE          NULL,
  training_date_end    DATE          NULL,
  submitted_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trx_training_attendance_participant (
  participant_id   INT           AUTO_INCREMENT PRIMARY KEY,
  attendance_id    INT           NOT NULL,
  employee_id      VARCHAR(20)   NOT NULL,
  employee_name    VARCHAR(100)  NOT NULL,
  FOREIGN KEY (attendance_id) REFERENCES trx_training_attendance(attendance_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
