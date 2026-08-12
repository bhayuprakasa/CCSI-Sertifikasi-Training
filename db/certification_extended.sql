-- Extend trx_certification table with additional fields for certification registration form
ALTER TABLE trx_certification ADD COLUMN IF NOT EXISTS card_number VARCHAR(50) NULL AFTER issuing_body;
ALTER TABLE trx_certification ADD COLUMN IF NOT EXISTS card_date DATE NULL AFTER card_number;
ALTER TABLE trx_certification ADD COLUMN IF NOT EXISTS competency_id INT NULL AFTER card_date;
ALTER TABLE trx_certification ADD COLUMN IF NOT EXISTS delivery_method ENUM('Online','Offline') DEFAULT 'Offline' AFTER competency_id;
ALTER TABLE trx_certification ADD COLUMN IF NOT EXISTS certification_type ENUM('Internal','Eksternal') DEFAULT 'Eksternal' AFTER delivery_method;
ALTER TABLE trx_certification ADD COLUMN IF NOT EXISTS location VARCHAR(100) NULL AFTER certification_type;
ALTER TABLE trx_certification ADD COLUMN IF NOT EXISTS is_lifetime TINYINT(1) DEFAULT 0 AFTER location;
ALTER TABLE trx_certification ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP AFTER is_lifetime;
ALTER TABLE trx_certification ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Add foreign key if not exists
ALTER TABLE trx_certification ADD CONSTRAINT fk_cert_competency FOREIGN KEY (competency_id) REFERENCES mst_competency(competency_id) ON UPDATE CASCADE ON DELETE SET NULL;
