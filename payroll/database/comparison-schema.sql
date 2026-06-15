-- Health Insurance Plan Comparison Schema
-- Tables for managing comparison questionnaires and providers

CREATE TABLE IF NOT EXISTS comparison_brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id TEXT UNIQUE NOT NULL,  -- 'ab', 'ic', 'star', 'care', 'tata'
    brand_name TEXT NOT NULL,        -- 'Aditya Birla', 'ICICI Lombard', etc.
    plan_name TEXT NOT NULL,         -- 'Activ One Max', 'Elevate', etc.
    premium_default TEXT NOT NULL,   -- Default premium '₹10,271'
    color_dark TEXT NOT NULL,        -- Primary color '#B71C1C'
    color_light TEXT NOT NULL,       -- Light background '#FFF5F5'
    color_mid TEXT NOT NULL,         -- Medium color '#FFCDD2'
    gradient TEXT NOT NULL,          -- CSS gradient
    logo_url TEXT,                   -- URL to logo image
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comparison_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id TEXT UNIQUE NOT NULL, -- 'tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6'
    tier_number INTEGER NOT NULL,    -- 1-6
    section_label TEXT NOT NULL,     -- 'TIER 1 — THE FOUNDATION | Deal Breakers'
    section_color TEXT NOT NULL,     -- Color for section header
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comparison_features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature_id TEXT UNIQUE NOT NULL, -- 'inpatient', 'roomrent', 'prepost', etc.
    section_id TEXT NOT NULL,        -- Foreign key to comparison_sections
    feature_label TEXT NOT NULL,     -- 'In-patient Treatment', 'No Room Rent Capping', etc.
    feature_description TEXT,        -- Additional explanation
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES comparison_sections(section_id)
);

CREATE TABLE IF NOT EXISTS comparison_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature_id TEXT NOT NULL,        -- Foreign key to comparison_features
    brand_id TEXT NOT NULL,          -- Foreign key to comparison_brands
    value_type TEXT NOT NULL,        -- 'Y' (Yes), 'N' (No), 'E' (Equivalent/Special)
    notes TEXT,                      -- Extra details like '90/180 days', 'Add-on', etc.
    explanation TEXT,                -- Detailed explanation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feature_id) REFERENCES comparison_features(feature_id),
    FOREIGN KEY (brand_id) REFERENCES comparison_brands(brand_id),
    UNIQUE(feature_id, brand_id)
);

-- Staff Comparison Preferences (which providers they want to compare)
CREATE TABLE IF NOT EXISTS staff_comparison_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    selected_brand_ids TEXT NOT NULL, -- JSON array of brand_ids ['ab','ic','star']
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    UNIQUE(employee_id)
);

-- Comparison report history (for audit trail)
CREATE TABLE IF NOT EXISTS comparison_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    client_name TEXT,
    client_age INTEGER,
    members_count TEXT,
    selected_brands TEXT,  -- JSON array of selected brands
    report_data TEXT,      -- JSON blob of the comparison data used
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comparison_features_section ON comparison_features(section_id);
CREATE INDEX IF NOT EXISTS idx_comparison_values_feature ON comparison_values(feature_id);
CREATE INDEX IF NOT EXISTS idx_comparison_values_brand ON comparison_values(brand_id);
CREATE INDEX IF NOT EXISTS idx_staff_preferences_employee ON staff_comparison_preferences(employee_id);
CREATE INDEX IF NOT EXISTS idx_comparison_reports_employee ON comparison_reports(employee_id);

