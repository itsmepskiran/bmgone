-- ============================================
-- Create Departments Table
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
    department_id TEXT PRIMARY KEY,
    department_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Create Designations Table
-- ============================================
CREATE TABLE IF NOT EXISTS designations (
    designation_id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL,
    level TEXT NOT NULL,
    designation_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- ============================================
-- Insert Departments
-- ============================================
INSERT OR REPLACE INTO departments (department_id, department_name, is_active) VALUES ('HYD01', 'HR & Talent Acquisition', 1);
INSERT OR REPLACE INTO departments (department_id, department_name, is_active) VALUES ('HYD02', 'Insurance Services', 1);
INSERT OR REPLACE INTO departments (department_id, department_name, is_active) VALUES ('HYD03', 'Consulting & Advisory', 1);
INSERT OR REPLACE INTO departments (department_id, department_name, is_active) VALUES ('HYD04', 'Information Technology', 1);
INSERT OR REPLACE INTO departments (department_id, department_name, is_active) VALUES ('HYD05', 'Mutual Funds', 1);
INSERT OR REPLACE INTO departments (department_id, department_name, is_active) VALUES ('HYD06', 'Operations', 1);
INSERT OR REPLACE INTO departments (department_id, department_name, is_active) VALUES ('HYD07', 'Administration', 1);
INSERT OR REPLACE INTO departments (department_id, department_name, is_active) VALUES ('HYD08', 'Finance & Accounts', 1);
INSERT OR REPLACE INTO departments (department_id, department_name, is_active) VALUES ('HYD09', 'Sales & Marketing', 1);
INSERT OR REPLACE INTO departments (department_id, department_name, is_active) VALUES ('HYD10', 'Payroll & Compliance', 1);

-- ============================================
-- Insert Designations (HYD01)
-- ============================================
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG001', 'HYD01', 'E01', 'Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG002', 'HYD01', 'E02', 'Senior Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG003', 'HYD01', 'L01', 'Lead', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG004', 'HYD01', 'M01', 'Assistant Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG005', 'HYD01', 'M02', 'Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG006', 'HYD01', 'M03', 'Senior Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG007', 'HYD01', 'M04', 'Head of Department', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG008', 'HYD01', 'B01', 'Director', 1);

-- ============================================
-- Insert Designations (HYD02)
-- ============================================
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG009', 'HYD02', 'E01', 'Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG010', 'HYD02', 'E02', 'Senior Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG011', 'HYD02', 'L01', 'Lead', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG012', 'HYD02', 'M01', 'Assistant Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG013', 'HYD02', 'M02', 'Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG014', 'HYD02', 'M03', 'Senior Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG015', 'HYD02', 'M04', 'Head of Department', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG016', 'HYD02', 'B01', 'Director', 1);

-- ============================================
-- Insert Designations (HYD03)
-- ============================================
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG017', 'HYD03', 'E01', 'Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG018', 'HYD03', 'E02', 'Senior Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG019', 'HYD03', 'L01', 'Lead', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG020', 'HYD03', 'M01', 'Assistant Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG021', 'HYD03', 'M02', 'Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG022', 'HYD03', 'M03', 'Senior Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG023', 'HYD03', 'M04', 'Head of Department', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG024', 'HYD03', 'B01', 'Director', 1);

-- ============================================
-- Insert Designations (HYD04)
-- ============================================
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG025', 'HYD04', 'E01', 'Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG026', 'HYD04', 'E02', 'Senior Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG027', 'HYD04', 'L01', 'Lead', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG028', 'HYD04', 'M01', 'Assistant Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG029', 'HYD04', 'M02', 'Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG030', 'HYD04', 'M03', 'Senior Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG031', 'HYD04', 'M04', 'Head of Department', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG032', 'HYD04', 'B01', 'Director', 1);

-- ============================================
-- Insert Designations (HYD05)
-- ============================================
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG033', 'HYD05', 'E01', 'Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG034', 'HYD05', 'E02', 'Senior Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG035', 'HYD05', 'L01', 'Lead', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG036', 'HYD05', 'M01', 'Assistant Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG037', 'HYD05', 'M02', 'Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG038', 'HYD05', 'M03', 'Senior Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG039', 'HYD05', 'M04', 'Head of Department', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG040', 'HYD05', 'B01', 'Director', 1);

-- ============================================
-- Insert Designations (HYD06)
-- ============================================
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG041', 'HYD06', 'E01', 'Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG042', 'HYD06', 'E02', 'Senior Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG043', 'HYD06', 'L01', 'Lead', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG044', 'HYD06', 'M01', 'Assistant Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG045', 'HYD06', 'M02', 'Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG046', 'HYD06', 'M03', 'Senior Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG047', 'HYD06', 'M04', 'Head of Department', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG048', 'HYD06', 'B01', 'Director', 1);

-- ============================================
-- Insert Designations (HYD07)
-- ============================================
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG049', 'HYD07', 'E01', 'Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG050', 'HYD07', 'E02', 'Senior Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG051', 'HYD07', 'L01', 'Lead', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG052', 'HYD07', 'M01', 'Assistant Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG053', 'HYD07', 'M02', 'Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG054', 'HYD07', 'M03', 'Senior Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG055', 'HYD07', 'M04', 'Head of Department', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG056', 'HYD07', 'B01', 'Director', 1);

-- ============================================
-- Insert Designations (HYD08)
-- ============================================
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG057', 'HYD08', 'E01', 'Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG058', 'HYD08', 'E02', 'Senior Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG059', 'HYD08', 'L01', 'Lead', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG060', 'HYD08', 'M01', 'Assistant Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG061', 'HYD08', 'M02', 'Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG062', 'HYD08', 'M03', 'Senior Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG063', 'HYD08', 'M04', 'Head of Department', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG064', 'HYD08', 'B01', 'Director', 1);

-- ============================================
-- Insert Designations (HYD09)
-- ============================================
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG065', 'HYD09', 'E01', 'Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG066', 'HYD09', 'E02', 'Senior Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG067', 'HYD09', 'L01', 'Lead', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG068', 'HYD09', 'M01', 'Assistant Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG069', 'HYD09', 'M02', 'Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG070', 'HYD09', 'M03', 'Senior Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG071', 'HYD09', 'M04', 'Head of Department', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG072', 'HYD09', 'B01', 'Director', 1);

-- ============================================
-- Insert Designations (HYD10)
-- ============================================
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG073', 'HYD10', 'E01', 'Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG074', 'HYD10', 'E02', 'Senior Executive', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG075', 'HYD10', 'L01', 'Lead', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG076', 'HYD10', 'M01', 'Assistant Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG077', 'HYD10', 'M02', 'Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG078', 'HYD10', 'M03', 'Senior Manager', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG079', 'HYD10', 'M04', 'Head of Department', 1);
INSERT OR REPLACE INTO designations (designation_id, department_id, level, designation_name, is_active) VALUES ('BMG080', 'HYD10', 'B01', 'Director', 1);

-- ============================================
-- Create Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_designations_dept ON designations(department_id);
CREATE INDEX IF NOT EXISTS idx_designations_active ON designations(is_active);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);
