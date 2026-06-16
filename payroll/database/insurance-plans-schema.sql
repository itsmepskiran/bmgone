-- Insurance Plans Management Table
-- Allows dynamic addition and management of insurance plans/providers

CREATE TABLE IF NOT EXISTS insurance_plans (
    plan_id TEXT PRIMARY KEY NOT NULL,       -- Unique: 'plan_1234567890_abc123def'
    plan_code TEXT UNIQUE NOT NULL,          -- Auto-generated unique code: 'ab', 'ic', 'ad' (first 2 chars of name)
    plan_name TEXT NOT NULL,                 -- 'Aditya Birla', 'ICICI Lombard', etc.
    plan_product_name TEXT,                  -- 'Activ One Max', 'Elevate', etc.
    premium REAL DEFAULT 0,                  -- Premium amount
    brand_color_dark TEXT DEFAULT '#000000', -- Primary color '#B71C1C'
    brand_color_light TEXT DEFAULT '#FFFFFF',-- Light background '#FFF5F5'
    brand_color_mid TEXT DEFAULT '#CCCCCC',  -- Medium color '#FFCDD2'
    brand_gradient TEXT DEFAULT '',          -- CSS gradient string
    logo_url TEXT DEFAULT '',                -- URL to logo image
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_insurance_plans_code ON insurance_plans(plan_code);
CREATE INDEX IF NOT EXISTS idx_insurance_plans_active ON insurance_plans(is_active);

-- Insert default insurance plans (from the original BRANDS array)
-- plan_id is unique per product, plan_code can be repeated for multiple products from same company
INSERT OR IGNORE INTO insurance_plans (plan_id, plan_code, plan_name, plan_product_name, premium, brand_color_dark, brand_color_light, brand_color_mid, brand_gradient, logo_url) VALUES
('plan_1704067200_ab001', 'ab', 'Aditya Birla', 'Activ One Max', 10271, '#B71C1C', '#FFF5F5', '#FFCDD2', 'linear-gradient(135deg,#B71C1C,#E53935)', '/logos/logo.png'),
('plan_1704067200_ic001', 'ic', 'ICICI Lombard', 'Elevate', 12213, '#BF360C', '#FFF3EE', '#FFCCBC', 'linear-gradient(135deg,#BF360C,#FF5722)', '/logos/logo.png'),
('plan_1704067200_star001', 'star', 'Star Health', 'Super Star', 11500, '#0D47A1', '#EEF3FF', '#BBDEFB', 'linear-gradient(135deg,#0D47A1,#1976D2)', '/logos/logo.png'),
('plan_1704067200_care001', 'care', 'Care Health', 'Care Supreme', 9800, '#E65100', '#FFFDE7', '#FFE082', 'linear-gradient(135deg,#E65100,#F9A825)', '/logos/logo.png'),
('plan_1704067200_tata001', 'tata', 'Tata AIG', 'Medicare Select', 13200, '#1A237E', '#F0F0FF', '#9FA8DA', 'linear-gradient(135deg,#1A237E,#3949AB)', '/logos/logo.png');