-- Insert comparison brands data
INSERT OR IGNORE INTO comparison_brands (brand_id, brand_name, plan_name, premium_default, color_dark, color_light, color_mid, gradient, sort_order) VALUES
('ab', 'Aditya Birla', 'Activ One Max', '₹10,271', '#B71C1C', '#FFF5F5', '#FFCDD2', 'linear-gradient(135deg,#B71C1C,#E53935)', 1),
('ic', 'ICICI Lombard', 'Elevate', '₹12,213', '#BF360C', '#FFF3EE', '#FFCCBC', 'linear-gradient(135deg,#BF360C,#FF5722)', 2),
('star', 'Star Health', 'Super Star', '₹11,500', '#0D47A1', '#EEF3FF', '#BBDEFB', 'linear-gradient(135deg,#0D47A1,#1976D2)', 3),
('care', 'Care Health', 'Care Supreme', '₹9,800', '#E65100', '#FFFDE7', '#FFE082', 'linear-gradient(135deg,#E65100,#F9A825)', 4),
('tata', 'Tata AIG', 'Medicare Select', '₹13,200', '#1A237E', '#F0F0FF', '#9FA8DA', 'linear-gradient(135deg,#1A237E,#3949AB)', 5);

-- Insert sections (tiers)
INSERT OR IGNORE INTO comparison_sections (section_id, tier_number, section_label, section_color, sort_order) VALUES
('tier1', 1, 'TIER 1 — THE FOUNDATION | Deal Breakers', '#263238', 1),
('tier2', 2, 'TIER 2 — WAITING PERIODS | Hidden Traps', '#37474F', 2),
('tier3', 3, 'TIER 3 — RESTORATION & BONUS | Long Term Value', '#455A64', 3),
('tier4', 4, 'TIER 4 — ADDITIONAL BENEFITS | What Makes a Plan Stand Out', '#546E7A', 4),
('tier5', 5, 'TIER 5 — MATERNITY & NEW BORN BENEFITS', '#607D8B', 5),
('tier6', 6, 'TIER 6 — SPECIAL / UNIQUE FEATURES', '#78909C', 6);

-- Insert comparison features (all 47 questionnaires)
-- TIER 1: Foundation (12 features)
INSERT OR IGNORE INTO comparison_features (feature_id, section_id, feature_label, sort_order) VALUES
('inpatient', 'tier1', 'In-patient Treatment', 1),
('roomrent', 'tier1', 'No Room Rent Capping', 2),
('prepost', 'tier1', 'Pre & Post Hospitalisation', 3),
('icu', 'tier1', 'No ICU Limits', 4),
('copay', 'tier1', 'No Co-Payment', 5),
('sublimits', 'tier1', 'No Sub Limits', 6),
('teleconsult', 'tier1', 'Unlimited Tele Consultation', 7),
('2hrhosp', 'tier1', '2 Hours Hospitalisation', 8),
('opd', 'tier1', 'OPD (Out Patient Department) Cover', 9),
('healthcheck', 'tier1', 'Annual Health Check Up', 10),
('2xcoverage', 'tier1', '2X Coverage From Day 1', 11),
('cashlessnetwork', 'tier1', 'Cashless Hospital Network', 12);

-- TIER 2: Waiting Periods (8 features)
INSERT OR IGNORE INTO comparison_features (feature_id, section_id, feature_label, sort_order) VALUES
('ped', 'tier2', 'PED Waiting Period', 1),
('matwait', 'tier2', 'Maternity Coverage & Waiting Period', 2),
('worldwide', 'tier2', 'Worldwide Cover Waiting Period', 3),
('specificred', 'tier2', 'Specific Illness WP Reduction to 1 Year', 4),
('kidney', 'tier2', 'Kidney Stones / Cataract / Knee Replacement WP', 5),
('bariatric', 'tier2', 'Bariatric Surgery', 6),
('diabpolicy', 'tier2', 'Diabetic Type 2 — Policy Issuance', 7),
('heartstent', 'tier2', 'Heart Stent — Policy Issuance', 8);

-- TIER 3: Restoration & Bonus (7 features)
INSERT OR IGNORE INTO comparison_features (feature_id, section_id, feature_label, sort_order) VALUES
('restore', 'tier3', 'Restoration Benefit', 1),
('bonus', 'tier3', 'Unlimited Bonus (NCB / Loyalty)', 2),
('nonpay', 'tier3', 'Non-Payable Items Cover (Consumables)', 3),
('infincare', 'tier3', 'Infinite Care (Unlimited SI)', 4),
('premreturn', 'tier3', 'Premium Return Benefit', 5),
('steps', 'tier3', 'Free / Discount on Renewal — 10,000 Daily Steps', 6),
('agefreezing', 'tier3', 'Premium Age Freezing', 7);

