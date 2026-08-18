-- Migration: Add approval_status and approval_token to trx_training_request
ALTER TABLE trx_training_request
  ADD COLUMN approval_status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending' AFTER is_scheduled,
  ADD COLUMN approval_token VARCHAR(64) NULL UNIQUE AFTER approval_status;

-- Set existing rows to Pending
UPDATE trx_training_request SET approval_status = 'Pending' WHERE approval_status IS NULL;
