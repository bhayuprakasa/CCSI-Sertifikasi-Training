-- Add instruktur column to trx_training_request
-- This column is filled by HR staff to record the trainer/instructor name

ALTER TABLE trx_training_request
  ADD COLUMN IF NOT EXISTS instruktur VARCHAR(200) NULL AFTER kompetensi;