-- TIER 4: Additional Benefits (11 features)
INSERT OR IGNORE INTO comparison_features (feature_id, section_id, feature_label, sort_order) VALUES
('daycare', 'tier4', 'Day Care Procedures / Treatment', 1),
('domicil', 'tier4', 'Domiciliary Hospitalisation', 2),
('ambulance', 'tier4', 'Domestic Road Ambulance', 3),
('airambulance', 'tier4', 'Domestic Air Ambulance Cover', 4),
('donor', 'tier4', 'Donor Expenses', 5),
('modern', 'tier4', 'Modern Treatment (Robotic / Laser)', 6),
('ayush', 'tier4', 'In-patient AYUSH Hospitalisation', 7),
('cashless', 'tier4', 'Everywhere Cashless', 8),
('dme', 'tier4', 'Durable Medical Equipment Cover', 9),
('pad', 'tier4', 'Personal Accidental Death Benefit', 10),
('dental', 'tier4', 'Dental Care Cover', 11);

-- TIER 5: Maternity & New Born (3 features)
INSERT OR IGNORE INTO comparison_features (feature_id, section_id, feature_label, sort_order) VALUES
('matcoverage', 'tier5', 'Maternity Expenses Coverage', 1),
('newborn', 'tier5', 'New Born Baby Coverage with Maternity', 2),
('vaccination', 'tier5', 'Vaccination Coverage for New Born', 3);

-- TIER 6: Special Features (6 features)
INSERT OR IGNORE INTO comparison_features (feature_id, section_id, feature_label, sort_order) VALUES
('wellness', 'tier6', 'Wellness Program / BeFit', 1),
('depaccom', 'tier6', 'Dependent Accommodation Benefit', 2),
('surrogate', 'tier6', 'In-patient Hospitalisation (Surrogate Mother)', 3),
('oocyte', 'tier6', 'In-patient Hospitalisation (Oocyte Donor)', 4),
('childagelimit', 'tier6', 'Child Considered as Kid — Age Limit', 5),
('unlimitedcov', 'tier6', 'Unlimited Coverage Option', 6);

-- Insert comparison values (TIER 1)
INSERT OR IGNORE INTO comparison_values (feature_id, brand_id, value_type, notes) VALUES
('inpatient', 'ab', 'Y', ''),
('inpatient', 'ic', 'Y', ''),
('inpatient', 'star', 'Y', ''),
('inpatient', 'care', 'Y', ''),
('inpatient', 'tata', 'Y', ''),

('roomrent', 'ab', 'Y', 'Any Room'),
('roomrent', 'ic', 'N', 'Single AC'),
('roomrent', 'star', 'Y', 'Any Room'),
('roomrent', 'care', 'Y', 'Any Room'),
('roomrent', 'tata', 'N', 'Single AC'),

('prepost', 'ab', 'Y', '90/180 days'),
('prepost', 'ic', 'Y', '90/180 days'),
('prepost', 'star', 'Y', '60/180 days'),
('prepost', 'care', 'Y', '90/180 days'),
('prepost', 'tata', 'Y', '60/180 days'),

('icu', 'ab', 'Y', 'No Limit'),
('icu', 'ic', 'Y', 'No Limit'),
('icu', 'star', 'Y', 'No Limit'),
('icu', 'care', 'Y', 'No Limit'),
('icu', 'tata', 'Y', 'No Limit'),

('copay', 'ab', 'Y', '0%'),
('copay', 'ic', 'Y', '0%'),
('copay', 'star', 'Y', '0%'),
('copay', 'care', 'Y', '0%'),
('copay', 'tata', 'Y', '0%'),

