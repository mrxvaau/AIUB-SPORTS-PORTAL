// Registration Routes
// Game registration management

const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const { requireAuth } = require('../middleware/auth');

// POST /api/registration/register - Register for a game
router.post('/register', requireAuth, registrationController.registerForGame);

// GET /api/registration/my/:studentId - Get user's registrations
router.get('/my/:studentId', requireAuth, registrationController.getUserRegistrations);

// DELETE /api/registration/:gameId/:studentId - Cancel a game registration
router.delete('/:gameId/:studentId', requireAuth, registrationController.cancelGameRegistration);

module.exports = router;
