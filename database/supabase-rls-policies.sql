-- Supabase Row Level Security (RLS) Policies
-- AIUB Sports Portal - Production Security Configuration
-- 
-- IMPORTANT: Run this script in Supabase SQL Editor to enable RLS
-- This replaces the open policies in the development schema

-- ============================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_role_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Get current user ID from JWT
-- ============================================

-- This function extracts the user ID from the JWT token
-- Supabase automatically populates auth.uid() from the JWT claim

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Policy: Users can read their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT
    USING (auth.uid()::bigint = id);

-- Policy: Users can update their own data
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE
    USING (auth.uid()::bigint = id);

-- Policy: Users can insert their own data (registration)
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT
    WITH CHECK (auth.uid()::bigint = id);

-- Policy: Admins can view all users
CREATE POLICY "Admins can view all users" ON users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- ============================================
-- TOURNAMENTS TABLE POLICIES
-- ============================================

-- Policy: Anyone can view active tournaments
CREATE POLICY "Anyone can view active tournaments" ON tournaments
    FOR SELECT
    USING (status = 'ACTIVE');

-- Policy: Admins can view all tournaments
CREATE POLICY "Admins can view all tournaments" ON tournaments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- Policy: Admins can create tournaments
CREATE POLICY "Admins can create tournaments" ON tournaments
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- Policy: Admins can update tournaments
CREATE POLICY "Admins can update tournaments" ON tournaments
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- Policy: Admins can delete tournaments
CREATE POLICY "Admins can delete tournaments" ON tournaments
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- ============================================
-- TOURNAMENT_GAMES TABLE POLICIES
-- ============================================

-- Policy: Anyone can view games for active tournaments
CREATE POLICY "Anyone can view tournament games" ON tournament_games
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = tournament_id AND t.status = 'ACTIVE'
        )
    );

-- Policy: Admins can manage all games
CREATE POLICY "Admins can manage tournament games" ON tournament_games
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- ============================================
-- GAME_REGISTRATIONS TABLE POLICIES
-- ============================================

-- Policy: Users can view their own registrations
CREATE POLICY "Users can view own registrations" ON game_registrations
    FOR SELECT
    USING (user_id = auth.uid()::bigint);

-- Policy: Users can create their own registrations
CREATE POLICY "Users can create own registrations" ON game_registrations
    FOR INSERT
    WITH CHECK (user_id = auth.uid()::bigint);

-- Policy: Users can delete their own pending registrations
CREATE POLICY "Users can delete own pending registrations" ON game_registrations
    FOR DELETE
    USING (
        user_id = auth.uid()::bigint AND 
        payment_status = 'PENDING'
    );

-- Policy: Admins can view all registrations
CREATE POLICY "Admins can view all registrations" ON game_registrations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- Policy: Admins can update all registrations
CREATE POLICY "Admins can update all registrations" ON game_registrations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- ============================================
-- TEAMS TABLE POLICIES
-- ============================================

-- Policy: Team members can view their team
CREATE POLICY "Team members can view own team" ON teams
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = id AND tm.user_id = auth.uid()::bigint
        )
    );

-- Policy: Anyone can view teams for active tournaments
CREATE POLICY "Anyone can view teams for active games" ON teams
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tournament_games tg
            JOIN tournaments t ON tg.tournament_id = t.id
            WHERE tg.id = tournament_game_id AND t.status = 'ACTIVE'
        )
    );

-- Policy: Team leaders can create teams
CREATE POLICY "Users can create teams" ON teams
    FOR INSERT
    WITH CHECK (leader_user_id = auth.uid()::bigint);

-- Policy: Team leaders can update their teams
CREATE POLICY "Team leaders can update own teams" ON teams
    FOR UPDATE
    USING (leader_user_id = auth.uid()::bigint);

-- Policy: Admins can manage all teams
CREATE POLICY "Admins can manage all teams" ON teams
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- ============================================
-- TEAM_MEMBERS TABLE POLICIES
-- ============================================

-- Policy: Team members can view their memberships
CREATE POLICY "Users can view own team memberships" ON team_members
    FOR SELECT
    USING (user_id = auth.uid()::bigint);

-- Policy: Team leaders can add members
CREATE POLICY "Team leaders can add members" ON team_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_id AND t.leader_user_id = auth.uid()::bigint
        )
    );

-- Policy: Users can update their own membership status
CREATE POLICY "Users can update own membership" ON team_members
    FOR UPDATE
    USING (user_id = auth.uid()::bigint);

-- Policy: Team leaders can remove members
CREATE POLICY "Team leaders can remove members" ON team_members
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_id AND t.leader_user_id = auth.uid()::bigint
        )
    );