('sublimits', 'ab', 'Y', 'Nil'),
('sublimits', 'ic', 'Y', 'Nil'),
('sublimits', 'star', 'Y', 'Nil'),
('sublimits', 'care', 'Y', 'Nil'),
('sublimits', 'tata', 'Y', 'Nil'),

('teleconsult', 'ab', 'N', 'Add-on'),
('teleconsult', 'ic', 'N', 'Add-on'),
('teleconsult', 'star', 'N', 'Add-on'),
('teleconsult', 'care', 'N', 'Add-on'),
('teleconsult', 'tata', 'N', 'Add-on'),

('2hrhosp', 'ab', 'Y', 'Yes'),
('2hrhosp', 'ic', 'Y', 'Yes'),
('2hrhosp', 'star', 'N', 'No'),
('2hrhosp', 'care', 'Y', 'Yes'),
('2hrhosp', 'tata', 'N', 'No'),

('opd', 'ab', 'E', ''),
('opd', 'ic', 'E', ''),
('opd', 'star', 'E', ''),
('opd', 'care', 'E', ''),
('opd', 'tata', 'E', ''),

('healthcheck', 'ab', 'Y', 'Yes'),
('healthcheck', 'ic', 'N', 'Add-on'),
('healthcheck', 'star', 'Y', 'Yes'),
('healthcheck', 'care', 'Y', 'Yes'),
('healthcheck', 'tata', 'Y', 'Yes'),

('2xcoverage', 'ab', 'E', ''),
('2xcoverage', 'ic', 'E', ''),
('2xcoverage', 'star', 'E', ''),
('2xcoverage', 'care', 'E', ''),
('2xcoverage', 'tata', 'E', ''),

('cashlessnetwork', 'ab', 'N', ''),
('cashlessnetwork', 'ic', 'Y', ''),
('cashlessnetwork', 'star', 'N', ''),
('cashlessnetwork', 'care', 'N', ''),
('cashlessnetwork', 'tata', 'N', '');

-- TIER 2 Values
INSERT OR IGNORE INTO comparison_values (feature_id, brand_id, value_type, notes) VALUES
('ped', 'ab', 'Y', '36 months'),
('ped', 'ic', 'Y', '36 months'),
('ped', 'star', 'N', '48 months'),
('ped', 'care', 'Y', '36 months'),
('ped', 'tata', 'N', '48 months'),

('matwait', 'ab', 'N', 'Not covered'),
('matwait', 'ic', 'Y', '2 Yrs Add-on'),
('matwait', 'star', 'Y', '1 Yr Add-on'),
('matwait', 'care', 'Y', '2 Yrs Add-on'),
('matwait', 'tata', 'Y', '2 Yrs Add-on'),

('worldwide', 'ab', 'N', 'Not available'),
('worldwide', 'ic', 'Y', 'Add-on'),
('worldwide', 'star', 'N', 'Not available'),
('worldwide', 'care', 'N', 'Not available'),
('worldwide', 'tata', 'Y', 'Add-on'),

('specificred', 'ab', 'E', ''),
('specificred', 'ic', 'E', ''),
('specificred', 'star', 'E', ''),
('specificred', 'care', 'E', ''),
('specificred', 'tata', 'E', ''),

('kidney', 'ab', 'Y', '2 Years'),
('kidney', 'ic', 'N', '3 Years'),
('kidney', 'star', 'N', '3 Years'),
('kidney', 'care', 'Y', '2 Years'),
('kidney', 'tata', 'N', '3 Years'),

('bariatric', 'ab', 'Y', '2 Years'),
('bariatric', 'ic', 'N', '3 Years'),
('bariatric', 'star', 'N', '3 Years'),
('bariatric', 'care', 'Y', '2 Years'),
('bariatric', 'tata', 'N', '3 Years'),

('diabpolicy', 'ab', 'E', ''),
('diabpolicy', 'ic', 'E', ''),
('diabpolicy', 'star', 'E', ''),
('diabpolicy', 'care', 'E', ''),
('diabpolicy', 'tata', 'E', ''),

