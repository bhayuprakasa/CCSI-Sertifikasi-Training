CREATE DATABASE IF NOT EXISTS ccsi_training
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ccsi_training;

-- ==================
-- MASTER TABLES
-- ==================

CREATE TABLE IF NOT EXISTS mst_employee (
  employee_id   VARCHAR(20)   PRIMARY KEY,
  full_name     VARCHAR(100)  NOT NULL,
  department    VARCHAR(50)   NOT NULL,
  position      VARCHAR(50)   NOT NULL,
  site          ENUM('HO Jakarta','KIEC Cilegon','KBS Cilegon') NOT NULL,
  employment_status ENUM('PKWTT','PKWT') NOT NULL DEFAULT 'PKWTT',
  join_date     DATE          NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mst_competency (
  competency_id   INT           AUTO_INCREMENT PRIMARY KEY,
  competency_name VARCHAR(100)  NOT NULL,
  competency_type ENUM('Hard Skill','Soft Skill','Safety','Leadership') NOT NULL,
  category        VARCHAR(50)   NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mst_program (
  program_id      INT           AUTO_INCREMENT PRIMARY KEY,
  program_name    VARCHAR(200)  NOT NULL,
  program_type    ENUM('Training','Sosialisasi','Sertifikasi') NOT NULL,
  competency_id   INT           NULL,
  delivery_method ENUM('Offline','Online','Hybrid','Vendor') NOT NULL DEFAULT 'Offline',
  conducted_by    VARCHAR(100)  NULL,
  trainer_name    VARCHAR(100)  NULL,
  location        VARCHAR(100)  NULL,
  is_mandatory    TINYINT(1)    NOT NULL DEFAULT 0,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (competency_id) REFERENCES mst_competency(competency_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ==================
-- TRANSACTION TABLES
-- ==================

CREATE TABLE IF NOT EXISTS trx_employee_program (
  trx_id          INT           AUTO_INCREMENT PRIMARY KEY,
  employee_id     VARCHAR(20)   NOT NULL,
  program_id      INT           NOT NULL,
  start_date      DATE          NULL,
  end_date        DATE          NULL,
  status          ENUM('Done','Ongoing','Failed','Cancelled') NOT NULL DEFAULT 'Ongoing',
  aktivitas       VARCHAR(200)  NULL,
  pre_test_score  DECIMAL(5,2)  NULL,
  post_test_score DECIMAL(5,2)  NULL,
  reaction_score  DECIMAL(5,2)  NULL,
  training_cost   DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes           TEXT          NULL,
  recorded_by     VARCHAR(50)   NULL,
  FOREIGN KEY (employee_id) REFERENCES mst_employee(employee_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (program_id) REFERENCES mst_program(program_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trx_certification (
  cert_id           INT           AUTO_INCREMENT PRIMARY KEY,
  employee_id       VARCHAR(20)   NOT NULL,
  trx_id            INT           NULL,
  sertif_name       VARCHAR(200)  NOT NULL,
  certificate_number VARCHAR(100) NULL,
  issue_date        DATE          NOT NULL,
  expiry_date       DATE          NULL,
  issuing_body      VARCHAR(100)  NULL,
  is_active         TINYINT(1)    NOT NULL DEFAULT 1,
  renewal_count     INT           NOT NULL DEFAULT 0,
  notes             TEXT          NULL,
  FOREIGN KEY (employee_id) REFERENCES mst_employee(employee_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (trx_id) REFERENCES trx_employee_program(trx_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ==================
-- SEED DATA
-- ==================

INSERT INTO mst_employee (employee_id, full_name, department, position, site, employment_status, join_date, is_active, is_dept_head) VALUES
('CC000','Direktur HRD','BOD','Direktur HRD','HO Jakarta','PKWTT','2015-01-01',1,0);

INSERT INTO mst_employee (employee_id, full_name, department, position, site, employment_status, join_date, is_active) VALUES
('CC001','Budi Santoso','Produksi','Operator Produksi','KIEC Cilegon','PKWTT','2019-03-01',1),
('CC002','Siti Rahayu','HR & GA','Staff HR','HO Jakarta','PKWTT','2020-07-15',1),
('CC003','Ahmad Fauzi','Maintenance','Teknisi Mesin','KBS Cilegon','PKWTT','2018-11-01',1),
('CC004','Dewi Kurniawati','Finance','Staff Finance','HO Jakarta','PKWTT','2021-02-01',1),
('CC005','Rudi Hermawan','QC/QA','Supervisor QC','KIEC Cilegon','PKWTT','2017-06-01',1),
('CC006','Eko Prasetyo','Produksi','Operator Extrusi','KBS Cilegon','PKWT','2024-01-15',1),
('CC007','Maya Indrawati','IT','Staff IT','HO Jakarta','PKWTT','2022-03-01',1),
('CC008','Hendra Wijaya','Produksi','Kepala Produksi','KIEC Cilegon','PKWTT','2015-08-01',1),
('CC009','Rina Marliani','Purchasing','Staff Purchasing','HO Jakarta','PKWTT','2023-05-01',1),
('CC010','Teguh Setiawan','Engineering','Teknisi Listrik','KBS Cilegon','PKWTT','2019-09-01',1);

INSERT INTO mst_competency (competency_name, competency_type, category) VALUES
('K3 Umum','Safety','K3'),
('K3 Listrik','Safety','K3'),
('ISO 9001','Hard Skill','Quality'),
('Hidrolik & Pneumatik','Hard Skill','Teknis Mesin'),
('Perpajakan','Hard Skill','Finance'),
('Azure Cloud','Hard Skill','IT'),
('Leadership','Leadership','Manajerial'),
('Negotiation','Soft Skill','Interpersonal'),
('Pengelasan SMAW','Hard Skill','Teknis Produksi'),
('Labour Law','Hard Skill','Compliance');

INSERT INTO mst_program (program_name, program_type, competency_id, delivery_method, conducted_by, trainer_name, location, is_mandatory) VALUES
('K3 Umum Dasar','Training',1,'Offline','Disnaker Cilegon','','',1),
('Labour Law Update 2025','Training',10,'Offline','GAPMMI','','HO Jakarta',1),
('Hidrolik & Pneumatik Lanjutan','Training',4,'Offline','PT SMK Teknik','','KBS Cilegon',0),
('Pajak PPh Badan 2025','Training',5,'Offline','Taxindo','','HO Jakarta',0),
('ISO 9001:2015 Internal Audit','Training',3,'Offline','SGS Indonesia','','KIEC Cilegon',1),
('K3 Operator Mesin Extrusi','Sosialisasi',1,'Offline','PT CCSI','Internal HSE','KBS Cilegon',1),
('Microsoft Azure Fundamentals','Training',6,'Online','Microsoft','','',0),
('Leadership for Manufacturing','Training',7,'Offline','SHL Indonesia','','KIEC Cilegon',0),
('Negotiation & Procurement Skill','Training',8,'Offline','Dale Carnegie','','HO Jakarta',0),
('K3 Listrik & Instalasi','Training',2,'Offline','Kemnaker RI','','KBS Cilegon',1),
('IK & Prosedure Inspeksi Kabel Submarine','Sosialisasi',3,'Offline','PT CCSI','Dony & Venanda','R. Krakatau & R. Merak',1),
('Pengelasan 3G SMAW','Sertifikasi',9,'Vendor','BBPLK Serang - BNSP','','',1);

INSERT INTO trx_employee_program (employee_id, program_id, start_date, end_date, status, aktivitas, pre_test_score, post_test_score, reaction_score, training_cost, notes, recorded_by) VALUES
('CC001',1,'2025-01-10','2025-01-12','Done','',65,87,4.5,500000,'','HR'),
('CC002',2,'2025-02-03','2025-02-03','Done','',70,88,4.0,1500000,'','HR'),
('CC003',3,'2025-02-15','2025-02-18','Done','',60,90,4.8,3200000,'','HR'),
('CC004',4,'2025-03-05','2025-03-06','Done','',72,90,4.2,2800000,'','HR'),
('CC005',5,'2025-03-18','2025-03-20','Done','',68,85,4.5,4500000,'','HR'),
('CC006',6,'2025-04-07','2025-04-07','Done','',55,80,3.8,0,'','HR'),
('CC007',7,'2025-05-12','2025-05-12','Done','',75,92,4.9,1200000,'','HR'),
('CC008',8,'2025-05-20','2025-05-22','Ongoing','',NULL,NULL,NULL,7500000,'Masih dalam proses','HR'),
('CC009',9,'2025-06-03','2025-06-04','Failed','',50,55,2.5,3800000,'Rescheduling perlu','HR'),
('CC010',10,'2025-06-16','2025-06-17','Done','',70,88,4.3,600000,'','HR'),
('CC005',11,'2026-05-04','2026-05-04','Done','',NULL,NULL,4.0,0,'','HR'),
('CC001',12,'2019-11-14','2019-11-15','Done','',NULL,NULL,NULL,0,'','HR');

INSERT INTO trx_certification (employee_id, trx_id, certificate_number, issue_date, expiry_date, issuing_body, sertif_name, is_active, renewal_count, notes) VALUES
('CC001',NULL,'SNI-K3-2025-001','2025-01-12','2028-01-12','Kemnaker RI','Sertifikat K3 Umum',1,0,''),
('CC005',NULL,'SGS-IA-2025-055','2025-03-20','2026-03-20','SGS Indonesia','ISO 9001 Internal Auditor',1,0,''),
('CC003',NULL,'SMKT-H2-2025-012','2025-02-18','2027-02-18','BNSP','Teknisi Hidrolik Level 2',1,0,''),
('CC010',NULL,'K3L-2025-789','2025-06-17','2025-09-17','Kemnaker RI','Sertifikat K3 Listrik',1,0,'Perlu diperpanjang segera'),
('CC007',NULL,'MS-AZ900-2025-CC007','2025-05-12',NULL,'Microsoft','Azure Fundamentals (AZ-900)',1,0,''),
('CC004',NULL,'IKPI-2023-4412','2023-08-10','2025-08-10','IKPI','Brevet Pajak A & B',1,0,''),
('CC008',NULL,'AHK3U-2022-0334','2022-07-01','2025-07-01','Kemnaker RI','Ahli K3 Umum',1,1,''),
('CC001',NULL,'BNSP-3G-2019-001','2019-11-15','2022-11-15','BNSP','Pengelasan 3G SMAW',0,0,'Sudah expired, perlu renewal');
