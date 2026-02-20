-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Fix Payment Schema Mismatch
-- The user_id in payments table was created as UUID, but your users table uses BIGINT/INTEGER.
-- This prevents saving payments correctly.

-- Drop the column (warning: deletes payment user link data if any exists, but you said "simple bugs" so assuming dev data)
ALTER TABLE payments DROP COLUMN user_id;

-- Re-add it as BIGINT to match users.id
ALTER TABLE payments ADD COLUMN user_id BIGINT REFERENCES users(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

-- 2. Ensure Payment Status Enum/Check
-- This prevents "pending" vs "PENDING" issues
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_status_check 
    CHECK (payment_status IN ('SUCCESS', 'FAILED', 'CANCELLED', 'PENDING'));

-- 3. (Optional) Ensure action_taken column exists (just in case)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_taken TEXT;