-- Policy: Admins can manage all team members
CREATE POLICY "Admins can manage all team members" ON team_members
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- ============================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT
    USING (user_id = auth.uid()::bigint);

-- Policy: Users can update their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE
    USING (user_id = auth.uid()::bigint);

-- Policy: System can insert notifications (disable for security, use backend)
-- Notifications should be created via backend only

-- Policy: Admins can view all notifications
CREATE POLICY "Admins can view all notifications" ON notifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- ============================================
-- CART TABLE POLICIES
-- ============================================

-- Policy: Users can view their own cart
CREATE POLICY "Users can view own cart" ON cart
    FOR SELECT
    USING (user_id = auth.uid()::bigint);

-- Policy: Users can add items to their own cart
CREATE POLICY "Users can add to own cart" ON cart
    FOR INSERT
    WITH CHECK (user_id = auth.uid()::bigint);

-- Policy: Users can update their own cart
CREATE POLICY "Users can update own cart" ON cart
    FOR UPDATE
    USING (user_id = auth.uid()::bigint);

-- Policy: Users can delete items from their own cart
CREATE POLICY "Users can delete from own cart" ON cart
    FOR DELETE
    USING (user_id = auth.uid()::bigint);

-- ============================================
-- ADMINS TABLE POLICIES
-- ============================================

-- Policy: Only admins can view admins table
CREATE POLICY "Admins can view admins" ON admins
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- ============================================
-- ADMIN_ROLES TABLE POLICIES
-- ============================================

-- Policy: Only super admins can view roles
CREATE POLICY "Super admins can view roles" ON admin_roles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            JOIN admins a ON arm.admin_id = a.id
            JOIN users u ON a.email = u.email
            WHERE u.id = auth.uid()::bigint
            AND arm.role_id IN (SELECT id FROM admin_roles WHERE role_name = 'SUPER_ADMIN')
        )
    );

-- ============================================
-- ADMIN_ROLE_MAP TABLE POLICIES
-- ============================================

-- Policy: Only super admins can view role mappings
CREATE POLICY "Super admins can view role mappings" ON admin_role_map
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            JOIN admins a ON arm.admin_id = a.id
            JOIN users u ON a.email = u.email
            WHERE u.id = auth.uid()::bigint
            AND arm.role_id IN (SELECT id FROM admin_roles WHERE role_name = 'SUPER_ADMIN')
        )
    );

-- ============================================
-- MODERATORS TABLE POLICIES
-- ============================================

-- Policy: Admins can view moderators
CREATE POLICY "Admins can view moderators" ON moderators
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- ============================================
-- GAME_REQUESTS TABLE POLICIES
-- ============================================

-- Policy: Users can view their own requests
CREATE POLICY "Users can view own game requests" ON game_requests
    FOR SELECT
    USING (requested_by = auth.uid()::bigint);

-- Policy: Users can create game requests
CREATE POLICY "Users can create game requests" ON game_requests
    FOR INSERT
    WITH CHECK (requested_by = auth.uid()::bigint);

-- Policy: Admins can view all game requests
CREATE POLICY "Admins can view all game requests" ON game_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- Policy: Admins can update game requests
CREATE POLICY "Admins can update game requests" ON game_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- ============================================
-- TOURNAMENT_REQUESTS TABLE POLICIES
-- ============================================

-- Policy: Users can view their own requests
CREATE POLICY "Users can view own tournament requests" ON tournament_requests
    FOR SELECT
    USING (requested_by = auth.uid()::bigint);

-- Policy: Users can create tournament requests
CREATE POLICY "Users can create tournament requests" ON tournament_requests
    FOR INSERT
    WITH CHECK (requested_by = auth.uid()::bigint);

-- Policy: Admins can view all tournament requests
CREATE POLICY "Admins can view all tournament requests" ON tournament_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- Policy: Admins can update tournament requests
CREATE POLICY "Admins can update tournament requests" ON tournament_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM admin_role_map arm
            WHERE arm.admin_id = (
                SELECT id FROM admins WHERE email = (
                    SELECT email FROM users WHERE id = auth.uid()::bigint
                )
            )
        )
    );

-- ============================================
-- IMPORTANT NOTES
-- ============================================

-- 1. These policies assume the backend uses the Supabase service role key
--    which bypasses RLS. This is the recommended approach for backend operations.

-- 2. For any direct client-side Supabase usage, use the ANON key which will
--    enforce these RLS policies.

-- 3. The auth.uid() function returns the user ID from the JWT token.
--    When using the backend with service role key, RLS is bypassed.

-- 4. Test these policies thoroughly in a development environment before
--    deploying to production.

-- 5. Consider adding additional policies for specific business logic
--    requirements as needed.

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- To verify RLS is enabled on all tables:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- To view all policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
-- FROM pg_policies WHERE schemaname = 'public';
