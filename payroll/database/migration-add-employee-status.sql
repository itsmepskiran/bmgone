-- Migration: Add Employee Status Fields
-- Add detailed employee status tracking

-- Add new columns to employees table
ALTER TABLE employees ADD COLUMN employment_status TEXT DEFAULT 'active'; -- 'active', 'inactive', 'terminated', 'resigned', 'retired', 'on_leave'
ALTER TABLE employees ADD COLUMN status_reason TEXT; -- Reason for status change
ALTER TABLE employees ADD COLUMN status_effective_date DATE; -- When status became effective
ALTER TABLE employees ADD COLUMN status_updated_by TEXT; -- employee_id who updated the status
ALTER TABLE employees ADD COLUMN status_notes TEXT; -- Additional notes about status change

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_employees_employment_status ON employees(employment_status);
CREATE INDEX IF NOT EXISTS idx_employees_status_effective_date ON employees(status_effective_date);
