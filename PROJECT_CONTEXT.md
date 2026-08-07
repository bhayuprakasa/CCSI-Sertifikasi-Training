# CCSI Training & Sertifikasi — Project Context

> Dokumen handover untuk melanjutkan pengembangan di Claude Code.  
> Buat folder project, letakkan `ccsi-training-v2.html` dan file ini di dalamnya, lalu buka dengan Claude Code.

---

## Latar Belakang

PT Communication Cable Systems Indonesia (CCSI) membutuhkan sistem sentralisasi data program pengembangan karyawan — mencakup **Training**, **Sosialisasi**, dan **Sertifikasi** — agar HR dan Department Head dapat:
- Melakukan pemetaan kompetensi tim secara real-time
- Memantau expiry sertifikasi dan memberi reminder otomatis
- Mengevaluasi efektivitas program (Kirkpatrick Model)
- Menghasilkan laporan untuk manajemen

**3 site operasional:** HO Jakarta · KIEC Cilegon · KBS Cilegon

---

## Status Saat Ini

File `ccsi-training-v2.html` adalah **single-file HTML app** yang sudah berjalan penuh di browser, menggunakan **IndexedDB** sebagai database lokal (persistent di browser).

### Fitur yang sudah ada

| Tab | Fitur |
|---|---|
| Dashboard | KPI cards, bar chart per bulan, coverage per site, alert expiry terdekat |
| Rekap Training | Tabel transaksi lengkap, filter multi-dimensi, kolom pre/post-test score |
| Sertifikasi | Tabel sertifikat aktif, status expiry otomatis (warna merah/kuning/hijau) |
| Alert Expiry | List expired, expiry <90 hari, karyawan belum ada program tahun ini |
| Departemen | Summary per dept: completion rate, avg score, total biaya |
| Kompetensi | Peta kompetensi per karyawan: Hard Skill / Safety / Soft Skill / Leadership |
| Master Data | CRUD lengkap: Karyawan, Program, Kompetensi — dengan validasi integritas data |

### Fitur validasi Master Data
- Data yang sudah dipakai di transaksi **tidak bisa dihapus**
- Field kritis (NIK, nama program, tipe kompetensi) **terkunci saat edit** jika sudah ada transaksi
- Badge penggunaan dengan **rich tooltip** saat di-hover: menampilkan daftar transaksi, peserta, atau program terkait
- Modal peringatan khusus jika user mencoba hapus data yang terkunci

---

## Arsitektur Database (IndexedDB — saat ini)

5 object store sesuai skema 3NF:

```
mst_employee          → Master karyawan
mst_competency        → Taksonomi kompetensi terstandar
mst_program           → Katalog program training/sosialisasi/sertifikasi
trx_employee_program  → Riwayat keikutsertaan karyawan (transaksi utama)
trx_certification     → Sertifikasi aktif + expiry date
```

### Relasi antar tabel

```
mst_employee (1) ──< (N) trx_employee_program
mst_program  (1) ──< (N) trx_employee_program
mst_competency (1) ──< (N) mst_program
mst_employee (1) ──< (N) trx_certification
trx_employee_program (1) ──o (1) trx_certification
```

---

## Data Dictionary

### `mst_employee`
| Field | Type | Keterangan |
|---|---|---|
| employee_id | VARCHAR(20) PK | NIK karyawan |
| full_name | VARCHAR(100) | Nama lengkap |
| department | VARCHAR(50) | Departemen/divisi |
| position | VARCHAR(50) | Jabatan |
| site | ENUM | HO Jakarta / KIEC Cilegon / KBS Cilegon |
| employment_status | ENUM | PKWTT / PKWT |
| join_date | DATE | Tanggal mulai kerja |
| is_active | TINYINT | 1=aktif, 0=nonaktif |

### `mst_competency`
| Field | Type | Keterangan |
|---|---|---|
| competency_id | INT PK AUTO | ID kompetensi |
| competency_name | VARCHAR(100) | Nama standar kompetensi |
| competency_type | ENUM | Hard Skill / Soft Skill / Safety / Leadership |
| category | VARCHAR(50) | Sub-kategori (K3, ISO, Finance, dll) |

### `mst_program`
| Field | Type | Keterangan |
|---|---|---|
| program_id | INT PK AUTO | ID program |
| program_name | VARCHAR(200) | Nama program |
| program_type | ENUM | Training / Sosialisasi / Sertifikasi |
| competency_id | INT FK | → mst_competency |
| delivery_method | ENUM | Offline / Online / Hybrid / Vendor |
| conducted_by | VARCHAR(100) | Penyelenggara |
| trainer_name | VARCHAR(100) | Nama trainer |
| location | VARCHAR(100) | Lokasi pelaksanaan |
| is_mandatory | TINYINT | 1=wajib, 0=opsional |
| created_at | DATETIME | Timestamp dibuat |

