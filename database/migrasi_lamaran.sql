-- Jalankan jika database cdfs sudah ada sebelumnya (setelah migrasi_lowongan.sql).
-- Menambah izin tampil profil Jobseeker dan tabel lamaran (alur lamar -> status).
USE cdfs;
ALTER TABLE jobseeker_profil ADD COLUMN IF NOT EXISTS tampil TINYINT(1) NOT NULL DEFAULT 0 AFTER bahasa;

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
