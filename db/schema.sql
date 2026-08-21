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

CREATE TABLE IF NOT EXISTS mst_program (
  program_id      INT           AUTO_INCREMENT PRIMARY KEY,
  program_name    VARCHAR(200)  NOT NULL,
  program_type    ENUM('Training','Sosialisasi','Sertifikasi') NOT NULL,
  competency_id   INT           NULL,
  delivery_method ENUM('Offline','Online','Hybrid','Vendor') NOT NULL DEFAULT 'Offline',
  conducted_by    VARCHAR(100)  NULL,
  trainer_name    VARCHAR(100)  NULL,
  location        VARCHAR(100)  NULL,
  is_mandatory    TINYINT(1)    NOT NULL DEFAULT 0,
  program_status  ENUM('Waiting','On Process','Done') NOT NULL DEFAULT 'Waiting',
  start_date      DATE          NULL,
  end_date        DATE          NULL,
  organizer_type  ENUM('Internal','Eksternal') NOT NULL DEFAULT 'Eksternal',
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (competency_id) REFERENCES mst_competency(competency_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- TRANSACTION TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS trx_employee_program (
  trx_id          INT           AUTO_INCREMENT PRIMARY KEY,
  employee_id     VARCHAR(20)   NOT NULL,
  program_id      INT           NOT NULL,
  start_date      DATE          NULL,
  end_date        DATE          NULL,
  status          ENUM('Done','Ongoing','Failed','Cancelled') NOT NULL DEFAULT 'Ongoing',
  aktivitas       VARCHAR(200)  NULL,
  pre_test_score  DECIMAL(5,2)  NULL,
  post_test_score DECIMAL(5,2)  NULL,
  reaction_score  DECIMAL(5,2)  NULL,
  training_cost   DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes           TEXT          NULL,
  recorded_by     VARCHAR(50)   NULL,
  FOREIGN KEY (employee_id) REFERENCES mst_employee(employee_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (program_id) REFERENCES mst_program(program_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

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
  FOREIGN KEY (trx_id) REFERENCES trx_employee_program(trx_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
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
  training_venue       VARCHAR(200)  NULL,
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

-- ============================================================
-- APPROVAL WORKFLOW CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS cfg_approval_workflow (
  workflow_id   INT          AUTO_INCREMENT PRIMARY KEY,
  workflow_name VARCHAR(100) NOT NULL,
  form_type     VARCHAR(50)  NOT NULL COMMENT 'training_request | training_needs | certification',
  is_active     TINYINT      NOT NULL DEFAULT 1,
  description   TEXT         NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cfg_approval_layer (
  layer_id        INT          AUTO_INCREMENT PRIMARY KEY,
  workflow_id     INT          NOT NULL,
  layer_order     INT          NOT NULL COMMENT 'Urutan layer: 1, 2, 3...',
  layer_name      VARCHAR(100) NOT NULL,
  criteria_field  VARCHAR(50)  NOT NULL DEFAULT 'all_employee',
  criteria_value  TEXT         NULL,
  auto_ascend     TINYINT      NOT NULL DEFAULT 0,
  FOREIGN KEY (workflow_id) REFERENCES cfg_approval_workflow(workflow_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_workflow_order (workflow_id, layer_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cfg_approval_approver (
  approver_id      INT          AUTO_INCREMENT PRIMARY KEY,
  layer_id         INT          NOT NULL,
  approver_order   INT          NOT NULL DEFAULT 1,
  approver_field   VARCHAR(50)  NOT NULL DEFAULT 'employee_id',
  approver_action  VARCHAR(50)  NOT NULL DEFAULT 'requested',
  approver_value   VARCHAR(100) NULL,
  approver_display VARCHAR(100) NULL,
  approver_name    VARCHAR(100) NOT NULL,
  approver_email   VARCHAR(150) NOT NULL,
  approver_role    VARCHAR(100) NULL,
  criteria_type    ENUM('always','cost_above','cost_range','department','training_type','combined')
                   NOT NULL DEFAULT 'always',
  criteria_value   TEXT         NULL COMMENT 'JSON criteria config',
  FOREIGN KEY (layer_id) REFERENCES cfg_approval_layer(layer_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trx_approval_instance (
  instance_id    INT          AUTO_INCREMENT PRIMARY KEY,
  workflow_id    INT          NOT NULL,
  form_type      VARCHAR(50)  NOT NULL,
  form_id        INT          NOT NULL COMMENT 'ID dari form terkait (request_id, etc.)',
  current_layer  INT          NOT NULL DEFAULT 1,
  overall_status ENUM('Pending','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_form (form_type, form_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trx_approval_step (
  step_id        INT          AUTO_INCREMENT PRIMARY KEY,
  instance_id    INT          NOT NULL,
  layer_id       INT          NOT NULL,
  layer_order    INT          NOT NULL,
  approver_id    INT          NOT NULL,
  approver_name  VARCHAR(100) NOT NULL,
  approver_email VARCHAR(150) NOT NULL,
  token          VARCHAR(64)  NULL UNIQUE,
  status         ENUM('Waiting','Pending','Approved','Rejected','Skipped') NOT NULL DEFAULT 'Waiting',
  notes          TEXT         NULL,
  acted_at       DATETIME     NULL,
  FOREIGN KEY (instance_id) REFERENCES trx_approval_instance(instance_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cfg_approver_hrd (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  employee_id  VARCHAR(20)  NOT NULL,
  full_name    VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NULL,
  position     VARCHAR(100) NULL,
  department   VARCHAR(100) NULL,
  set_at       DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
