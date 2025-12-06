# Complete Database Schema Documentation

## Table of Contents
1. [Database Overview](#database-overview)
2. [Database Schema](#database-schema)
3. [Tables](#tables)
4. [Sequences](#sequences)
5. [Indexes](#indexes)
6. [Triggers](#triggers)
7. [Stored Procedures](#stored-procedures)
8. [Functions](#functions)
9. [Constraints](#constraints)
10. [Utility Queries](#utility-queries)

---

## Database Overview

### Project: AIUB Sports Portal
- **Database System**: Oracle 10g
- **Language**: PL/SQL
- **Version**: 1.3
- **Purpose**: Sports management system for American International University-Bangladesh

### Schema Evolution
- Version 1.0: Basic users table with registration logic
- Version 1.2: Enhanced users table with additional fields
- Version 1.3: Admin and tournament management tables

## Database Schema

### Entity Relationship Model
```
ADMINS (1) ||--o{ TOURNAMENTS (M)
TOURNAMENTS (1) ||--o{ TOURNAMENT_GAMES (M)
TOURNAMENT_GAMES (1) ||--o{ GAME_REGISTRATIONS (M)
USERS (1) ||--o{ GAME_REGISTRATIONS (M)
```

---

## Tables

### 1. USERS Table
**Description**: Stores student user information with profile management

```sql
CREATE TABLE users (
    id NUMBER PRIMARY KEY,
    student_id VARCHAR2(50) NOT NULL UNIQUE,
    email VARCHAR2(100) NOT NULL UNIQUE,
    full_name VARCHAR2(200),
    gender VARCHAR2(20),
    name_edit_count NUMBER DEFAULT 0,
    is_first_login NUMBER(1) DEFAULT 1,
    phone_number VARCHAR2(20),
    program_level VARCHAR2(20),
    department VARCHAR2(100),
    blood_group VARCHAR2(5),
    profile_completed NUMBER(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    CONSTRAINT chk_gender CHECK (gender IN ('Male', 'Female', 'Other', NULL)),
    CONSTRAINT chk_edit_count CHECK (name_edit_count >= 0 AND name_edit_count <= 3),
    CONSTRAINT chk_first_login CHECK (is_first_login IN (0, 1)),
    CONSTRAINT chk_program_level CHECK (program_level IN ('Undergraduate', 'Postgraduate', NULL)),
    CONSTRAINT chk_blood_group CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', NULL))
);
```

**Indexes**:
- `idx_student_id ON users(student_id)`
- `idx_email ON users(email)`

**Triggers**:
- `users_bir`: BEFORE INSERT to set ID using sequence
- `users_bur`: BEFORE UPDATE to update 'updated_at' timestamp

### 2. ADMINS Table
**Description**: Stores administrator account information

```sql
CREATE TABLE admins (
    id NUMBER PRIMARY KEY,
    admin_id VARCHAR2(50) NOT NULL UNIQUE,
    email VARCHAR2(100) NOT NULL UNIQUE,
    full_name VARCHAR2(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. TOURNAMENTS Table
**Description**: Stores tournament information with deadlines and status

```sql
CREATE TABLE tournaments (
    id NUMBER PRIMARY KEY,
    title VARCHAR2(300) NOT NULL,
    photo_url CLOB,
    registration_deadline TIMESTAMP NOT NULL,
    status VARCHAR2(20) DEFAULT 'ACTIVE',
    created_by NUMBER REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description VARCHAR2(1000),
    CONSTRAINT chk_tournament_status CHECK (status IN ('ACTIVE', 'CLOSED', 'COMPLETED'))
);
```

### 4. TOURNAMENT_GAMES Table
**Description**: Stores games within tournaments with categories and fees

```sql
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
```

### 5. GAME_REGISTRATIONS Table
**Description**: Stores user registrations for tournament games

```sql
CREATE TABLE game_registrations (
    id NUMBER PRIMARY KEY,
    game_id NUMBER NOT NULL REFERENCES tournament_games(id) ON DELETE CASCADE,
    user_id NUMBER NOT NULL REFERENCES users(id),
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_status VARCHAR2(20) DEFAULT 'PENDING',
    CONSTRAINT chk_payment_status CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED'))
);
```

---

## Sequences

### 1. User ID Sequence
```sql
CREATE SEQUENCE user_id_seq
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOCYCLE;
```

### 2. Admin ID Sequence
```sql
CREATE SEQUENCE admin_id_seq START WITH 1 INCREMENT BY 1;
```

### 3. Tournament ID Sequence
```sql
CREATE SEQUENCE tournament_id_seq START WITH 1 INCREMENT BY 1;
```

### 4. Game ID Sequence
```sql
CREATE SEQUENCE game_id_seq START WITH 1 INCREMENT BY 1;
```

### 5. Registration ID Sequence
```sql
CREATE SEQUENCE registration_id_seq START WITH 1 INCREMENT BY 1;
```

---

## Indexes

### 1. Student ID Index
```sql
CREATE INDEX idx_student_id ON users(student_id);
```

### 2. Email Index
```sql
CREATE INDEX idx_email ON users(email);
```

---

## Triggers

### 1. Users - Before Insert Row Trigger (users_bir)
**Purpose**: Automatically assigns ID using sequence for new records

```sql
CREATE OR REPLACE TRIGGER users_bir
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT user_id_seq.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/
```

### 2. Users - Before Update Row Trigger (users_bur)
**Purpose**: Updates 'updated_at' timestamp before record updates

```sql
CREATE OR REPLACE TRIGGER users_bur
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    :new.updated_at := CURRENT_TIMESTAMP;
END;
/
```

### 3. Admins - Before Insert Row Trigger (admins_bir)
**Purpose**: Automatically assigns ID using sequence for new admin records

```sql
CREATE OR REPLACE TRIGGER admins_bir
BEFORE INSERT ON admins FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT admin_id_seq.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/
```

### 4. Tournaments - Before Insert Row Trigger (tournaments_bir)
**Purpose**: Automatically assigns ID using sequence for new tournament records

```sql
CREATE OR REPLACE TRIGGER tournaments_bir
BEFORE INSERT ON tournaments FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT tournament_id_seq.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/
```

### 5. Tournament Games - Before Insert Row Trigger (games_bir)
**Purpose**: Automatically assigns ID using sequence for new game records

```sql
CREATE OR REPLACE TRIGGER games_bir
BEFORE INSERT ON tournament_games FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT game_id_seq.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/
```

### 6. Game Registrations - Before Insert Row Trigger (registrations_bir)
**Purpose**: Automatically assigns ID using sequence for new registration records

```sql
CREATE OR REPLACE TRIGGER registrations_bir
BEFORE INSERT ON game_registrations FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT registration_id_seq.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/
```

---

## Stored Procedures

### 1. Register User Procedure (register_user)
**Purpose**: Handles new user registration with validation and duplicate checking

**Parameters**:
- `p_student_id IN VARCHAR2` - Student ID in format XX-XXXXX-X
- `p_email IN VARCHAR2` - AIUB student email
- `p_user_id OUT NUMBER` - Output parameter for new user ID
- `p_status OUT VARCHAR2` - Output parameter for registration status

```sql
CREATE OR REPLACE PROCEDURE register_user(
    p_student_id IN VARCHAR2,
    p_email IN VARCHAR2,
    p_user_id OUT NUMBER,
    p_status OUT VARCHAR2
)
IS
    v_count NUMBER;
    v_valid NUMBER;
BEGIN
    -- Validate email format
    v_valid := validate_aiub_email(p_email);

    IF v_valid = 0 THEN
        p_status := 'INVALID_EMAIL';
        RETURN;
    END IF;

    -- Check if user already exists
    SELECT COUNT(*) INTO v_count
    FROM users
    WHERE student_id = p_student_id OR email = p_email;

    IF v_count > 0 THEN
        p_status := 'USER_EXISTS';
        SELECT id INTO p_user_id FROM users WHERE student_id = p_student_id;
    ELSE
        -- Insert new user
        INSERT INTO users (student_id, email, is_first_login, last_login)
        VALUES (p_student_id, p_email, 1, CURRENT_TIMESTAMP)
        RETURNING id INTO p_user_id;

        COMMIT;
        p_status := 'SUCCESS';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        p_status := 'ERROR: ' || SQLERRM;
        ROLLBACK;
END;
/
```

### 2. Update User Profile Procedure (update_user_profile)
**Purpose**: Manages profile updates with business rule enforcement (name edit limit, locked fields)

**Parameters**:
- `p_student_id IN VARCHAR2` - Student ID
- `p_full_name IN VARCHAR2` - New full name
- `p_gender IN VARCHAR2` - New gender
- `p_is_first_time IN NUMBER` - Flag for first-time setup
- `p_status OUT VARCHAR2` - Output parameter for update status

```sql
CREATE OR REPLACE PROCEDURE update_user_profile(
    p_student_id IN VARCHAR2,
    p_full_name IN VARCHAR2,
    p_gender IN VARCHAR2,
    p_is_first_time IN NUMBER,
    p_status OUT VARCHAR2
)
IS
    v_current_count NUMBER;
    v_current_name VARCHAR2(200);
    v_is_first NUMBER;
BEGIN
    -- Get current user data
    SELECT name_edit_count, full_name, is_first_login
    INTO v_current_count, v_current_name, v_is_first
    FROM users
    WHERE student_id = p_student_id;

    -- First time profile completion
    IF p_is_first_time = 1 THEN
        UPDATE users
        SET full_name = p_full_name,
            gender = p_gender,
            is_first_login = 0,
            name_edit_count = 0,
            last_login = CURRENT_TIMESTAMP
        WHERE student_id = p_student_id;

        COMMIT;
        p_status := 'PROFILE_CREATED';
        RETURN;
    END IF;

    -- Subsequent updates
    -- Check if name is being changed
    IF v_current_name != p_full_name THEN
        IF v_current_count >= 3 THEN
            p_status := 'NAME_EDIT_LIMIT_REACHED';
            RETURN;
        END IF;

        UPDATE users
        SET full_name = p_full_name,
            name_edit_count = v_current_count + 1,
            last_login = CURRENT_TIMESTAMP
        WHERE student_id = p_student_id;

        COMMIT;
        p_status := 'NAME_UPDATED';
    ELSE
        -- Just update last login
        UPDATE users
        SET last_login = CURRENT_TIMESTAMP
        WHERE student_id = p_student_id;

        COMMIT;
        p_status := 'LOGIN_UPDATED';
    END IF;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        p_status := 'USER_NOT_FOUND';
    WHEN OTHERS THEN
        p_status := 'ERROR: ' || SQLERRM;
        ROLLBACK;
END;
/
```

---

## Functions

### 1. Validate AIUB Email Function (validate_aiub_email)
**Purpose**: Validates AIUB email format (XX-XXXXX-X@student.aiub.edu)

**Parameters**:
- `p_email IN VARCHAR2` - Email to validate

**Return**: `NUMBER` (1 for valid, 0 for invalid)

```sql
CREATE OR REPLACE FUNCTION validate_aiub_email(p_email IN VARCHAR2)
RETURN NUMBER
IS
    v_pattern VARCHAR2(100) := '^\d{2}-\d{5}-\d@student\.aiub\.edu$';
BEGIN
    IF REGEXP_LIKE(p_email, v_pattern) THEN
        RETURN 1; -- Valid
    ELSE
        RETURN 0; -- Invalid
    END IF;
END;
/
```

### 2. Get User Profile Function (get_user_profile)
**Purpose**: Retrieves user profile data

**Parameters**:
- `p_student_id IN VARCHAR2` - Student ID to look up

**Return**: `SYS_REFCURSOR` with user data

```sql
CREATE OR REPLACE FUNCTION get_user_profile(p_student_id IN VARCHAR2)
RETURN SYS_REFCURSOR
IS
    v_cursor SYS_REFCURSOR;
BEGIN
    OPEN v_cursor FOR
        SELECT
            id,
            student_id,
            email,
            full_name,
            gender,
            name_edit_count,
            is_first_login,
            created_at,
            updated_at,
            last_login
        FROM users
        WHERE student_id = p_student_id;

    RETURN v_cursor;
END;
/
```

---

## Constraints

### 1. Users Table Constraints
```sql
-- Gender check constraint
ALTER TABLE users ADD CONSTRAINT chk_gender
CHECK (gender IN ('Male', 'Female', 'Other', NULL));

-- Name edit count constraint (0-3 allowed)
ALTER TABLE users ADD CONSTRAINT chk_edit_count
CHECK (name_edit_count >= 0 AND name_edit_count <= 3);

-- First login flag constraint
ALTER TABLE users ADD CONSTRAINT chk_first_login
CHECK (is_first_login IN (0, 1));

-- Program level constraint
ALTER TABLE users ADD CONSTRAINT chk_program_level
CHECK (program_level IN ('Undergraduate', 'Postgraduate', NULL));

-- Blood group constraint
ALTER TABLE users ADD CONSTRAINT chk_blood_group
CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', NULL));

-- Profile completed constraint
ALTER TABLE users ADD CONSTRAINT chk_profile_completed
CHECK (profile_completed IN (0, 1, NULL));
```

### 2. Tournaments Table Constraints
```sql
-- Tournament status constraint
ALTER TABLE tournaments ADD CONSTRAINT chk_tournament_status
CHECK (status IN ('ACTIVE', 'CLOSED', 'COMPLETED'));
```

### 3. Tournament Games Table Constraints
```sql
-- Game category constraint
ALTER TABLE tournament_games ADD CONSTRAINT chk_game_category
CHECK (category IN ('Male', 'Female', 'Mix'));

-- Game type constraint
ALTER TABLE tournament_games ADD CONSTRAINT chk_game_type
CHECK (game_type IN ('Solo', 'Duo', 'Custom'));
```

### 4. Game Registrations Table Constraints
```sql
-- Payment status constraint
ALTER TABLE game_registrations ADD CONSTRAINT chk_payment_status
CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED'));
```

---

## Utility Queries

### 1. Verification Queries
```sql
-- Verify schema creation
SELECT 'Schema created successfully!' AS status FROM dual;
SELECT COUNT(*) AS total_users FROM users;
SELECT COUNT(*) AS total_admins FROM admins;
SELECT COUNT(*) AS total_tournaments FROM tournaments;
SELECT COUNT(*) AS total_games FROM tournament_games;
SELECT COUNT(*) AS total_registrations FROM game_registrations;
```

### 2. Common Administrative Queries
```sql
-- Get all active tournaments with registration deadlines
SELECT id, title, TO_CHAR(registration_deadline, 'YYYY-MM-DD HH24:MI:SS') as deadline, status
FROM tournaments
WHERE status = 'ACTIVE'
  AND registration_deadline > CURRENT_TIMESTAMP
ORDER BY registration_deadline ASC;

-- Get all games for a specific tournament
SELECT id, category, game_name, game_type, fee_per_person
FROM tournament_games
WHERE tournament_id = :tournament_id
ORDER BY category, game_name;

-- Get user registrations
SELECT
    gr.id as registration_id,
    tg.game_name,
    tg.category,
    tg.game_type,
    tg.fee_per_person,
    t.title as tournament_title,
    gr.payment_status,
    TO_CHAR(gr.registration_date, 'YYYY-MM-DD HH24:MI:SS') as registration_date
FROM game_registrations gr
JOIN tournament_games tg ON gr.game_id = tg.id
JOIN tournaments t ON tg.tournament_id = t.id
WHERE gr.user_id = :user_id
ORDER BY gr.registration_date DESC;

-- Check if user is admin
SELECT id, admin_id, email, full_name FROM admins WHERE email = :email;
```

### 3. Test Data Insertions
```sql
-- Insert test admin
INSERT INTO admins (admin_id, email, full_name)
VALUES ('admin001', 'admin@aiub.edu', 'System Admin');

-- Insert test user (from original schema)
BEGIN
    DECLARE
        v_user_id NUMBER;
        v_status VARCHAR2(100);
    BEGIN
        -- Test user 1
        register_user('24-56434-1', '24-56434-1@student.aiub.edu', v_user_id, v_status);
        DBMS_OUTPUT.PUT_LINE('Test User 1: ' || v_status);
    END;
END;
/
```

### 4. Schema Alterations
```sql
-- Add description column to tournaments table
ALTER TABLE tournaments ADD description VARCHAR2(1000);
```

---

## Summary

This database schema implements a comprehensive sports management system with the following key features:

1. **User Profile Management**: With strict business rules for name editing and field locking
2. **Tournament Management**: Complete CRUD operations for tournaments and games
3. **Registration System**: With payment status tracking
4. **Security**: Email validation, access control, and constraints
5. **Scalability**: Proper indexing and normalization
6. **Data Integrity**: Comprehensive constraint system

The schema is designed to support the AIUB Sports Portal's core functionality while maintaining data integrity and enforcing business rules at the database level.