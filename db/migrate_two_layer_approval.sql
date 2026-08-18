-- Migration: Two-layer approval (Direktur Dept → Direktur HRD)
-- Jalankan satu kali setelah migrate_add_approval.sql

-- Step 1: Expand ENUM dengan nilai baru
ALTER TABLE trx_training_request
  MODIFY COLUMN approval_status
    ENUM('Pending','PendingHRD','Approved','Rejected_Dept','Rejected_HRD')
    NOT NULL DEFAULT 'Pending';

-- Step 2: Tambah kolom token untuk Direktur HRD
ALTER TABLE trx_training_request
  ADD COLUMN IF NOT EXISTS approval_hrd_token VARCHAR(64) NULL UNIQUE
  AFTER approval_token;

-- Step 3: Data lama yang sudah 'Approved' atau 'Rejected' tetap valid (ENUM baru kompatibel)
-- Status 'Rejected' lama diubah ke 'Rejected_Dept' agar konsisten (opsional)
-- UPDATE trx_training_request SET approval_status = 'Rejected_Dept' WHERE approval_status = 'Rejected';
