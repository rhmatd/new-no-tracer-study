-- Jalankan HANYA jika database cdfs lama (role Administrator PT / Dosen) sudah terlanjur di-import.
USE cdfs;
ALTER TABLE users ADD COLUMN jalur ENUM('Akademis','Vocational') NULL DEFAULT NULL AFTER role;
ALTER TABLE users ADD COLUMN prodi VARCHAR(120) NULL DEFAULT NULL AFTER jalur;
UPDATE users SET role='Jobprovider' WHERE role NOT IN ('Jobseeker','Jobprovider');
ALTER TABLE users MODIFY role ENUM('Jobseeker','Jobprovider') NOT NULL DEFAULT 'Jobseeker';
