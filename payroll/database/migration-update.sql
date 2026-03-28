-- Migration: Add new columns to employees table
-- Run this to update existing schema

-- Add new columns to employees table
ALTER TABLE employees ADD COLUMN alternate_phone TEXT;
ALTER TABLE employees ADD COLUMN date_of_birth DATE;
ALTER TABLE employees ADD COLUMN gender TEXT;
ALTER TABLE employees ADD COLUMN address TEXT;
ALTER TABLE employees ADD COLUMN city TEXT;
ALTER TABLE employees ADD COLUMN state TEXT;
ALTER TABLE employees ADD COLUMN pincode TEXT;
ALTER TABLE employees ADD COLUMN reporting_manager TEXT;
ALTER TABLE employees ADD COLUMN salary DECIMAL(10,2);
ALTER TABLE employees ADD COLUMN bank_name TEXT;
ALTER TABLE employees ADD COLUMN bank_account TEXT;
ALTER TABLE employees ADD COLUMN ifsc_code TEXT;
ALTER TABLE employees ADD COLUMN pan_number TEXT;
ALTER TABLE employees ADD COLUMN aadhaar_number TEXT;
ALTER TABLE employees ADD COLUMN emergency_contact_name TEXT;
ALTER TABLE employees ADD COLUMN emergency_contact_phone TEXT;
ALTER TABLE employees ADD COLUMN emergency_contact_relation TEXT;
ALTER TABLE employees ADD COLUMN is_first_login BOOLEAN DEFAULT 1;
ALTER TABLE employees ADD COLUMN created_by TEXT;

-- Update existing employees to set is_first_login to 0 (already logged in)
UPDATE employees SET is_first_login = 0 WHERE is_first_login IS NULL;

-- Update Master Admin
INSERT OR IGNORE INTO employees (employee_id, first_name, last_name, email, password_hash, phone, department, position, role, join_date, is_first_login) 
VALUES ('BMGHYD00001', 'Master', 'Admin', 'masteradmin@bmgone.com', '$2b$10$YourHashedPasswordHere', '9808400500', 'Management', 'System Administrator', 'master_admin', '2023-01-01', 0);

-- Update Admin
INSERT OR IGNORE INTO employees (employee_id, first_name, last_name, email, password_hash, phone, department, position, role, join_date, is_first_login) 
VALUES ('BMGHYD00002', 'Admin', 'User', 'admin@bmgone.com', '$2b$10$YourHashedPasswordHere', '9808400501', 'HR', 'HR Manager', 'admin', '2023-06-01', 0);

-- Update sample employees with new ID format
UPDATE OR IGNORE employees SET employee_id = 'BMGHYD12345' WHERE employee_id = 'BMG2024001';
UPDATE OR IGNORE employees SET employee_id = 'BMGHYD12346' WHERE employee_id = 'BMG2024002';
UPDATE OR IGNORE employees SET employee_id = 'BMGHYD12347' WHERE employee_id = 'BMG2024003';

-- Update leave balances with new employee IDs
UPDATE OR IGNORE leave_balances SET employee_id = 'BMGHYD12345' WHERE employee_id = 'BMG2024001';
UPDATE OR IGNORE leave_balances SET employee_id = 'BMGHYD12346' WHERE employee_id = 'BMG2024002';
UPDATE OR IGNORE leave_balances SET employee_id = 'BMGHYD12347' WHERE employee_id = 'BMG2024003';

-- Update attendance with new employee IDs
UPDATE OR IGNORE attendance SET employee_id = 'BMGHYD12345' WHERE employee_id = 'BMG2024001';
UPDATE OR IGNORE attendance SET employee_id = 'BMGHYD12346' WHERE employee_id = 'BMG2024002';
UPDATE OR IGNORE attendance SET employee_id = 'BMGHYD12347' WHERE employee_id = 'BMG2024003';

-- Update leave applications with new employee IDs
UPDATE OR IGNORE leave_applications SET employee_id = 'BMGHYD12345' WHERE employee_id = 'BMG2024001';
UPDATE OR IGNORE leave_applications SET employee_id = 'BMGHYD12346' WHERE employee_id = 'BMG2024002';
UPDATE OR IGNORE leave_applications SET employee_id = 'BMGHYD12347' WHERE employee_id = 'BMG2024003';
