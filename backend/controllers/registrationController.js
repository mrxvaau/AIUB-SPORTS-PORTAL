// Registration Controller
// Handles game registration operations

const { supabase } = require('../config/supabase');
const { EMAIL_PATTERN } = require('./authController');

// Register for a tournament game
const registerForGame = async (req, res) => {
    try {
        const { studentId, gameId } = req.body;

        // Validate inputs
        if (!studentId || typeof studentId !== 'string' || !EMAIL_PATTERN.test(studentId + '@student.aiub.edu')) {
            return res.status(400).json({
                success: false,
                message: 'Valid student ID is required'
            });
        }

        if (!gameId || isNaN(parseInt(gameId))) {
            return res.status(400).json({
                success: false,
                message: 'Valid game ID is required'
            });
        }

        // First, get user ID from student ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, gender')
            .eq('student_id', studentId)
            .single();

        if (userError) {
            if (userError.code === 'PGRST116') { // Row not found
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            console.error('Error fetching user:', userError);
            return res.status(500).json({
                success: false,
                message: 'Error checking user',
                error: userError.message
            });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userId = user.id;

        // Get the game and check if it exists
        const { data: game, error: gameError } = await supabase
            .from('tournament_games')
            .select(`
                id,
                category,
                game_type,
                team_size,
                fee_per_person,
                tournament_id,
                tournaments(registration_deadline)
            `)
            .eq('id', gameId)
            .single();

        if (gameError || !game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        // Check if registration deadline has passed
        const deadline = new Date(game.tournaments.registration_deadline);
        const now = new Date();

        if (now > deadline) {
            return res.status(400).json({
                success: false,
                message: 'Registration deadline has passed for this tournament'
            });
        }

        // Check gender eligibility
        if (game.category !== 'Mix') {
            if (user.gender && game.category !== user.gender) {
                return res.status(400).json({
                    success: false,
                    message: `This game is only for ${game.category} participants`
                });
            }
        }

        // Check if game requires team registration (team_size > 1)
        const teamSize = game.team_size || 1;
        if (teamSize > 1) {
            return res.status(400).json({
                success: false,
                message: 'This game requires team registration. Please create a team instead.'
            });
        }

        // Check if user has already registered for this game
        const { data: existingRegistration, error: checkError } = await supabase
            .from('game_registrations')
            .select('id')
            .eq('user_id', userId)
            .eq('game_id', gameId)
            .single();

        if (existingRegistration) {
            return res.status(400).json({
                success: false,
                message: 'Already registered for this game'
            });
        }

        // Create registration
        const { data: registration, error: regError } = await supabase
            .from('game_registrations')
            .insert([{
                user_id: userId,
                game_id: gameId,
                payment_status: 'PENDING'
            }])
            .select()
            .single();

        if (regError) {
            console.error('Error creating registration:', regError);

            // Check for unique constraint violation
            if (regError.code === '23505') {
                return res.status(400).json({
                    success: false,
                    message: 'Already registered for this game'
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Error creating registration',
                error: regError.message
            });
        }

        res.json({
            success: true,
            message: 'Registration successful',
            registration: {
                id: registration.id,
                gameId: registration.game_id,
                paymentStatus: registration.payment_status,
                registrationDate: registration.registration_date
            }
        });
    } catch (error) {
        console.error('Register for game error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get user's registrations
const getUserRegistrations = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get user ID from student ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userId = user.id;

        // Get user's registrations with game and tournament details
        const { data: registrations, error: regError } = await supabase
            .from('game_registrations')
            .select(`
                id,
                game_id,
                team_id,
                payment_status,
                registration_date,
                tournament_games(
                    id,
                    game_name,
                    game_type,
                    team_size,
                    category,
                    fee_per_person,
                    tournament_id,
                    tournaments(id, title, registration_deadline, status)
                )
            `)
            .eq('user_id', userId)
            .order('registration_date', { ascending: false });

        if (regError) {
            console.error('Error fetching registrations:', regError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching registrations',
                error: regError.message
            });
        }

        // Format the response
        const formattedRegistrations = registrations.map(reg => ({
            id: reg.id,
            gameId: reg.game_id,
            teamId: reg.team_id,
            paymentStatus: reg.payment_status,
            registrationDate: reg.registration_date,
            game: {
                id: reg.tournament_games.id,
                name: reg.tournament_games.game_name,
                type: reg.tournament_games.game_type,
                teamSize: reg.tournament_games.team_size,
                category: reg.tournament_games.category,
                feePerPerson: reg.tournament_games.fee_per_person,
                tournamentId: reg.tournament_games.tournament_id,
                tournament: {
                    id: reg.tournament_games.tournaments.id,
                    title: reg.tournament_games.tournaments.title,
                    deadline: reg.tournament_games.tournaments.registration_deadline,
                    status: reg.tournament_games.tournaments.status
                }
            }
        }));

        res.json({
            success: true,
            registrations: formattedRegistrations
        });
    } catch (error) {
        console.error('Get user registrations error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Cancel game registration
const cancelGameRegistration = async (req, res) => {
    try {
        const { gameId, studentId } = req.params;

        // Get user ID from student ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userId = user.id;

        // Check if the game exists and get tournament deadline
        const { data: gameData, error: gameError } = await supabase
            .from('tournament_games')
            .select(`
                id,
                tournament_id,
                tournaments(registration_deadline)
            `)
            .eq('id', gameId)
            .single();

        if (gameError || !gameData) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        // Check if registration deadline has passed
        const deadline = new Date(gameData.tournaments.registration_deadline);
        const now = new Date();

        if (now > deadline) {
            return res.status(400).json({
                success: false,
                message: 'Registration deadline has passed. Cannot cancel registration.'
            });
        }

        // Check if user has registered for this game
        const { data: existingRegistration, error: checkError } = await supabase
            .from('game_registrations')
            .select('id')
            .eq('user_id', userId)
            .eq('game_id', gameId)
            .single();

        if (!existingRegistration) {
            return res.status(400).json({
                success: false,
                message: 'No registration found for this game'
            });
        }

        // Delete the registration
        const { error: deleteError } = await supabase
            .from('game_registrations')
            .delete()
            .eq('id', existingRegistration.id);

        if (deleteError) {
            console.error('Error canceling registration:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error canceling registration',
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: 'Registration canceled successfully'
        });
    } catch (error) {
        console.error('Cancel game registration error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get registration overview - tournaments and games with registration counts
 * Used for admin dashboard
 */
const getRegistrationOverview = async (req, res) => {
    try {
        // Query 1: Get tournaments with registration counts
        const { data: tournaments, error: tournamentsError } = await supabase
            .from('tournaments')
            .select(`
                id,
                title,
                registration_deadline,
                status,
                created_at,
                tournament_games(
                    id,
                    game_registrations(id)
                )
            `)
            .order('created_at', { ascending: false });

        if (tournamentsError) {
            console.error('Tournaments query error:', tournamentsError);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch tournaments: ' + tournamentsError.message
            });
        }

        // Process tournaments to count registrations
        const tournamentsWithCounts = tournaments.map(tournament => {
            let totalRegistrations = 0;
            if (tournament.tournament_games && Array.isArray(tournament.tournament_games)) {
                tournament.tournament_games.forEach(game => {
                    if (game.game_registrations && Array.isArray(game.game_registrations)) {
                        totalRegistrations += game.game_registrations.length;
                    }
                });
            }

            return {
                id: tournament.id,
                name: tournament.title,
                registration_deadline: tournament.registration_deadline,
                status: tournament.status,
                created_at: tournament.created_at,
                total_registrations: totalRegistrations
            };
        });

        // Query 2: Get games with registration counts
        const { data: games, error: gamesError } = await supabase
            .from('tournament_games')
            .select(`
                id,
                game_name,
                category,
                game_type,
                tournaments(id, title),
                game_registrations(id)
            `)
            .order('id', { ascending: false });

        if (gamesError) {
            console.error('Games query error:', gamesError);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch games: ' + gamesError.message
            });
        }

        // Process games to count registrations
        const gamesWithCounts = games.map(game => {
            const registrationCount = game.game_registrations ? game.game_registrations.length : 0;

            return {
                id: game.id,
                game_name: game.game_name,
                category: game.category,
                game_type: game.game_type,
                tournament_id: game.tournaments?.id || null,
                tournament_name: game.tournaments?.title || 'Unknown Tournament',
                registration_count: registrationCount
            };
        });

        res.json({
            success: true,
            tournaments: tournamentsWithCounts,
            games: gamesWithCounts
        });

    } catch (error) {
        console.error('❌ Registration overview error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registration data: ' + error.message
        });
    }
};

/**
 * Get all registrations for a specific game (Admin only)
 * Handles both solo and team games
 */
const getGameRegistrations = async (req, res) => {
    try {
        const { gameId } = req.params;
        const { search } = req.query; // Optional search by student ID

        // Get game details
        const { data: game, error: gameError } = await supabase
            .from('tournament_games')
            .select('id, game_name, game_type, category, team_size, fee_per_person, tournament_id')
            .eq('id', gameId)
            .single();

        if (gameError || !game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        const teamSize = game.team_size || 1;
        const isTeamGame = teamSize > 1;

        if (isTeamGame) {
            // For team games: Get all teams registered for this game
            const { data: teamRegistrations, error: teamRegError } = await supabase
                .from('game_registrations')
                .select(`
                    id,
                    payment_status,
                    registration_date,
                    team_id,
                    user_id,
                    teams(
                        id,
                        team_name,
                        leader_user_id,
                        status,
                        created_at
                    )
                `)
                .eq('game_id', gameId)
                .not('team_id', 'is', null)
                .order('registration_date', { ascending: false });

            if (teamRegError) {
                console.error('Error fetching team registrations:', teamRegError);
                return res.status(500).json({
                    success: false,
                    message: 'Error fetching registrations'
                });
            }

            // Get detailed info for each team
            const registrationsWithDetails = await Promise.all(teamRegistrations.map(async (reg) => {
                const team = reg.teams;

                // Get all team members with their user details and payment info
                const { data: members, error: membersError } = await supabase
                    .from('team_members')
                    .select(`
                        id,
                        user_id,
                        role,
                        status,
                        users(id, student_id, full_name, email)
                    `)
                    .eq('team_id', team.id)
                    .order('role', { ascending: false }); // LEADER first

                if (membersError) {
                    console.error('Error fetching team members:', membersError);
                    return null;
                }

                // Get payment status for each member
                const membersWithPayment = await Promise.all(members.map(async (member) => {
                    // Each team member has their own game_registration entry
                    const { data: memberReg } = await supabase
                        .from('game_registrations')
                        .select('payment_status')
                        .eq('user_id', member.user_id)
                        .eq('game_id', gameId)
                        .single();

                    return {
                        id: member.id,
                        user_id: member.user_id,
                        student_id: member.users?.student_id,
                        full_name: member.users?.full_name,
                        email: member.users?.email,
                        role: member.role,
                        status: member.status,
                        payment_status: memberReg?.payment_status || 'PENDING'
                    };
                }));

                // Filter by search if provided (leader student ID)
                if (search) {
                    const leaderMember = membersWithPayment.find(m => m.role === 'LEADER');
                    if (!leaderMember || !leaderMember.student_id.includes(search)) {
                        return null; // Filter out this team
                    }
                }

                return {
                    id: reg.id,
                    registration_date: reg.registration_date,
                    team: {
                        id: team.id,
                        team_name: team.team_name,
                        leader_user_id: team.leader_user_id,
                        status: team.status,
                        member_count: members.length,
                        required_size: teamSize,
                        created_at: team.created_at
                    },
                    members: membersWithPayment,
                    payment_status: reg.payment_status // Leader's payment
                };
            }));

            // Filter out nulls from search filtering
            const filteredRegistrations = registrationsWithDetails.filter(r => r !== null);

            res.json({
                success: true,
                game: {
                    id: game.id,
                    game_name: game.game_name,
                    game_type: game.game_type,
                    category: game.category,
                    team_size: teamSize,
                    fee_per_person: game.fee_per_person,
                    is_team_game: true
                },
                registrations: filteredRegistrations
            });

        } else {
            // For solo games: Get individual registrations
            let query = supabase
                .from('game_registrations')
                .select(`
                    id,
                    payment_status,
                    registration_date,
                    users(id, student_id, full_name, email)
                `)
                .eq('game_id', gameId)
                .is('team_id', null)
                .order('registration_date', { ascending: false });

            const { data: soloRegistrations, error: soloRegError } = await query;

            if (soloRegError) {
                console.error('Error fetching solo registrations:', soloRegError);
                return res.status(500).json({
                    success: false,
                    message: 'Error fetching registrations'
                });
            }

            // Format and filter by search if provided
            let formattedRegistrations = soloRegistrations.map(reg => ({
                id: reg.id,
                user: {
                    id: reg.users.id,
                    student_id: reg.users.student_id,
                    full_name: reg.users.full_name,
                    email: reg.users.email
                },
                payment_status: reg.payment_status,
                registration_date: reg.registration_date,
                team: null
            }));

            // Apply search filter
            if (search) {
                formattedRegistrations = formattedRegistrations.filter(reg =>
                    reg.user.student_id.includes(search)
                );
            }

            res.json({
                success: true,
                game: {
                    id: game.id,
                    game_name: game.game_name,
                    game_type: game.game_type,
                    category: game.category,
                    team_size: teamSize,
                    fee_per_person: game.fee_per_person,
                    is_team_game: false
                },
                registrations: formattedRegistrations
            });
        }

    } catch (error) {
        console.error('Get game registrations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registrations: ' + error.message
        });
    }
};

/**
 * Update registration payment status (Admin only)
 */
const updatePaymentStatus = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { payment_status } = req.body;

        // Validate payment status
        const validStatuses = ['PENDING', 'PAID', 'UNPAID'];
        if (!validStatuses.includes(payment_status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment status. Must be PENDING, PAID, or UNPAID'
            });
        }

        // Update the registration
        const { data, error } = await supabase
            .from('game_registrations')
            .update({ payment_status })
            .eq('id', registrationId)
            .select()
            .single();

        if (error) {
            console.error('Error updating payment status:', error);
            return res.status(500).json({
                success: false,
                message: 'Error updating payment status'
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        res.json({
            success: true,
            message: 'Payment status updated successfully',
            registration: data
        });

    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payment status: ' + error.message
        });
    }
};

module.exports = {
    registerForGame,
    getUserRegistrations,
    cancelGameRegistration,
    getRegistrationOverview,
    getGameRegistrations,
    updatePaymentStatus
};
