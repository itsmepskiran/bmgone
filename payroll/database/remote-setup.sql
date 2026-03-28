-- Basic setup for remote Cloudflare D1 database

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    phone TEXT NOT NULL,
    alternate_phone TEXT,
    date_of_birth DATE,
    gender TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    reporting_manager TEXT,
    join_date DATE NOT NULL,
    salary DECIMAL(10,2),
    bank_name TEXT,
    bank_account TEXT,
    ifsc_code TEXT,
    pan_number TEXT,
    aadhaar_number TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_first_login BOOLEAN DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create other tables
CREATE TABLE IF NOT EXISTS leave_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    leave_type TEXT NOT NULL,
    total_days INTEGER NOT NULL DEFAULT 0,
    used_days INTEGER NOT NULL DEFAULT 0,
    balance_days INTEGER GENERATED ALWAYS AS (total_days - used_days) STORED,
    year INTEGER NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    date DATE NOT NULL,
    login_time TIMESTAMP,
    logout_time TIMESTAMP,
    total_hours DECIMAL(5,2),
    status TEXT DEFAULT 'present',
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS leave_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    approved_by TEXT,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    type TEXT NOT NULL,
    year INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    UNIQUE(date, year)
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    employee_id TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id TEXT,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- Insert basic test users
INSERT OR REPLACE INTO employees (employee_id, first_name, last_name, email, password_hash, phone, department, position, role, join_date, is_first_login) 
VALUES ('BMGHYD00001', 'Master', 'Admin', 'masteradmin@bmgone.com', '$2b$10$YourHashedPasswordHere', '9808400500', 'Management', 'System Administrator', 'master_admin', '2023-01-01', 0);

INSERT OR REPLACE INTO employees (employee_id, first_name, last_name, email, password_hash, phone, department, position, role, join_date, is_first_login) 
VALUES ('BMGHYD00002', 'Admin', 'User', 'admin@bmgone.com', '$2b$10$YourHashedPasswordHere', '9808400501', 'HR', 'HR Manager', 'admin', '2023-06-01', 0);

INSERT OR REPLACE INTO employees (employee_id, first_name, last_name, email, password_hash, phone, department, position, role, join_date, is_first_login) 
VALUES ('BMGHYD12345', 'John', 'Doe', 'john@bmgone.com', '$2b$10$YourHashedPasswordHere', '9808400502', 'IT Consulting', 'Developer', 'staff', '2024-01-15', 1);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id ON leave_balances(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_leave_applications_employee_id ON leave_applications(employee_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_employee_id ON sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_employee_id ON audit_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
