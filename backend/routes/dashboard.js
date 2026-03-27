// Dashboard Routes
// Version 2.0 — All routes require authentication

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

// GET /api/dashboard/profile - Get comprehensive user profile data
router.get('/profile/:studentId', requireAuth, async (req, res) => {
    try {
        const { studentId } = req.params;
        
        // Get user profile using the existing function
        const userProfile = await userController.getUserProfile(studentId);
        
        if (!userProfile) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Fetch additional dashboard-specific data
        // Get number of completed registrations
        const { count: registrationCount, error: regCountError } = await supabase
            .from('game_registrations')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userProfile.id);

        if (regCountError) {
            console.error('Error fetching registration count:', regCountError);
        }

        // Prepare dashboard profile data
        const dashboardProfile = {
            ...userProfile,
            registration_count: registrationCount || 0
        };
        
        return res.json({
            success: true,
            profile: dashboardProfile
        });
    } catch (error) {
        console.error('Dashboard profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// GET /api/dashboard/tournaments - Get tournaments with registration status
router.get('/tournaments/:studentId', requireAuth, async (req, res) => {
    try {
        const { studentId } = req.params;
        
        // Get user ID from student ID
        const userResult = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();
            
        if (userResult.error || !userResult.data) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const userId = userResult.data.id;
        
        // Get all active tournaments
        const now = new Date();
        // Format the current time to match the database timestamp format
        const nowFormatted = now.toISOString();
        const tournamentResult = await supabase
            .from('tournaments')
            .select(`
                id,
                title,
                photo_url,
                registration_deadline,
                status,
                created_at
            `)
            .eq('status', 'ACTIVE')
            .gt('registration_deadline', nowFormatted)
            .order('registration_deadline', { ascending: true });
            
        if (tournamentResult.error) {
            console.error('Error fetching tournaments:', tournamentResult.error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching tournaments',
                error: tournamentResult.error.message
            });
        }

        // For each tournament, get its games separately
        let allTournamentGames = [];
        if (tournamentResult.data.length > 0) {
            // Get all games for these tournaments at once
            const tournamentIds = tournamentResult.data.map(t => t.id);
            const gamesResult = await supabase
                .from('tournament_games')
                .select('id, category, game_name, game_type, fee_per_person, tournament_id')
                .in('tournament_id', tournamentIds);

            if (gamesResult.error) {
                console.error('Error fetching tournament games:', gamesResult.error);
                return res.status(500).json({
                    success: false,
                    message: 'Error fetching tournament games',
                    error: gamesResult.error.message
                });
            }

            allTournamentGames = gamesResult.data;
        }

        // Get user's existing registrations
        const registrationResult = await supabase
            .from('game_registrations')
            .select('game_id, payment_status')
            .eq('user_id', userId);

        if (registrationResult.error) {
            console.error('Error fetching user registrations:', registrationResult.error);
        }

        const userRegistrations = registrationResult.data || [];

        // Format tournament data with registration status
        const formattedTournaments = tournamentResult.data.map(tournament => {
            // Get games for this specific tournament
            const tournamentGames = allTournamentGames.filter(game => game.tournament_id === tournament.id);

            // Add registration status to each game
            const gamesWithStatus = tournamentGames.map(game => {
                const registration = userRegistrations.find(reg => reg.game_id === game.id);
                return {
                    ...game,
                    is_registered: !!registration,
                    registration_status: registration ? registration.payment_status : null
                };
            });

            return {
                ...tournament,
                games: gamesWithStatus,
                deadline: new Date(tournament.registration_deadline).toISOString().slice(0, 19).replace('T', ' '),
                created_date: new Date(tournament.created_at).toISOString().slice(0, 10)
            };
        });
        
        return res.json({
            success: true,
            tournaments: formattedTournaments
        });
    } catch (error) {
        console.error('Dashboard tournaments error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// GET /api/dashboard/registrations/:studentId - Get user's game registrations
router.get('/registrations/:studentId', requireAuth, userController.getUserRegistrations);

// GET /api/dashboard/overview/:studentId - Get comprehensive dashboard overview
router.get('/overview/:studentId', requireAuth, async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get user profile
        const profileResult = await userController.getUserProfile(studentId);

        if (!profileResult) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user ID from student ID for other queries
        const userResult = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (userResult.error || !userResult.data) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userId = userResult.data.id;

        // Format the current time to match the database timestamp format
        const nowFormatted = new Date().toISOString();

        // Get active tournaments
        const tournamentsResult = await supabase
            .from('tournaments')
            .select(`
                id,
                title,
                photo_url,
                registration_deadline,
                status
            `)
            .eq('status', 'ACTIVE')
            .gt('registration_deadline', nowFormatted)
            .order('registration_deadline', { ascending: true });

        // Get user's registrations
        const userRegistrationsResult = await supabase
            .from('game_registrations')
            .select('*')
            .eq('user_id', userId);

        if (userRegistrationsResult.error) {
            console.error('Error fetching user registrations:', userRegistrationsResult.error);
        }

        // Get user's team memberships
        const teamMembershipsResult = await supabase
            .from('team_members')
            .select(`
                id,
                team_id,
                role,
                status,
                teams(team_name, tournament_game_id)
            `)
            .eq('user_id', userId);

        if (teamMembershipsResult.error) {
            console.error('Error fetching user team memberships:', teamMembershipsResult.error);
        }

        // Count active tournaments
        const activeTournamentsCount = tournamentsResult.data?.length || 0;

        // Count registered games
        const registeredGamesCount = userRegistrationsResult.data?.length || 0;

        // Count team memberships
        const teamMembershipsCount = teamMembershipsResult.data?.length || 0;

        // Count pending payments
        const pendingPaymentsCount = userRegistrationsResult.data?.filter(
            reg => reg.payment_status === 'PENDING'
        ).length || 0;

        // Get first 3 active tournaments
        const activeTournaments = tournamentsResult.data?.slice(0, 3) || [];

        // Get user's notifications
        const notificationsResult = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (notificationsResult.error) {
            console.error('Error fetching user notifications:', notificationsResult.error);
        }

        // Format overview data
        const overview = {
            profile: profileResult,
            active_tournaments_count: activeTournamentsCount,
            registered_games_count: registeredGamesCount,
            team_memberships_count: teamMembershipsCount,
            pending_payments: pendingPaymentsCount,
            active_tournaments: activeTournaments.map(t => ({
                ...t,
                deadline: new Date(t.registration_deadline).toISOString().slice(0, 19).replace('T', ' ')
            })),
            recent_notifications: notificationsResult.data?.map(notif => ({
                id: notif.id,
                title: notif.title,
                message: notif.message,
                type: notif.type,
                status: notif.status,
                created_at: notif.created_at
            })) || []
        };

        return res.json({
            success: true,
            overview: overview
        });
    } catch (error) {
        console.error('Dashboard overview error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// GET /api/dashboard/schedule/:studentId - Get user's upcoming scheduled matches
router.get('/schedule/:studentId', requireAuth, async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get user ID
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (userErr || !user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userId = user.id;

        // Get user's team memberships
        const { data: teamMembers } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', userId);

        const teamIds = (teamMembers || []).map(tm => tm.team_id);

        // Get user's teams where they are leader
        const { data: leaderTeams } = await supabase
            .from('teams')
            .select('id')
            .eq('leader_user_id', userId);

        const leaderTeamIds = (leaderTeams || []).map(t => t.id);
        const allTeamIds = [...new Set([...teamIds, ...leaderTeamIds])];

        // Build OR filter for matches involving this user
        let query = supabase
            .from('scheduled_matches')
            .select(`
                id, game_id, participant_a_label, participant_b_label,
                scheduled_start, scheduled_end, venue_name,
                round_number, round_label, match_order, status,
                score_a, score_b, winner_label,
                tournament_id,
                tournament_games(game_name, category, game_type)
            `)
            .not('status', 'in', '("CANCELLED")')
            .order('scheduled_start', { ascending: true });

        // Get all matches (for solo games with user, or team games with user's teams)
        const { data: soloA } = await supabase
            .from('scheduled_matches')
            .select('id')
            .eq('participant_a_user_id', userId);

        const { data: soloB } = await supabase
            .from('scheduled_matches')
            .select('id')
            .eq('participant_b_user_id', userId);

        let teamAMatches = [], teamBMatches = [];
        if (allTeamIds.length > 0) {
            const { data: tA } = await supabase
                .from('scheduled_matches')
                .select('id')
                .in('participant_a_team_id', allTeamIds);
            teamAMatches = tA || [];

            const { data: tB } = await supabase
                .from('scheduled_matches')
                .select('id')
                .in('participant_b_team_id', allTeamIds);
            teamBMatches = tB || [];
        }

        const matchIds = [
            ...new Set([
                ...(soloA || []).map(m => m.id),
                ...(soloB || []).map(m => m.id),
                ...teamAMatches.map(m => m.id),
                ...teamBMatches.map(m => m.id)
            ])
        ];

        let matches = [];
        if (matchIds.length > 0) {
            const { data, error } = await supabase
                .from('scheduled_matches')
                .select(`
                    id, game_id, participant_a_label, participant_b_label,
                    scheduled_start, scheduled_end, venue_name,
                    round_number, round_label, match_order, status,
                    score_a, score_b, winner_label,
                    tournament_id,
                    tournament_games(game_name, category, game_type)
                `)
                .in('id', matchIds)
                .order('scheduled_start', { ascending: true });

            if (error) throw error;
            matches = data || [];
        }

        // Also get tournament titles
        const tournamentIds = [...new Set(matches.map(m => m.tournament_id))];
        let tournamentMap = {};
        if (tournamentIds.length > 0) {
            const { data: tournaments } = await supabase
                .from('tournaments')
                .select('id, title')
                .in('id', tournamentIds);
            if (tournaments) tournaments.forEach(t => { tournamentMap[t.id] = t.title; });
        }

        // Format matches
        const formatted = matches.map(m => ({
            ...m,
            game_name: m.tournament_games?.game_name || 'Unknown Game',
            category: m.tournament_games?.category || '',
            game_type: m.tournament_games?.game_type || '',
            tournament_title: tournamentMap[m.tournament_id] || '',
            tournament_games: undefined
        }));

        res.json({ success: true, matches: formatted });
    } catch (error) {
        console.error('Dashboard schedule error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/dashboard/leaderboard - Get all match results across all tournaments
router.get('/leaderboard', requireAuth, async (req, res) => {
    try {
        // Get all played matches with results
        const { data: matches, error } = await supabase
            .from('scheduled_matches')
            .select(`
                id, game_id, tournament_id,
                participant_a_label, participant_b_label,
                scheduled_start, scheduled_end, venue_name,
                round_number, round_label, status,
                score_a, score_b, winner_label,
                winner_user_id, winner_team_id,
                tournament_games(game_name, category, game_type)
            `)
            .in('status', ['PLAYED', 'SCHEDULED', 'SCHEDULED_OVERLAP'])
            .order('scheduled_start', { ascending: false });

        if (error) throw error;

        // Get tournament titles
        const tournamentIds = [...new Set((matches || []).map(m => m.tournament_id))];
        let tournamentMap = {};
        if (tournamentIds.length > 0) {
            const { data: tournaments } = await supabase
                .from('tournaments')
                .select('id, title')
                .in('id', tournamentIds);
            if (tournaments) tournaments.forEach(t => { tournamentMap[t.id] = t.title; });
        }

        // Group by game
        const gameGroups = {};
        (matches || []).forEach(m => {
            const gameKey = `${m.tournament_id}_${m.game_id}`;
            if (!gameGroups[gameKey]) {
                gameGroups[gameKey] = {
                    game_id: m.game_id,
                    tournament_id: m.tournament_id,
                    game_name: m.tournament_games?.game_name || 'Unknown',
                    category: m.tournament_games?.category || '',
                    game_type: m.tournament_games?.game_type || '',
                    tournament_title: tournamentMap[m.tournament_id] || '',
                    matches: [],
                    played: 0,
                    total: 0
                };
            }
            gameGroups[gameKey].matches.push({
                id: m.id,
                participant_a: m.participant_a_label,
                participant_b: m.participant_b_label,
                score_a: m.score_a,
                score_b: m.score_b,
                winner: m.winner_label,
                round_label: m.round_label,
                venue: m.venue_name,
                time: m.scheduled_start,
                status: m.status
            });
            gameGroups[gameKey].total++;
            if (m.status === 'PLAYED') gameGroups[gameKey].played++;
        });

        res.json({
            success: true,
            games: Object.values(gameGroups)
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;