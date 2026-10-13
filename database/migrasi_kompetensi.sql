-- Jalankan jika database cdfs sudah ada sebelumnya.
-- (Jika masih memakai role Administrator PT / Dosen, jalankan migrasi_role_jobseeker.sql lebih dulu.)
USE cdfs;

CREATE TABLE IF NOT EXISTS kompetensi(
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 provider_id INT UNSIGNED NOT NULL,
 nama VARCHAR(100) NOT NULL,
 prodi VARCHAR(120) NOT NULL,
 jenis ENUM('kompetensi','bahasa') NOT NULL DEFAULT 'kompetensi',
 level VARCHAR(20) NULL DEFAULT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY idx_komp_provider(provider_id),
 CONSTRAINT fk_komp_provider FOREIGN KEY(provider_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shortlist_kandidat(
 provider_id INT UNSIGNED NOT NULL,
 jobseeker_id INT UNSIGNED NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(provider_id, jobseeker_id),
 CONSTRAINT fk_sk_provider FOREIGN KEY(provider_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_sk_jobseeker FOREIGN KEY(jobseeker_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Opsional: tabel & kolom versi sebelumnya (lowongan, survei, bidang industri, lokasi) tidak dipakai lagi.
-- Hapus tanda komentar di bawah jika ingin membersihkannya.
-- DROP TABLE IF EXISTS shortlist;
-- DROP TABLE IF EXISTS lowongan;
-- DROP TABLE IF EXISTS survei_pengguna;
-- ALTER TABLE users DROP COLUMN bidang_industri, DROP COLUMN lokasi;
