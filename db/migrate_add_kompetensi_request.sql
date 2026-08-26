-- Add kompetensi column to trx_training_request
-- This column is filled by HR staff to describe the competency addressed by the training

ALTER TABLE trx_training_request
  ADD COLUMN IF NOT EXISTS kompetensi TEXT NULL AFTER organizer;
