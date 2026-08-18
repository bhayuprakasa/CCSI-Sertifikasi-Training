USE ccsi_training;

ALTER TABLE mst_program
  ADD COLUMN IF NOT EXISTS program_status  ENUM('Waiting','On Process','Done') NOT NULL DEFAULT 'Waiting' AFTER is_mandatory,
  ADD COLUMN IF NOT EXISTS start_date      DATE NULL AFTER program_status,
  ADD COLUMN IF NOT EXISTS end_date        DATE NULL AFTER start_date,
  ADD COLUMN IF NOT EXISTS organizer_type  ENUM('Internal','Eksternal') NOT NULL DEFAULT 'Eksternal' AFTER end_date;
