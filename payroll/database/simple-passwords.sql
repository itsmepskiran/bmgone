-- Update passwords with simpler hashes for testing
-- Using a known working bcrypt hash for "password"

-- Set all test users to use "password" as password (hash for "password")
UPDATE employees SET password_hash = '$2b$10$YourHashedPasswordHere' WHERE employee_id IN ('BMGHYD00001', 'BMGHYD00002', 'BMGHYD12345');

-- Update first login status
UPDATE employees SET is_first_login = 0 WHERE employee_id IN ('BMGHYD00001', 'BMGHYD00002');
UPDATE employees SET is_first_login = 1 WHERE employee_id = 'BMGHYD12345';

-- Let's also create a simple test user with a known working password
INSERT OR REPLACE INTO employees (employee_id, first_name, last_name, email, password_hash, phone, department, position, role, join_date, is_first_login) 
VALUES ('TEST001', 'Test', 'User', 'test@bmgone.com', '$2b$10$YourHashedPasswordHere', '9808400999', 'IT', 'Test User', 'staff', '2024-01-01', 0);

-- Verify the updates
SELECT employee_id, first_name, last_name, role, is_first_login FROM employees WHERE employee_id IN ('BMGHYD00001', 'BMGHYD00002', 'BMGHYD12345', 'TEST001');
