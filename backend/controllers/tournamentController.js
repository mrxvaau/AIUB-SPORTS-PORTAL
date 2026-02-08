// Tournament Controller
// Handles tournament listing and game fetching

const { supabase } = require('../config/supabase');

// Get available tournaments for registration
const getAvailableTournaments = async (req, res) => {
    try {
        const now = new Date();
        const nowFormatted = now.toISOString();

        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('id, title, photo_url, registration_deadline, status, created_at')
            .eq('status', 'ACTIVE')
            .gt('registration_deadline', nowFormatted)
            .order('registration_deadline', { ascending: true });

        if (error) {
            console.error('Error fetching tournaments:', error);
            return res.status(500).json({ success: false, message: error.message });
        }

        // Format dates to match expected format
        const formattedTournaments = tournaments.map(tournament => ({
            ...tournament,
            deadline: new Date(tournament.registration_deadline).toISOString().slice(0, 19).replace('T', ' '),
            created_date: new Date(tournament.created_at).toISOString().slice(0, 10)
        }));

        res.json({ success: true, tournaments: formattedTournaments });
    } catch (error) {
        console.error('Get available tournaments error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get games for a specific tournament
const getTournamentGames = async (req, res) => {
    try {
        const tournamentId = req.params.id;

        const { data: games, error } = await supabase
            .from('tournament_games')
            .select('id, category, game_name, game_type, fee_per_person, team_size')
            .eq('tournament_id', tournamentId)
            .order('category')
            .order('game_name');

        if (error) {
            console.error('Error fetching tournament games:', error);
            res.status(500).json({ success: false, message: error.message });
        } else {
            res.json({ success: true, games: games });
        }
    } catch (error) {
        console.error('Get tournament games error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAvailableTournaments,
    getTournamentGames
};
