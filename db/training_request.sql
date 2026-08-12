USE ccsi_training;

CREATE TABLE IF NOT EXISTS trx_training_request (
  request_id       INT           AUTO_INCREMENT PRIMARY KEY,
  department       VARCHAR(50)   NOT NULL,
  training_name    VARCHAR(200)  NOT NULL,
  training_venue   VARCHAR(200)  NULL,
  training_date_start DATE       NOT NULL,
  training_date_end   DATE       NULL,
  training_type    ENUM('Internal','Eksternal') NOT NULL,
  organizer        VARCHAR(100)  NULL,
  training_reason  TEXT          NULL,

  -- Biaya (untuk eksternal)
  cost_training_fee DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_akomodasi    DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_transport    DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_makan        DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_snack        DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_emergency    DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_total        DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Peralatan
  eq_proyektor     TINYINT NOT NULL DEFAULT 0,
  eq_laptop        TINYINT NOT NULL DEFAULT 0,
  eq_kabel_hdmi    TINYINT NOT NULL DEFAULT 0,
  eq_pointer       TINYINT NOT NULL DEFAULT 0,
  eq_flipchart     TINYINT NOT NULL DEFAULT 0,
  eq_notebook      TINYINT NOT NULL DEFAULT 0,
  eq_ruangan       TINYINT NOT NULL DEFAULT 0,
  eq_colokan       TINYINT NOT NULL DEFAULT 0,
  coffee_break     TINYINT NOT NULL DEFAULT 0,

  -- Scoring
  score_peserta_atasan  TINYINT NULL DEFAULT NULL,
  score_peserta_hrd     TINYINT NULL DEFAULT NULL,
  score_materi_atasan   TINYINT NULL DEFAULT NULL,
  score_materi_hrd      TINYINT NULL DEFAULT NULL,
  score_grand_total     TINYINT NULL DEFAULT NULL,

  submitted_by     VARCHAR(100)  NULL,
  submitted_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status           ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trx_training_request_participant (
  participant_id   INT           AUTO_INCREMENT PRIMARY KEY,
  request_id       INT           NOT NULL,
  participant_name VARCHAR(100)  NOT NULL,
  FOREIGN KEY (request_id) REFERENCES trx_training_request(request_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
