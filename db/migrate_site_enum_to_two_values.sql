-- Migrate site ENUM: ganti 'KIEC Cilegon' dan 'KBS Cilegon' menjadi 'Cilegon'
-- Jalankan script ini pada database yang sudah ada (sudah ada data)
-- PENTING: jalankan step 1 & 2 SEBELUM step 3, atau jalankan sekaligus

-- 1. Perbaiki data yang sudah terpotong (site='') akibat ALTER duluan
UPDATE mst_employee SET site = 'Cilegon' WHERE site = '' OR site NOT IN ('HO Jakarta', 'Cilegon');

-- 2. Update data lama yang masih pakai nilai lama (jika belum di-ALTER)
UPDATE mst_employee SET site = 'Cilegon' WHERE site IN ('KIEC Cilegon', 'KBS Cilegon');

-- 3. Ubah definisi ENUM kolom site (aman dijalankan ulang)
ALTER TABLE mst_employee
  MODIFY COLUMN site ENUM('HO Jakarta','Cilegon') NOT NULL;
