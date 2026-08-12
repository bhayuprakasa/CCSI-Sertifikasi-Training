USE ccsi_training;

-- Tambah kolom eval_json ke tabel participant (per peserta per sesi)
ALTER TABLE trx_training_attendance_participant
  ADD COLUMN eval_json TEXT NULL AFTER employee_name;
