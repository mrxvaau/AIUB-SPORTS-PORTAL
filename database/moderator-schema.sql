-- Moderator Table Schema
-- This table will store moderator information and their permissions

CREATE TABLE moderators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Links to the main users table
    can_manage_tournaments BOOLEAN DEFAULT FALSE, -- Permission to create/edit/delete tournaments
    can_view_user_data BOOLEAN DEFAULT FALSE, -- Permission to see user details
    can_manage_registrations BOOLEAN DEFAULT FALSE, -- Permission to approve/disapprove registrations
    can_send_announcements BOOLEAN DEFAULT FALSE, -- Permission to send system announcements
    can_generate_reports BOOLEAN DEFAULT FALSE, -- Permission to view reports
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure user_id is unique to prevent duplicate moderator entries
    CONSTRAINT unique_moderator_user UNIQUE (user_id)
);

-- Indexes for performance
CREATE INDEX idx_moderators_user_id ON moderators(user_id);

-- RLS policies to secure the table
ALTER TABLE moderators ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can access moderators table
CREATE POLICY "Moderators are viewable by authenticated users" ON moderators
    FOR SELECT TO authenticated
    USING (TRUE);

-- Policy: Only service_role can insert new moderators
CREATE POLICY "Moderators can be added by service role" ON moderators
    FOR INSERT TO service_role
    WITH CHECK (TRUE);

-- Policy: Only service_role can update moderators
CREATE POLICY "Moderators can be updated by service role" ON moderators
    FOR UPDATE TO service_role
    USING (TRUE);

-- Policy: Only service_role can delete moderators
CREATE POLICY "Moderators can be deleted by service role" ON moderators
    FOR DELETE TO service_role
    USING (TRUE);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at column
CREATE TRIGGER update_moderators_updated_at
    BEFORE UPDATE ON moderators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Example: Insert a moderator (this would typically be done by an admin)
-- INSERT INTO moderators (user_id, can_manage_tournaments, can_view_user_data, can_manage_registrations, can_send_announcements, can_generate_reports)
-- VALUES ('user-id-here', true, true, true, false, false);