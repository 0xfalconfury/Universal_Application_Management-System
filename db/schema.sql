-- ============================================
-- STUDENT APPLICATION PORTAL
-- PostgreSQL Database Schema
-- ============================================

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    university_id VARCHAR(50) NOT NULL UNIQUE,
    role VARCHAR(10) NOT NULL
        CHECK (role IN ('student', 'teacher', 'admin')),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(20),
    address TEXT,
    department VARCHAR(100),
    advisor VARCHAR(100),
    batch VARCHAR(20),
    id_card VARCHAR(255),
    id_card_file VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- APPLICATION TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL
        REFERENCES templates(id),
    letter_date DATE NOT NULL,
    institution_name VARCHAR(200) NOT NULL,
    authority_name VARCHAR(150) NOT NULL,
    final_letter TEXT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    feedback TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_status
ON users(status);

CREATE INDEX IF NOT EXISTS idx_applications_user_id
ON applications(user_id);

CREATE INDEX IF NOT EXISTS idx_applications_status
ON applications(status);

CREATE INDEX IF NOT EXISTS idx_applications_template_id
ON applications(template_id);

-- ============================================
-- END OF SCHEMA
-- ============================================