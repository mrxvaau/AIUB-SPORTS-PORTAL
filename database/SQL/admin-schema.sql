-- Admin & Tournament Schema
-- Version 1.3
-- NOTE: This schema is deprecated. The application now uses Supabase (PostgreSQL).
-- See supabase_schema.sql for the current database schema.

-- Admins Table
CREATE TABLE admins (
    id NUMBER PRIMARY KEY,
    admin_id VARCHAR2(50) NOT NULL UNIQUE,
    email VARCHAR2(100) NOT NULL UNIQUE,
    full_name VARCHAR2(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE admin_id_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE TRIGGER admins_bir
BEFORE INSERT ON admins FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT admin_id_seq.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/

-- Tournaments Table
CREATE TABLE tournaments (
    id NUMBER PRIMARY KEY,
    title VARCHAR2(300) NOT NULL,
    photo_url CLOB,
    registration_deadline TIMESTAMP NOT NULL,
    status VARCHAR2(20) DEFAULT 'ACTIVE',
    created_by NUMBER REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_tournament_status CHECK (status IN ('ACTIVE', 'CLOSED', 'COMPLETED'))
);

CREATE SEQUENCE tournament_id_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE TRIGGER tournaments_bir
BEFORE INSERT ON tournaments FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT tournament_id_seq.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/

-- Tournament Games Table
CREATE TABLE tournament_games (
    id NUMBER PRIMARY KEY,
    tournament_id NUMBER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    category VARCHAR2(20) NOT NULL,
    game_name VARCHAR2(200) NOT NULL,
    game_type VARCHAR2(50) NOT NULL,
    fee_per_person NUMBER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_game_category CHECK (category IN ('Male', 'Female', 'Mix')),
    CONSTRAINT chk_game_type CHECK (game_type IN ('Solo', 'Duo', 'Custom'))
);

CREATE SEQUENCE game_id_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE TRIGGER games_bir
BEFORE INSERT ON tournament_games FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT game_id_seq.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/

-- Game Registrations Table
CREATE TABLE game_registrations (
    id NUMBER PRIMARY KEY,
    game_id NUMBER NOT NULL REFERENCES tournament_games(id) ON DELETE CASCADE,
    user_id NUMBER NOT NULL REFERENCES users(id),
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_status VARCHAR2(20) DEFAULT 'PENDING',
    CONSTRAINT chk_payment_status CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED'))
);

CREATE SEQUENCE registration_id_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE TRIGGER registrations_bir
BEFORE INSERT ON game_registrations FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT registration_id_seq.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/

-- Insert test admin
INSERT INTO admins (admin_id, email, full_name) 
VALUES ('admin001', 'admin@aiub.edu', 'System Admin');

COMMIT;

SELECT 'Admin schema created successfully!' FROM dual;