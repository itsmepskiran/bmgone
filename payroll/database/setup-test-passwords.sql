-- Setup test passwords for the payroll system
-- These are bcrypt hashes for the passwords

-- Master Admin: BMGHYD00001, Password: admin123
UPDATE employees SET password_hash = '$2b$10$YourHashedPasswordHere' WHERE employee_id = 'BMGHYD00001';

-- Admin: BMGHYD00002, Password: admin123  
UPDATE employees SET password_hash = '$2b$10$YourHashedPasswordHere' WHERE employee_id = 'BMGHYD00002';

-- Staff: BMG2024001, Password: staff123
UPDATE employees SET password_hash = '$2b$10$YourHashedPasswordHere' WHERE employee_id = 'BMG2024001';

-- Staff: BMG2024002, Password: john123
UPDATE employees SET password_hash = '$2b$10$YourHashedPasswordHere' WHERE employee_id = 'BMG2024002';

-- Manager: BMG2024003, Password: jane123
UPDATE employees SET password_hash = '$2b$10$YourHashedPasswordHere' WHERE employee_id = 'BMG2024003';

-- Admin: BMG2024004, Password: admin123
UPDATE employees SET password_hash = '$2b$10$YourHashedPasswordHere' WHERE employee_id = 'BMG2024004';

-- For testing, let's make some users have first_login = 1
UPDATE employees SET is_first_login = 1 WHERE employee_id IN ('BMG2024001', 'BMG2024002');

-- Keep existing users as already logged in
UPDATE employees SET is_first_login = 0 WHERE employee_id IN ('BMGHYD00001', 'BMGHYD00002', 'BMG2024003', 'BMG2024004');
