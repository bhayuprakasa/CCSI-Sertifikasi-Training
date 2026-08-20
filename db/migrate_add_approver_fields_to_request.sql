-- Migration: Simpan data approver Dept di trx_training_request
ALTER TABLE trx_training_request
  ADD COLUMN approver_name     VARCHAR(100) NULL AFTER approval_hrd_token,
  ADD COLUMN approver_email    VARCHAR(150) NULL AFTER approver_name,
  ADD COLUMN approver_position VARCHAR(100) NULL AFTER approver_email;
