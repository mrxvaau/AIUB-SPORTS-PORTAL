-- AIUB Sports Portal Database Schema
-- Oracle 10g PL/SQL
-- Version 1.0

-- Drop existing tables if they exist (for clean setup)
BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE users CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN
      IF SQLCODE != -942 THEN
         RAISE;
      END IF;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP SEQUENCE user_id_seq';
EXCEPTION
   WHEN OTHERS THEN
      IF SQLCODE != -2289 THEN
         RAISE;
      END IF;
END;
/

-- Create sequence for user IDs
CREATE SEQUENCE user_id_seq
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOCYCLE;
/

-- Create Users Table
CREATE TABLE users (
    id NUMBER PRIMARY KEY,
    student_id VARCHAR2(50) NOT NULL UNIQUE,
    email VARCHAR2(100) NOT NULL UNIQUE,
    full_name VARCHAR2(200),
    gender VARCHAR2(20),
    name_edit_count NUMBER DEFAULT 0,
    is_first_login NUMBER(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    CONSTRAINT chk_gender CHECK (gender IN ('Male', 'Female', 'Other', NULL)),
    CONSTRAINT chk_edit_count CHECK (name_edit_count >= 0 AND name_edit_count <= 3),
    CONSTRAINT chk_first_login CHECK (is_first_login IN (0, 1))
);
/

-- Create index for faster lookups
CREATE INDEX idx_student_id ON users(student_id);
CREATE INDEX idx_email ON users(email);
/

-- Trigger to automatically set ID using sequence
CREATE OR REPLACE TRIGGER users_bir
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
    IF :new.id IS NULL THEN
        SELECT user_id_seq.NEXTVAL INTO :new.id FROM dual;
    END IF;
END;
/

-- Trigger to update 'updated_at' timestamp
CREATE OR REPLACE TRIGGER users_bur
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    :new.updated_at := CURRENT_TIMESTAMP;
END;
/

-- Function to validate AIUB email format
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

-- Procedure to register new user
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

-- Procedure to update user profile
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

-- Function to get user profile
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

-- Insert some test data (optional)
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

-- Verify installation
SELECT 'Schema created successfully!' AS status FROM dual;
SELECT COUNT(*) AS total_users FROM users;

COMMIT;