-- Migrate site ENUM: ganti 'KIEC Cilegon' dan 'KBS Cilegon' menjadi 'Cilegon'
-- Jalankan script ini pada database yang sudah ada (sudah ada data)

-- 1. Update data lama yang masih pakai nilai lama
UPDATE mst_employee SET site = 'Cilegon' WHERE site IN ('KIEC Cilegon', 'KBS Cilegon');

-- 2. Ubah definisi ENUM kolom site
ALTER TABLE mst_employee
  MODIFY COLUMN site ENUM('HO Jakarta','Cilegon') NOT NULL;
