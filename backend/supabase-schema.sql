-- Supabase Schema for AIUB Sports Portal
-- Replace Oracle schema with PostgreSQL-compatible schema

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    gender VARCHAR(20),
    phone_number VARCHAR(20),
    blood_group VARCHAR(5),
    program_level VARCHAR(50),
    department VARCHAR(100),
    name_edit_count INTEGER DEFAULT 0,
    is_first_login BOOLEAN DEFAULT TRUE,
    profile_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    photo_url TEXT,
    registration_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    description TEXT,
    created_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tournament_games table
CREATE TABLE IF NOT EXISTS tournament_games (
    id BIGSERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- Male, Female, Mix
    game_name VARCHAR(255) NOT NULL,
    game_type VARCHAR(50) NOT NULL, -- Solo, Duo, Custom
    fee_per_person DECIMAL(10, 2)
);

-- Create game_registrations table
CREATE TABLE IF NOT EXISTS game_registrations (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    game_id INTEGER REFERENCES tournament_games(id) ON DELETE CASCADE,
    payment_status VARCHAR(20) DEFAULT 'PENDING',
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, game_id)
);

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
    id BIGSERIAL PRIMARY KEY,
    admin_id VARCHAR(50) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create moderators table
CREATE TABLE IF NOT EXISTS moderators (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Links to the main users table
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

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id BIGSERIAL PRIMARY KEY,
    tournament_game_id INTEGER REFERENCES tournament_games(id) ON DELETE CASCADE,
    team_name VARCHAR(255) NOT NULL,
    leader_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, CONFIRMED, CANCELLED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
    id BIGSERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'MEMBER', -- LEADER, MEMBER
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, CONFIRMED, REJECTED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id) -- Prevent duplicate team membership
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO', -- INFO, WARNING, SUCCESS, TEAM_REQUEST
    status VARCHAR(20) DEFAULT 'UNREAD', -- UNREAD, READ, ARCHIVED
    related_id INTEGER, -- Can reference teams, games, etc.
    related_type VARCHAR(50), -- 'TEAM_REQUEST', 'GAME_REGISTRATION', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cart table
CREATE TABLE IF NOT EXISTS cart (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- 'INDIVIDUAL_REGISTRATION', 'TEAM_REGISTRATION'
    item_id INTEGER, -- References game_registrations or teams
    tournament_game_id INTEGER REFERENCES tournament_games(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tournament_game_id) -- Prevent duplicate items
);

-- RLS Policies - Allow all operations for simplicity (can be made more restrictive later)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for development)
CREATE POLICY "Allow all operations on users" ON users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on tournaments" ON tournaments
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on tournament_games" ON tournament_games
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on game_registrations" ON game_registrations
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on admins" ON admins
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on moderators" ON moderators
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on teams" ON teams
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on team_members" ON team_members
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on notifications" ON notifications
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on cart" ON cart
    FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_moderators_user_id ON moderators(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_tournament_game_id ON teams(tournament_game_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader_user_id ON teams(leader_user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart(user_id);