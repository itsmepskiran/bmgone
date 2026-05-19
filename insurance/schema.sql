CREATE DATABASE IF NOT EXISTS bmgone_insurance;

USE bmgone_insurance;

CREATE TABLE IF NOT EXISTS insurance_quote_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    insurance_type VARCHAR(20) NOT NULL DEFAULT 'health',
    customer_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    city VARCHAR(100) NOT NULL,
    age INT,
    eldest_age INT,
    children_count VARCHAR(20),
    annual_income VARCHAR(100),
    plan_type VARCHAR(100),
    coverage VARCHAR(100),
    nominee VARCHAR(150),
    nominee_relationship VARCHAR(100),
    members_json JSON NOT NULL,
    requirements TEXT,
    lowest_annual_premium INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_insurance_type (insurance_type),
    INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS insurance_policy_quotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quote_request_id INT NOT NULL,
    provider VARCHAR(150) NOT NULL,
    plan_name VARCHAR(150) NOT NULL,
    cover_amount VARCHAR(100) NOT NULL,
    annual_premium INT NOT NULL,
    match_reason VARCHAR(255),
    features_json JSON,
    rank_order INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_quote_request_id (quote_request_id),
    CONSTRAINT fk_policy_quote_request
        FOREIGN KEY (quote_request_id)
        REFERENCES insurance_quote_requests(id)
        ON DELETE CASCADE
);
