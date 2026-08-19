-- Migration: Rename approval_status ENUM values
-- Pending        -> PendingBODDept
-- PendingHRD     -> PendingBODHR
-- Rejected_Dept  -> Rejected_BODDept
-- Rejected_HRD   -> Rejected_BODHR

-- Step 1: Expand ENUM to include both old and new values
ALTER TABLE trx_training_request
  MODIFY COLUMN approval_status ENUM(
    'Pending','PendingHRD','Approved','Rejected_Dept','Rejected_HRD','Submitted_HR',
    'PendingBODDept','PendingBODHR','Rejected_BODDept','Rejected_BODHR'
  ) NOT NULL DEFAULT 'PendingBODDept';

-- Step 2: Migrate existing data to new values
UPDATE trx_training_request SET approval_status = 'PendingBODDept'  WHERE approval_status = 'Pending';
UPDATE trx_training_request SET approval_status = 'PendingBODHR'    WHERE approval_status = 'PendingHRD';
UPDATE trx_training_request SET approval_status = 'Rejected_BODDept' WHERE approval_status = 'Rejected_Dept';
UPDATE trx_training_request SET approval_status = 'Rejected_BODHR'  WHERE approval_status = 'Rejected_HRD';

-- Step 3: Remove old ENUM values
ALTER TABLE trx_training_request
  MODIFY COLUMN approval_status ENUM(
    'PendingBODDept','PendingBODHR','Approved','Rejected_BODDept','Rejected_BODHR','Submitted_HR'
  ) NOT NULL DEFAULT 'PendingBODDept';
