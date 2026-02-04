// Request Controller
// Handles game and tournament request operations

const { supabase } = require('../config/supabase');

// Request a new game for a tournament
const requestGame = async (req, res) => {
    try {
        const { studentId, tournamentId, gameName, category, gameType } = req.body;

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

        // Check if tournament exists
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('id, status')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
            });
        }

        if (tournament.status !== 'ACTIVE') {
            return res.status(400).json({
                success: false,
                message: 'Cannot request games for inactive tournaments'
            });
        }

        // Check if a similar request already exists
        const { data: existingRequest, error: existingError } = await supabase
            .from('game_requests')
            .select('id')
            .eq('tournament_id', tournamentId)
            .eq('game_name', gameName)
            .eq('category', category)
            .eq('status', 'PENDING')
            .single();

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: 'A similar game request already exists for this tournament'
            });
        }

        // Create the game request
        const { data: newRequest, error: requestError } = await supabase
            .from('game_requests')
            .insert([{
                tournament_id: tournamentId,
                requested_by: userId,
                game_name: gameName,
                category: category,
                game_type: gameType,
                status: 'PENDING'
            }])
            .select()
            .single();

        if (requestError) {
            console.error('Error creating game request:', requestError);
            return res.status(500).json({
                success: false,
                message: 'Error creating game request',
                error: requestError.message
            });
        }

        res.json({
            success: true,
            message: 'Game request submitted successfully',
            request: newRequest
        });
    } catch (error) {
        console.error('Request game error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Request a new tournament
const requestTournament = async (req, res) => {
    try {
        const { studentId, title, description, registrationDeadline } = req.body;

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

        // Validate deadline
        const deadline = new Date(registrationDeadline);
        if (isNaN(deadline.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid registration deadline'
            });
        }

        // Check if a similar request already exists
        const { data: existingRequest, error: existingError } = await supabase
            .from('tournament_requests')
            .select('id')
            .eq('title', title)
            .eq('status', 'PENDING')
            .single();

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: 'A similar tournament request already exists'
            });
        }

        // Create the tournament request
        const { data: newRequest, error: requestError } = await supabase
            .from('tournament_requests')
            .insert([{
                requested_by: userId,
                title: title,
                description: description,
                registration_deadline: deadline.toISOString(),
                status: 'PENDING'
            }])
            .select()
            .single();

        if (requestError) {
            console.error('Error creating tournament request:', requestError);
            return res.status(500).json({
                success: false,
                message: 'Error creating tournament request',
                error: requestError.message
            });
        }

        res.json({
            success: true,
            message: 'Tournament request submitted successfully',
            request: newRequest
        });
    } catch (error) {
        console.error('Request tournament error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get user's game requests
const getUserGameRequests = async (req, res) => {
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

        // Get user's game requests
        const { data: requests, error: requestError } = await supabase
            .from('game_requests')
            .select(`
                id,
                tournament_id,
                game_name,
                category,
                game_type,
                status,
                created_at,
                tournaments(title)
            `)
            .eq('requested_by', userId)
            .order('created_at', { ascending: false });

        if (requestError) {
            console.error('Error fetching game requests:', requestError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching game requests',
                error: requestError.message
            });
        }

        res.json({
            success: true,
            requests: requests.map(req => ({
                id: req.id,
                tournament: {
                    id: req.tournament_id,
                    title: req.tournaments?.title || 'Unknown Tournament'
                },
                game_name: req.game_name,
                category: req.category,
                game_type: req.game_type,
                status: req.status,
                created_at: req.created_at
            }))
        });
    } catch (error) {
        console.error('Get user game requests error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get user's tournament requests
const getUserTournamentRequests = async (req, res) => {
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

        // Get user's tournament requests
        const { data: requests, error: requestError } = await supabase
            .from('tournament_requests')
            .select(`
                id,
                title,
                description,
                registration_deadline,
                status,
                created_at
            `)
            .eq('requested_by', userId)
            .order('created_at', { ascending: false });

        if (requestError) {
            console.error('Error fetching tournament requests:', requestError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching tournament requests',
                error: requestError.message
            });
        }

        res.json({
            success: true,
            requests: requests.map(req => ({
                id: req.id,
                title: req.title,
                description: req.description,
                registration_deadline: req.registration_deadline,
                status: req.status,
                created_at: req.created_at
            }))
        });
    } catch (error) {
        console.error('Get user tournament requests error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    requestGame,
    requestTournament,
    getUserGameRequests,
    getUserTournamentRequests
};
