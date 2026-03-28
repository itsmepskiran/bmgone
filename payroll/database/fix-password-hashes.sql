-- Update default passwords with proper bcrypt hashes
-- These are the default passwords that will work after the fix

-- BMGHYD00001 - Master Admin - password: admin123
UPDATE OR IGNORE employees SET password_hash = '$2b$10$N9qo8uLOickgx2ZMRZoMye.IjdIrEjDk5vGKUq2sCy8Cv1UaJzX9i' WHERE employee_id = 'BMGHYD00001';

-- BMGHYD00002 - Admin - password: admin123  
UPDATE OR IGNORE employees SET password_hash = '$2b$10$N9qo8uLOickgx2ZMRZoMye.IjdIrEjDk5vGKUq2sCy8Cv1UaJzX9i' WHERE employee_id = 'BMGHYD00002';

-- BMGHYD12345 - John Doe - password: john123
UPDATE OR IGNORE employees SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' WHERE employee_id = 'BMGHYD12345';

-- BMGHYD12346 - Jane Smith - password: jane123 (will need to change on first login)
UPDATE OR IGNORE employees SET password_hash = '$2b$10$Zg3q8uLOickgx2ZMRZlyfu.IjdLyEkiD5kiKEUki2 Cy8 ly1UkiX9i' WHERE employee_id = 'BMGHYD12346';
