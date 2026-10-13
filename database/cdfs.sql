CREATE DATABASE IF NOT EXISTS cdfs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cdfs;

CREATE TABLE IF NOT EXISTS users(
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,email VARCHAR(190) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,instansi VARCHAR(190) NOT NULL,
 role ENUM('Jobseeker','Jobprovider') NOT NULL DEFAULT 'Jobseeker',
 jalur ENUM('Akademis','Vocational') NULL DEFAULT NULL,
 prodi VARCHAR(120) NULL DEFAULT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Kompetensi teknis & kebutuhan bahasa Jobprovider (per program studi)
CREATE TABLE IF NOT EXISTS kompetensi(
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 provider_id INT UNSIGNED NOT NULL,
 nama VARCHAR(100) NOT NULL,
 prodi VARCHAR(120) NOT NULL,
 jenis ENUM('kompetensi','bahasa') NOT NULL DEFAULT 'kompetensi',  -- kompetensi teknis atau kebutuhan bahasa
 level VARCHAR(20) NULL DEFAULT NULL,                              -- tingkat minimal bahasa: Basic/Intermediate/Advanced
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY idx_komp_provider(provider_id),
 CONSTRAINT fk_komp_provider FOREIGN KEY(provider_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Lowongan kerja dari Jobprovider (menu Kelola Kompetensi > Kelola Lowongan)
CREATE TABLE IF NOT EXISTS lowongan_kerja(
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 provider_id INT UNSIGNED NOT NULL,
 posisi VARCHAR(120) NOT NULL,
 prodi VARCHAR(120) NOT NULL,
 lokasi VARCHAR(100) NULL,
 deskripsi TEXT NULL,
 kompetensi TEXT NOT NULL,   -- JSON array nama kompetensi
 bahasa TEXT NULL,           -- JSON array {nama, level} persyaratan bahasa
 status ENUM('Aktif','Ditutup') NOT NULL DEFAULT 'Aktif',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_lk_provider(provider_id),
 CONSTRAINT fk_lk_provider FOREIGN KEY(provider_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Kandidat (Jobseeker) yang di-shortlist oleh Jobprovider
CREATE TABLE IF NOT EXISTS shortlist_kandidat(
 provider_id INT UNSIGNED NOT NULL,
 jobseeker_id INT UNSIGNED NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(provider_id, jobseeker_id),
 CONSTRAINT fk_sk_provider FOREIGN KEY(provider_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_sk_jobseeker FOREIGN KEY(jobseeker_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Data Job Matching milik Jobseeker (transkrip nilai, sertifikat, kemahiran bahasa; format JSON)
CREATE TABLE IF NOT EXISTS jobseeker_profil(
 user_id INT UNSIGNED PRIMARY KEY,
 transkrip MEDIUMTEXT NULL,
 sertifikat TEXT NULL,
 bahasa TEXT NULL,          -- kemahiran bahasa (JSON: nama + level)
 tampil TINYINT(1) NOT NULL DEFAULT 0,  -- 1 = Jobseeker mengizinkan profilnya dilihat perusahaan
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_jsp_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Lamaran Jobseeker ke lowongan Jobprovider
CREATE TABLE IF NOT EXISTS lamaran(
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 lowongan_id INT UNSIGNED NOT NULL,
 jobseeker_id INT UNSIGNED NOT NULL,
 status ENUM('Dikirim','Ditinjau','Diundang','Diterima','Ditolak') NOT NULL DEFAULT 'Dikirim',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_lamaran(lowongan_id, jobseeker_id),
 CONSTRAINT fk_lam_lowongan FOREIGN KEY(lowongan_id) REFERENCES lowongan_kerja(id) ON DELETE CASCADE,
 CONSTRAINT fk_lam_jobseeker FOREIGN KEY(jobseeker_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
