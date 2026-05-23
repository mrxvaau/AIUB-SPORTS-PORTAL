-- Run this in the Supabase SQL Editor to ensure winner columns exist on scheduled_matches
-- These columns are required for bracket winner propagation

ALTER TABLE scheduled_matches ADD COLUMN IF NOT EXISTS winner_label TEXT;
ALTER TABLE scheduled_matches ADD COLUMN IF NOT EXISTS winner_user_id BIGINT;
ALTER TABLE scheduled_matches ADD COLUMN IF NOT EXISTS winner_team_id BIGINT;
