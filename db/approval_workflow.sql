USE ccsi_training;

-- =============================================
-- Approval Workflow Configuration
-- =============================================

CREATE TABLE IF NOT EXISTS cfg_approval_workflow (
  workflow_id   INT          AUTO_INCREMENT PRIMARY KEY,
  workflow_name VARCHAR(100) NOT NULL,
  form_type     VARCHAR(50)  NOT NULL COMMENT 'training_request | training_needs | certification',
  is_active     TINYINT      NOT NULL DEFAULT 1,
  description   TEXT         NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- Approval Layers per Workflow
-- =============================================

CREATE TABLE IF NOT EXISTS cfg_approval_layer (
  layer_id     INT          AUTO_INCREMENT PRIMARY KEY,
  workflow_id  INT          NOT NULL,
  layer_order  INT          NOT NULL COMMENT 'Urutan layer: 1, 2, 3...',
  layer_name   VARCHAR(100) NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES cfg_approval_workflow(workflow_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_workflow_order (workflow_id, layer_order)
) ENGINE=InnoDB;

-- =============================================
-- Approvers per Layer with Criteria
-- =============================================

CREATE TABLE IF NOT EXISTS cfg_approval_approver (
  approver_id    INT          AUTO_INCREMENT PRIMARY KEY,
  layer_id       INT          NOT NULL,
  approver_name  VARCHAR(100) NOT NULL,
  approver_email VARCHAR(150) NOT NULL,
  approver_role  VARCHAR(100) NULL,
  -- Criteria: kondisi kapan approver ini aktif
  criteria_type  ENUM('always','cost_above','cost_range','department','training_type','combined')
                 NOT NULL DEFAULT 'always',
  criteria_value TEXT         NULL COMMENT 'JSON: {"min":0,"max":10000} / "Eksternal" / ["HR","Finance"] / combined rules',
  FOREIGN KEY (layer_id) REFERENCES cfg_approval_layer(layer_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =============================================
-- Approval Instances (runtime per submission)
-- =============================================

CREATE TABLE IF NOT EXISTS trx_approval_instance (
  instance_id  INT          AUTO_INCREMENT PRIMARY KEY,
  workflow_id  INT          NOT NULL,
  form_type    VARCHAR(50)  NOT NULL,
  form_id      INT          NOT NULL COMMENT 'ID dari form terkait (request_id, etc.)',
  current_layer INT         NOT NULL DEFAULT 1,
  overall_status ENUM('Pending','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_form (form_type, form_id)
) ENGINE=InnoDB;

-- Approval per layer per instance
CREATE TABLE IF NOT EXISTS trx_approval_step (
  step_id       INT          AUTO_INCREMENT PRIMARY KEY,
  instance_id   INT          NOT NULL,
  layer_id      INT          NOT NULL,
  layer_order   INT          NOT NULL,
  approver_id   INT          NOT NULL,
  approver_name VARCHAR(100) NOT NULL,
  approver_email VARCHAR(150) NOT NULL,
  token         VARCHAR(64)  NULL UNIQUE,
  status        ENUM('Waiting','Pending','Approved','Rejected','Skipped') NOT NULL DEFAULT 'Waiting',
  notes         TEXT         NULL,
  acted_at      DATETIME     NULL,
  FOREIGN KEY (instance_id) REFERENCES trx_approval_instance(instance_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