('heartstent', 'ab', 'E', ''),
('heartstent', 'ic', 'E', ''),
('heartstent', 'star', 'E', ''),
('heartstent', 'care', 'E', ''),
('heartstent', 'tata', 'E', '');

-- TIER 3 Values
INSERT OR IGNORE INTO comparison_values (feature_id, brand_id, value_type, notes) VALUES
('restore', 'ab', 'Y', 'Unlimited'),
('restore', 'ic', 'Y', 'Unlimited'),
('restore', 'star', 'Y', 'Unlimited'),
('restore', 'care', 'Y', 'Unlimited'),
('restore', 'tata', 'Y', 'Unlimited'),

('bonus', 'ab', 'Y', 'Upto 500%'),
('bonus', 'ic', 'Y', 'Upto 100%'),
('bonus', 'star', 'Y', 'Upto 100%'),
('bonus', 'care', 'Y', 'Upto 50%'),
('bonus', 'tata', 'Y', 'Upto 50%'),

('nonpay', 'ab', 'Y', 'Covered'),
('nonpay', 'ic', 'Y', 'Add-on'),
('nonpay', 'star', 'Y', 'Add-on'),
('nonpay', 'care', 'Y', 'Covered'),
('nonpay', 'tata', 'Y', 'Covered'),

('infincare', 'ab', 'E', ''),
('infincare', 'ic', 'E', ''),
('infincare', 'star', 'E', ''),
('infincare', 'care', 'E', ''),
('infincare', 'tata', 'E', ''),

('premreturn', 'ab', 'E', ''),
('premreturn', 'ic', 'E', ''),
('premreturn', 'star', 'E', ''),
('premreturn', 'care', 'E', ''),
('premreturn', 'tata', 'E', ''),

('steps', 'ab', 'Y', 'Upto 100%'),
('steps', 'ic', 'N', 'No'),
('steps', 'star', 'N', 'No'),
('steps', 'care', 'N', 'No'),
('steps', 'tata', 'N', 'No'),

('agefreezing', 'ab', 'E', ''),
('agefreezing', 'ic', 'E', ''),
('agefreezing', 'star', 'E', ''),
('agefreezing', 'care', 'E', ''),
('agefreezing', 'tata', 'E', '');

-- TIER 4 Values
INSERT OR IGNORE INTO comparison_values (feature_id, brand_id, value_type, notes) VALUES
('daycare', 'ab', 'Y', 'Covered'),
('daycare', 'ic', 'Y', 'Covered'),
('daycare', 'star', 'Y', 'Covered'),
('daycare', 'care', 'Y', 'Covered'),
('daycare', 'tata', 'Y', 'Covered'),

('domicil', 'ab', 'Y', 'Upto SI'),
('domicil', 'ic', 'Y', 'Upto SI'),
('domicil', 'star', 'Y', 'Upto SI'),
('domicil', 'care', 'Y', 'Upto SI'),
('domicil', 'tata', 'Y', 'Upto SI'),

('ambulance', 'ab', 'Y', 'Covered'),
('ambulance', 'ic', 'Y', 'Covered'),
('ambulance', 'star', 'Y', 'Covered'),
('ambulance', 'care', 'Y', 'Covered'),
('ambulance', 'tata', 'Y', 'Covered'),

('airambulance', 'ab', 'E', ''),
('airambulance', 'ic', 'E', ''),
('airambulance', 'star', 'E', ''),
('airambulance', 'care', 'E', ''),
('airambulance', 'tata', 'E', ''),

('donor', 'ab', 'Y', 'Upto SI'),
('donor', 'ic', 'Y', 'Upto SI'),
('donor', 'star', 'Y', 'Upto SI'),
('donor', 'care', 'Y', 'Upto SI'),
('donor', 'tata', 'Y', 'Upto SI'),

