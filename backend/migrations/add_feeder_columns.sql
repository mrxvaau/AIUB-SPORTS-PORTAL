-- Run this in the Supabase SQL Editor
-- Adds feeder match references for multi-round bracket scheduling

-- Feeder columns: link each Round 2+ match to its two source matches
ALTER TABLE scheduled_matches ADD COLUMN IF NOT EXISTS feeder_match_a_id BIGINT;
ALTER TABLE scheduled_matches ADD COLUMN IF NOT EXISTS feeder_match_b_id BIGINT;

-- Ensure winner columns exist (from previous migration)
ALTER TABLE scheduled_matches ADD COLUMN IF NOT EXISTS winner_label TEXT;
ALTER TABLE scheduled_matches ADD COLUMN IF NOT EXISTS winner_user_id BIGINT;
ALTER TABLE scheduled_matches ADD COLUMN IF NOT EXISTS winner_team_id BIGINT;

-- Index for fast feeder lookups (finding the next-round match)
CREATE INDEX IF NOT EXISTS idx_scheduled_matches_feeder_a ON scheduled_matches(feeder_match_a_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_matches_feeder_b ON scheduled_matches(feeder_match_b_id);
