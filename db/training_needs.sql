USE ccsi_training;

CREATE TABLE IF NOT EXISTS trx_training_need (
  need_id         INT           AUTO_INCREMENT PRIMARY KEY,
  department      VARCHAR(50)   NOT NULL,
  training_type   ENUM('Sertifikasi','Training') NOT NULL,
  competency_desc TEXT          NOT NULL,
  training_name   VARCHAR(200)  NOT NULL,
  organizer       ENUM('Internal','Eksternal') NOT NULL,
  target_date     DATE          NOT NULL,
  estimated_cost  DECIMAL(15,2) NOT NULL DEFAULT 0,
  plan_year       INT           NOT NULL,
  submitted_by    VARCHAR(100)  NULL,
  submitted_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status          ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  score_peserta_atasan   TINYINT NULL DEFAULT NULL,
  score_peserta_hrd      TINYINT NULL DEFAULT NULL,
  score_materi_atasan    TINYINT NULL DEFAULT NULL,
  score_materi_hrd       TINYINT NULL DEFAULT NULL,
  score_grand_total      TINYINT NULL DEFAULT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trx_training_need_participant (
  participant_id  INT           AUTO_INCREMENT PRIMARY KEY,
  need_id         INT           NOT NULL,
  participant_name VARCHAR(100) NOT NULL,
  FOREIGN KEY (need_id) REFERENCES trx_training_need(need_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
