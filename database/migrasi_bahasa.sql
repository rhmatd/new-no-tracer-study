-- Jalankan jika tabel jobseeker_profil sudah ada sebelumnya (menambah kolom kemahiran bahasa).
USE cdfs;
ALTER TABLE jobseeker_profil ADD COLUMN bahasa TEXT NULL AFTER sertifikat;