('modern', 'ab', 'Y', 'Covered'),
('modern', 'ic', 'Y', 'Covered'),
('modern', 'star', 'Y', 'Covered'),
('modern', 'care', 'Y', 'Covered'),
('modern', 'tata', 'Y', 'Covered'),

('ayush', 'ab', 'Y', 'Upto SI'),
('ayush', 'ic', 'Y', 'Upto SI'),
('ayush', 'star', 'Y', 'Upto SI'),
('ayush', 'care', 'Y', 'Upto SI'),
('ayush', 'tata', 'Y', 'Upto SI'),

('cashless', 'ab', 'N', ''),
('cashless', 'ic', 'Y', 'Yes'),
('cashless', 'star', 'N', ''),
('cashless', 'care', 'N', ''),
('cashless', 'tata', 'N', ''),

('dme', 'ab', 'E', ''),
('dme', 'ic', 'E', ''),
('dme', 'star', 'E', ''),
('dme', 'care', 'E', ''),
('dme', 'tata', 'E', ''),

('pad', 'ab', 'E', ''),
('pad', 'ic', 'E', ''),
('pad', 'star', 'E', ''),
('pad', 'care', 'E', ''),
('pad', 'tata', 'E', ''),

('dental', 'ab', 'E', ''),
('dental', 'ic', 'E', ''),
('dental', 'star', 'E', ''),
('dental', 'care', 'E', ''),
('dental', 'tata', 'E', '');

-- TIER 5 Values
INSERT OR IGNORE INTO comparison_values (feature_id, brand_id, value_type, notes) VALUES
('matcoverage', 'ab', 'N', 'Not covered'),
('matcoverage', 'ic', 'Y', 'Add-on'),
('matcoverage', 'star', 'Y', 'Add-on'),
('matcoverage', 'care', 'Y', 'Add-on'),
('matcoverage', 'tata', 'Y', 'Add-on'),

('newborn', 'ab', 'E', ''),
('newborn', 'ic', 'E', ''),
('newborn', 'star', 'E', ''),
('newborn', 'care', 'E', ''),
('newborn', 'tata', 'E', ''),

('vaccination', 'ab', 'E', ''),
('vaccination', 'ic', 'E', ''),
('vaccination', 'star', 'E', ''),
('vaccination', 'care', 'E', ''),
('vaccination', 'tata', 'E', '');

-- TIER 6 Values
INSERT OR IGNORE INTO comparison_values (feature_id, brand_id, value_type, notes) VALUES
('wellness', 'ab', 'Y', 'Yes'),
('wellness', 'ic', 'N', 'Add-on'),
('wellness', 'star', 'Y', 'Yes'),
('wellness', 'care', 'Y', 'Yes'),
('wellness', 'tata', 'Y', 'Yes'),

('depaccom', 'ab', 'E', ''),
('depaccom', 'ic', 'E', ''),
('depaccom', 'star', 'E', ''),
('depaccom', 'care', 'E', ''),
('depaccom', 'tata', 'E', ''),

('surrogate', 'ab', 'E', ''),
('surrogate', 'ic', 'E', ''),
('surrogate', 'star', 'E', ''),
('surrogate', 'care', 'E', ''),
('surrogate', 'tata', 'E', ''),

('oocyte', 'ab', 'E', ''),
('oocyte', 'ic', 'E', ''),
('oocyte', 'star', 'E', ''),
('oocyte', 'care', 'E', ''),
('oocyte', 'tata', 'E', ''),

('childagelimit', 'ab', 'E', ''),
('childagelimit', 'ic', 'E', ''),
('childagelimit', 'star', 'E', ''),
('childagelimit', 'care', 'E', ''),
('childagelimit', 'tata', 'E', ''),

('unlimitedcov', 'ab', 'N', ''),
('unlimitedcov', 'ic', 'Y', 'Yes'),
('unlimitedcov', 'star', 'N', ''),
('unlimitedcov', 'care', 'N', ''),
('unlimitedcov', 'tata', 'N', '');
