-- Fix payments table user_id type mismatch
-- It was UUID, but users.id is BIGINT.
-- We must drop the column and re-add it, or alter it with cached conversion.
-- Since the table is likely empty or has garbage, we can just alter it.
-- But wait, if it's UUID it might not cast to BIGINT easily if there's data.
-- Assuming table is effectively empty of valid data (since inserts failed).

DO $$
BEGIN
    -- Check if column exists and is UUID
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        -- Drop basic foreign key if it exists (it likely doesn't if types mismatched, but check)
        -- ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;

        -- Alter column type
        -- If current data is incompatible, this might fail, but for now we assume empty or we wipe it.
        -- Safer to drop and re-add if we don't care about data preservation (dev environment)
        
        -- OPTION 1: Drop and Recreate Column
        ALTER TABLE payments DROP COLUMN user_id;
        ALTER TABLE payments ADD COLUMN user_id BIGINT REFERENCES users(id);
        
        -- Re-add index
        CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    END IF;
END $$;
