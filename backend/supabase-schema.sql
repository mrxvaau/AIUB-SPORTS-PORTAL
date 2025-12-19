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

-- RLS Policies - Allow all operations for simplicity (can be made more restrictive later)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

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