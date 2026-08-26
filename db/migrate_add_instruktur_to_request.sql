-- Menambahkan kolom instruktur ke tabel trx_training_request
ALTER TABLE trx_training_request
  ADD COLUMN IF NOT EXISTS instruktur VARCHAR(100) NULL AFTER organizer;
