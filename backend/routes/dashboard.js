// Dashboard Routes
// Version 1.0

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const userController = require('../controllers/userController');

// GET /api/dashboard/profile - Get comprehensive user profile data
router.get('/profile/:studentId', async (req, res) => {
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
router.get('/tournaments/:studentId', async (req, res) => {
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
router.get('/registrations/:studentId', userController.getUserRegistrations);

// GET /api/dashboard/overview/:studentId - Get comprehensive dashboard overview
router.get('/overview/:studentId', async (req, res) => {
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

module.exports = router;