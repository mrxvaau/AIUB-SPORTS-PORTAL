// Tournament Routes
// Public-facing tournament browsing and requests

const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');
const requestController = require('../controllers/requestController');
const { requireAuth } = require('../middleware/auth');

// GET /api/tournaments - Get available tournaments
router.get('/', requireAuth, tournamentController.getAvailableTournaments);

// GET /api/tournaments/:id/games - Get games for a tournament
router.get('/:id/games', requireAuth, tournamentController.getTournamentGames);

// POST /api/tournaments/request - Request a new tournament
router.post('/request', requireAuth, requestController.requestTournament);

// POST /api/tournaments/request-game - Request a new game for a tournament
router.post('/request-game', requireAuth, requestController.requestGame);

// GET /api/tournaments/requests/:studentId - Get user's tournament requests
router.get('/requests/:studentId', requireAuth, requestController.getUserTournamentRequests);

// GET /api/tournaments/game-requests/:studentId - Get user's game requests
router.get('/game-requests/:studentId', requireAuth, requestController.getUserGameRequests);

module.exports = router;
