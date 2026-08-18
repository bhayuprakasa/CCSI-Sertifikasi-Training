USE ccsi_training;

ALTER TABLE trx_training_request
  ADD COLUMN is_scheduled TINYINT(1) NOT NULL DEFAULT 0
  AFTER submitted_by;