### `trx_employee_program` ← Tabel transaksi utama
| Field | Type | Keterangan |
|---|---|---|
| trx_id | INT PK AUTO | ID transaksi |
| employee_id | VARCHAR FK | → mst_employee |
| program_id | INT FK | → mst_program |
| start_date | DATE | Tanggal mulai |
| end_date | DATE | Tanggal selesai |
| status | ENUM | Done / Ongoing / Failed / Cancelled |
| aktivitas | VARCHAR(200) | Detail aktivitas |
| pre_test_score | DECIMAL(5,2) | Nilai pre-test (0–100) |
| post_test_score | DECIMAL(5,2) | Nilai post-test — Kirkpatrick L2 |
| reaction_score | DECIMAL(5,2) | Feedback peserta (1–5) — Kirkpatrick L1 |
| training_cost | DECIMAL(15,2) | Biaya pelatihan |
| notes | TEXT | Catatan |
| recorded_by | VARCHAR(50) | HR yang input |

### `trx_certification`
| Field | Type | Keterangan |
|---|---|---|
| cert_id | INT PK AUTO | ID sertifikasi |
| employee_id | VARCHAR FK | → mst_employee |
| trx_id | INT FK NULL | → trx_employee_program (opsional) |
| sertif_name | VARCHAR(200) | Nama sertifikasi |
| certificate_number | VARCHAR(100) | Nomor sertifikat resmi |
| issue_date | DATE | Tanggal terbit |
| expiry_date | DATE NULL | Tanggal kadaluarsa (null = seumur hidup) |
| issuing_body | VARCHAR(100) | Lembaga penerbit |
| is_active | TINYINT | Status aktif |
| renewal_count | INT | Jumlah perpanjangan |
| notes | TEXT | Catatan |

---

## Stack Teknologi Saat Ini

| Layer | Teknologi |
|---|---|
| Frontend | HTML5 + Vanilla CSS + Vanilla JS (ES2020) |
| Database | IndexedDB (browser-local, persistent) |
| Storage | Tidak ada backend — semua di sisi klien |
| Export | CSV via Blob download |

---

## Roadmap Pengembangan (Next Steps)

Berikut prioritas yang direkomendasikan untuk dilanjutkan di Claude Code:

### Fase 1 — Backend & Database Nyata (Prioritas Tinggi)
- [ ] Setup **Node.js + Express** sebagai backend API
- [ ] Migrasi dari IndexedDB ke **MySQL** (skema sudah siap di atas)
- [ ] Buat REST API endpoint untuk semua 5 tabel (CRUD)
- [ ] Ganti fetch di frontend dari IndexedDB ke `fetch('/api/...')`
- [ ] Setup `.env` untuk konfigurasi DB connection

### Fase 2 — Autentikasi & Role
- [ ] Login page sederhana (username/password)
- [ ] Role: `HR Admin` (full access) · `Dept Head` (read + view tim sendiri) · `Viewer` (read only)
- [ ] Session management (JWT atau session cookie)

### Fase 3 — Notifikasi Otomatis
- [ ] Cron job / scheduled task: cek expiry sertifikasi harian
- [ ] Kirim email reminder ke Dept Head via **Nodemailer** atau integrasi **Power Automate** (M365)
- [ ] Threshold: T-90 hari, T-30 hari, T-7 hari, dan hari-H expired

### Fase 4 — Import & Integrasi
- [ ] Import data dari Excel/CSV (bulk upload riwayat lama)
- [ ] Integrasi dengan **Mekari Talenta API** untuk sync data karyawan otomatis
- [ ] Export laporan ke PDF (selain CSV)

### Fase 5 — Evaluasi Kirkpatrick
- [ ] Form evaluasi Level 3 (Behavior) — survey post-training 30/60/90 hari
- [ ] Dashboard ROI: perbandingan biaya vs peningkatan score
- [ ] Training gap analysis per posisi/jabatan

---

## Cara Lanjut di Claude Code

1. Buat folder project:
   ```bash
   mkdir ccsi-training && cd ccsi-training
   ```

2. Letakkan kedua file di folder tersebut:
   ```
   ccsi-training/
   ├── ccsi-training-v2.html   ← app saat ini (sudah jalan)
   └── PROJECT_CONTEXT.md      ← file ini
   ```

3. Buka Claude Code dan berikan konteks awal:
   ```
   Saya punya sistem manajemen training karyawan untuk PT CCSI.
   Baca PROJECT_CONTEXT.md untuk memahami sistem yang sudah ada,
   lalu bantu saya [sebutkan task berikutnya].
   ```

4. Task pertama yang direkomendasikan:
   > "Buatkan backend Node.js + Express + MySQL untuk sistem ini berdasarkan skema di PROJECT_CONTEXT.md, lalu refactor frontend HTML agar menggunakan API tersebut."

---

## Catatan Tambahan

- **Seed data** sudah ada di `ccsi-training-v2.html` (10 karyawan, 12 program, 10 kompetensi, 12 transaksi, 8 sertifikasi) — data ini perlu dimigrasikan ke MySQL saat backend disetup
- **IndexedDB** menyimpan data per browser — jika dibuka di browser berbeda, data tidak terbawa. Ini alasan utama kenapa backend nyata diperlukan untuk production
- Semua logika validasi integritas data sudah ada di JS — perlu direplikasi di level backend (middleware/service layer) agar tidak bisa di-bypass via API langsung

