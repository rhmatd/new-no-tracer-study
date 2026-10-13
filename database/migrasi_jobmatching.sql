-- Jalankan jika database cdfs sudah ada sebelumnya (setelah migrasi_kompetensi.sql).
USE cdfs;
CREATE TABLE IF NOT EXISTS jobseeker_profil(
 user_id INT UNSIGNED PRIMARY KEY,
 transkrip MEDIUMTEXT NULL,
 sertifikat TEXT NULL,
 bahasa TEXT NULL,
 tampil TINYINT(1) NOT NULL DEFAULT 0,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_jsp_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
