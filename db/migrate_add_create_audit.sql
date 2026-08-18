-- Migration: add CREATE to audit log operation ENUM + add Submitted_HR to training_request approval_status
-- Run once on existing databases after initial migrations

ALTER TABLE trx_audit_log
  MODIFY COLUMN operation ENUM('CREATE','UPDATE','DELETE') NOT NULL;

ALTER TABLE trx_training_request
  MODIFY COLUMN approval_status
    ENUM('Pending','PendingHRD','Approved','Rejected_Dept','Rejected_HRD','Submitted_HR')
    NOT NULL DEFAULT 'Pending';
