-- Jalankan jika database cdfs sudah ada sebelumnya (menambah Kelola Lowongan & kebutuhan bahasa Jobprovider).
USE cdfs;
ALTER TABLE kompetensi ADD COLUMN jenis ENUM('kompetensi','bahasa') NOT NULL DEFAULT 'kompetensi' AFTER prodi;
ALTER TABLE kompetensi ADD COLUMN level VARCHAR(20) NULL DEFAULT NULL AFTER jenis;

CREATE TABLE IF NOT EXISTS lowongan_kerja(
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 provider_id INT UNSIGNED NOT NULL,
 posisi VARCHAR(120) NOT NULL,
 prodi VARCHAR(120) NOT NULL,
 lokasi VARCHAR(100) NULL,
 deskripsi TEXT NULL,
 kompetensi TEXT NOT NULL,
 bahasa TEXT NULL,
 status ENUM('Aktif','Ditutup') NOT NULL DEFAULT 'Aktif',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_lk_provider(provider_id),
 CONSTRAINT fk_lk_provider FOREIGN KEY(provider_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
