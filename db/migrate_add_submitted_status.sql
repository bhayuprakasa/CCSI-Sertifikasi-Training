-- Tambah nilai 'Submitted' ke ENUM approval_status
-- Status baru: permohonan sudah disimpan tapi belum dikirim ke approver
ALTER TABLE trx_training_request
  MODIFY COLUMN approval_status
    ENUM('Submitted','PendingBODDept','PendingBODHR','Approved','Rejected_BODDept','Rejected_BODHR','Submitted_HR')
    NOT NULL DEFAULT 'Submitted';
