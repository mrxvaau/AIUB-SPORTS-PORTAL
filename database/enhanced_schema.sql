-- Enhanced Schema - Add new fields to users table
-- Version 1.2

-- Add new columns to existing users table
ALTER TABLE users ADD (
    phone_number VARCHAR2(20),
    program_level VARCHAR2(20),
    department VARCHAR2(100),
    blood_group VARCHAR2(5),
    profile_completed NUMBER(1) DEFAULT 0,
    CONSTRAINT chk_program_level CHECK (program_level IN ('Undergraduate', 'Postgraduate', NULL)),
    CONSTRAINT chk_blood_group CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', NULL))
);

-- Add comment for documentation
COMMENT ON COLUMN users.phone_number IS 'User phone number - editable anytime';
COMMENT ON COLUMN users.program_level IS 'Undergraduate or Postgraduate - locked after first submission';
COMMENT ON COLUMN users.department IS 'Department name - locked after first submission';
COMMENT ON COLUMN users.blood_group IS 'Blood group - editable anytime';
COMMENT ON COLUMN users.profile_completed IS '1 if profile fully completed, 0 otherwise';

-- Update existing test user
UPDATE users 
SET profile_completed = 0 
WHERE profile_completed IS NULL;

COMMIT;

SELECT 'Enhanced schema created successfully!' AS status FROM dual;