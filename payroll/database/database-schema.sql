-- BMGOne Payroll System Database Schema for Cloudflare D1
-- SQLite-compatible schema

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE NOT NULL, -- e.g., BMG2024001
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    phone TEXT,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff', -- 'staff', 'manager', 'admin'
    join_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave balances table
CREATE TABLE IF NOT EXISTS leave_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    leave_type TEXT NOT NULL, -- 'casual', 'sick', 'earned'
    total_days INTEGER NOT NULL DEFAULT 0,
    used_days INTEGER NOT NULL DEFAULT 0,
    balance_days INTEGER GENERATED ALWAYS AS (total_days - used_days) STORED,
    year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    UNIQUE(employee_id, leave_type, year)
);

-- Attendance records table
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    date DATE NOT NULL,
    login_time TIMESTAMP,
    logout_time TIMESTAMP,
    total_hours REAL,
    status TEXT NOT NULL DEFAULT 'present', -- 'present', 'absent', 'half_day', 'holiday'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    UNIQUE(employee_id, date)
);

-- Leave applications table
CREATE TABLE IF NOT EXISTS leave_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
    approved_by TEXT, -- employee_id of manager who approved
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (approved_by) REFERENCES employees(employee_id)
);

-- Holidays table
CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'gazetted', 'restricted', 'optional'
    year INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table for authentication
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    employee_id TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- Audit log for tracking changes
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT,
    action TEXT NOT NULL, -- 'login', 'logout', 'leave_apply', 'leave_approve', 'attendance_mark'
    table_name TEXT,
    record_id TEXT,
    old_values TEXT, -- JSON string
    new_values TEXT, -- JSON string
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id ON leave_balances(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_leave_applications_employee_id ON leave_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_status ON leave_applications(status);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_employee_id ON sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_employee_id ON audit_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Insert sample data
INSERT OR IGNORE INTO employees (employee_id, first_name, last_name, email, password_hash, department, position, role, join_date) VALUES
('BMG2024001', 'Staff', 'Member', 'staff@bmgone.com', '$2b$10$example_hash', 'HR Solutions', 'HR Executive', 'staff', '2024-01-15'),
('BMG2024002', 'John', 'Doe', 'john@bmgone.com', '$2b$10$example_hash', 'IT Consulting', 'Developer', 'staff', '2024-01-20'),
('BMG2024003', 'Jane', 'Smith', 'jane@bmgone.com', '$2b$10$example_hash', 'Business Consulting', 'Consultant', 'manager', '2023-06-10'),
('BMG2024004', 'Admin', 'User', 'admin@bmgone.com', '$2b$10$example_hash', 'Management', 'System Admin', 'admin', '2023-01-01');

INSERT OR IGNORE INTO leave_balances (employee_id, leave_type, total_days, year) VALUES
('BMG2024001', 'casual', 12, 2024),
('BMG2024001', 'sick', 8, 2024),
('BMG2024001', 'earned', 15, 2024),
('BMG2024002', 'casual', 12, 2024),
('BMG2024002', 'sick', 8, 2024),
('BMG2024002', 'earned', 15, 2024),
('BMG2024003', 'casual', 12, 2024),
('BMG2024003', 'sick', 8, 2024),
('BMG2024003', 'earned', 15, 2024);

INSERT OR IGNORE INTO holidays (date, name, type, year) VALUES
('2024-01-26', 'Republic Day', 'gazetted', 2024),
('2024-03-25', 'Holi', 'gazetted', 2024),
('2024-08-15', 'Independence Day', 'gazetted', 2024),
('2024-10-02', 'Gandhi Jayanti', 'gazetted', 2024),
('2024-10-31', 'Diwali', 'restricted', 2024),
('2024-12-25', 'Christmas', 'gazetted', 2024);
