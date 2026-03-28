-- Fix truncated password hashes
-- The hashes for BMGHYD00001 and BMGHYD00002 are truncated and causing bcrypt comparison to fail

-- Complete bcrypt hash for "admin123"
UPDATE employees SET password_hash = '$2b$10$N9qo8uLOickgx2ZMRZoMye.IjdIrEjDk5vGKUq2sCy8Cv1UaJzX9i' WHERE employee_id = 'BMGHYD00001';

-- Complete bcrypt hash for "admin123" 
UPDATE employees SET password_hash = '$2b$10$N9qo8uLOickgx2ZMRZoMye.IjdIrEjDk5vGKUq2sCy8Cv1UaJzX9i' WHERE employee_id = 'BMGHYD00002';

-- Verify the hashes are complete
SELECT employee_id, length(password_hash) as hash_length, password_hash FROM employees WHERE employee_id IN ('BMGHYD00001', 'BMGHYD00002', 'BMGHYD00003');
