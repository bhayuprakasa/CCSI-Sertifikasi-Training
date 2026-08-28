-- CCSI Training Dashboard — complete schema
-- Run this on a fresh database instead of applying individual migration files.
-- For existing databases, run only the migrate_*.sql files that have not been applied yet.

CREATE DATABASE IF NOT EXISTS ccsi_training
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ccsi_training;

-- ============================================================
-- MASTER TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS mst_employee (
  employee_id        VARCHAR(20)   PRIMARY KEY,
  full_name          VARCHAR(100)  NOT NULL,
  department         VARCHAR(50)   NOT NULL,
  position           VARCHAR(50)   NOT NULL,
  site               ENUM('HO Jakarta','Cilegon') NOT NULL,
  email              VARCHAR(100)  NULL,
  employment_status  ENUM('PKWTT','PKWT') NOT NULL DEFAULT 'PKWTT',
  join_date          DATE          NULL,
  is_active          TINYINT(1)    NOT NULL DEFAULT 1,
  is_dept_head       TINYINT(1)    NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mst_competency (
  competency_id   INT           AUTO_INCREMENT PRIMARY KEY,
  competency_name VARCHAR(100)  NOT NULL,
  competency_type ENUM('Hard Skill','Soft Skill','Safety','Leadership') NOT NULL,
  category        VARCHAR(50)   NULL
) ENGINE=InnoDB;

-- ============================================================
-- TRANSACTION TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS trx_certification (
  cert_id             INT           AUTO_INCREMENT PRIMARY KEY,
  employee_id         VARCHAR(20)   NOT NULL,
  trx_id              INT           NULL,
  sertif_name         VARCHAR(200)  NOT NULL,
  certificate_number  VARCHAR(100)  NULL,
  issue_date          DATE          NOT NULL,
  expiry_date         DATE          NULL,
  issuing_body        VARCHAR(100)  NULL,
  card_number         VARCHAR(50)   NULL,
  card_date           DATE          NULL,
  competency_id       INT           NULL,
  delivery_method     ENUM('Online','Offline') NOT NULL DEFAULT 'Offline',
  certification_type  ENUM('Internal','Eksternal') NOT NULL DEFAULT 'Eksternal',
  location            VARCHAR(100)  NULL,
  is_lifetime         TINYINT(1)    NOT NULL DEFAULT 0,
  is_active           TINYINT(1)    NOT NULL DEFAULT 1,
  renewal_count       INT           NOT NULL DEFAULT 0,
  notes               TEXT          NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES mst_employee(employee_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (competency_id) REFERENCES mst_competency(competency_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- TRAINING NEED (TNA)
-- ============================================================

CREATE TABLE IF NOT EXISTS trx_training_need (
  need_id                INT           AUTO_INCREMENT PRIMARY KEY,
  department             VARCHAR(50)   NOT NULL,
  training_type          ENUM('Sertifikasi','Training') NOT NULL,
  competency_desc        TEXT          NOT NULL,
  training_name          VARCHAR(200)  NOT NULL,
  organizer              ENUM('Internal','Eksternal') NOT NULL,
  target_date            DATE          NOT NULL,
  estimated_cost         DECIMAL(15,2) NOT NULL DEFAULT 0,
  plan_year              INT           NOT NULL,
  submitted_by           VARCHAR(100)  NULL,
  submitted_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status                 ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  score_peserta_atasan   TINYINT       NULL DEFAULT NULL,
  score_peserta_hrd      TINYINT       NULL DEFAULT NULL,
  score_materi_atasan    TINYINT       NULL DEFAULT NULL,
  score_materi_hrd       TINYINT       NULL DEFAULT NULL,
  score_grand_total      TINYINT       NULL DEFAULT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trx_training_need_participant (
  participant_id   INT           AUTO_INCREMENT PRIMARY KEY,
  need_id          INT           NOT NULL,
  participant_name VARCHAR(100)  NOT NULL,
  FOREIGN KEY (need_id) REFERENCES trx_training_need(need_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TRAINING REQUEST (Permohonan Pelatihan)
-- ============================================================

CREATE TABLE IF NOT EXISTS trx_training_request (
  request_id           INT           AUTO_INCREMENT PRIMARY KEY,
  department           VARCHAR(50)   NOT NULL,
  training_name        VARCHAR(200)  NOT NULL,
  training_date_start  DATE          NOT NULL,
  training_date_end    DATE          NULL,
  actual_date_start    DATE          NULL DEFAULT NULL,
  actual_date_end      DATE          NULL DEFAULT NULL,
  training_type        ENUM('Internal','Eksternal') NOT NULL,
  organizer            VARCHAR(100)  NULL,
  training_reason      TEXT          NULL,

  cost_training_fee    DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_akomodasi       DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_transport       DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_makan           DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_snack           DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_emergency       DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_total           DECIMAL(15,2) NOT NULL DEFAULT 0,

  eq_proyektor         TINYINT NOT NULL DEFAULT 0,
  eq_laptop            TINYINT NOT NULL DEFAULT 0,
  eq_kabel_hdmi        TINYINT NOT NULL DEFAULT 0,
  eq_pointer           TINYINT NOT NULL DEFAULT 0,
  eq_flipchart         TINYINT NOT NULL DEFAULT 0,
  eq_notebook          TINYINT NOT NULL DEFAULT 0,
  eq_ruangan           TINYINT NOT NULL DEFAULT 0,
  eq_colokan           TINYINT NOT NULL DEFAULT 0,
  coffee_break         TINYINT NOT NULL DEFAULT 0,

  score_peserta_atasan TINYINT       NULL DEFAULT NULL,
  score_peserta_hrd    TINYINT       NULL DEFAULT NULL,
  score_materi_atasan  TINYINT       NULL DEFAULT NULL,
  score_materi_hrd     TINYINT       NULL DEFAULT NULL,
  score_grand_total    TINYINT       NULL DEFAULT NULL,

  submitted_by         VARCHAR(100)  NULL,
  submitted_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_scheduled         TINYINT(1)    NOT NULL DEFAULT 0,
  approval_status      ENUM('Submitted','PendingBODDept','PendingBODHR','Approved','Rejected_BODDept','Rejected_BODHR','Submitted_HR')
                       NOT NULL DEFAULT 'Submitted',
  approval_token       VARCHAR(64)   NULL UNIQUE,
  approval_hrd_token   VARCHAR(64)   NULL UNIQUE,
  approver_name        VARCHAR(100)  NULL,
  approver_email       VARCHAR(150)  NULL,
  approver_position    VARCHAR(100)  NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trx_training_request_participant (
  participant_id   INT           AUTO_INCREMENT PRIMARY KEY,
  request_id       INT           NOT NULL,
  participant_name VARCHAR(100)  NOT NULL,
  FOREIGN KEY (request_id) REFERENCES trx_training_request(request_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TRAINING ATTENDANCE (Absensi)
-- ============================================================

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
  eval_json        TEXT          NULL,
  FOREIGN KEY (attendance_id) REFERENCES trx_training_attendance(attendance_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS trx_audit_log (
  log_id      INT           AUTO_INCREMENT PRIMARY KEY,
  table_name  VARCHAR(100)  NOT NULL,
  record_id   VARCHAR(50)   NOT NULL,
  operation   ENUM('CREATE','UPDATE','DELETE') NOT NULL,
  old_data    JSON,
  new_data    JSON,
  changed_by  VARCHAR(100)  DEFAULT NULL,
  changed_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_changed_at   (changed_at)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS cfg_approver_hrd (
  id     INT          AUTO_INCREMENT PRIMARY KEY,
  email  VARCHAR(150) NOT NULL,
  set_at DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
