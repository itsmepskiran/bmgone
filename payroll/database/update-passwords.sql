-- Update passwords for test users
-- These are bcrypt hashes for the passwords

-- Master Admin: BMGHYD00001, Password: admin123
UPDATE employees SET password_hash = '$2a$10$EioCzTsaFOg27O10EZX1E.kroHN4Y52DZzKXwNmpJCCm8I2mgPAhW' WHERE employee_id = 'BMGHYD00001';

-- Admin: BMGHYD00002, Password: admin123  
UPDATE employees SET password_hash = '$2a$10$tf9KMv3sEo56vvTqI.7ARu3u8co3APQ.cU2XYtDkD2s8Pq6CqL2jq' WHERE employee_id = 'BMGHYD00002';

-- Staff: BMGHYD12345, Password: john123 (first login required)
UPDATE employees SET password_hash = '$2a$10$H5/bJkto.PkW/fUO/4SskuUXlmFuRYvWX0IxKJfyZjktL.m/D7VIe' WHERE employee_id = 'BMGHYD12345';

-- Set first login status
UPDATE employees SET is_first_login = 0 WHERE employee_id IN ('BMGHYD00001', 'BMGHYD00002');
UPDATE employees SET is_first_login = 1 WHERE employee_id = 'BMGHYD12345';

-- Verify the updates
SELECT employee_id, first_name, last_name, role, is_first_login FROM employees WHERE employee_id IN ('BMGHYD00001', 'BMGHYD00002', 'BMGHYD12345');
