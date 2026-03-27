// Authentication Routes
// Version 3.0 — Security hardened: all write operations require JWT auth

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

// ── Public (no auth) ──────────────────────────────────────────────────────────

// POST /api/auth/login - Login or register user (entry point — must stay public)
router.post('/login', userController.login);

// ── Read-only (GET) — auth added in Phase 2 alongside frontend JWT updates ───

// GET /api/auth/profile/:studentId - Get user profile
router.get('/profile/:studentId', userController.getProfile);

// GET /api/auth/name-edit-count/:studentId - Get name edit count
router.get('/name-edit-count/:studentId', userController.getNameEditCount);

// GET /api/auth/tournaments - Get available tournaments for registration
router.get('/tournaments', userController.getAvailableTournaments);

// GET /api/auth/tournaments/:id/games - Get games for a specific tournament
router.get('/tournaments/:id/games', userController.getTournamentGames);

// GET /api/auth/registrations/:studentId - Get user's registrations
router.get('/registrations/:studentId', userController.getUserRegistrations);

// GET /api/auth/team/:teamId - Get team details
router.get('/team/:teamId', userController.getTeamDetails);

// GET /api/auth/team-by-game/:gameId/:studentId - Get team by game and student
router.get('/team-by-game/:gameId/:studentId', userController.getTeamByGame);

// GET /api/auth/notifications/:studentId - Get user notifications
router.get('/notifications/:studentId', userController.getNotifications);

// GET /api/auth/pending-invitations/:studentId - Get pending team invitations
router.get('/pending-invitations/:studentId', userController.getPendingTeamInvitations);

// GET /api/auth/cart/:studentId - Get user's cart
router.get('/cart/:studentId', userController.getCart);

// GET /api/auth/game-requests/:studentId - Get user's game requests
router.get('/game-requests/:studentId', userController.getUserGameRequests);

// GET /api/auth/tournament-requests/:studentId - Get user's tournament requests
router.get('/tournament-requests/:studentId', userController.getUserTournamentRequests);

// ── Protected writes (POST/PUT/DELETE) — require valid JWT ────────────────────

// PUT /api/auth/profile/:studentId - Update user profile
router.put('/profile/:studentId', requireAuth, userController.updateProfile);

// PUT /api/auth/profile-setup - Complete profile setup (identity from token)
router.put('/profile-setup', requireAuth, authController.completeProfileSetup);

// POST /api/auth/register - Register for a tournament game
router.post('/register', requireAuth, userController.registerForGame);

// POST /api/auth/create-team - Create a team for a tournament game
router.post('/create-team', requireAuth, userController.createTeam);

// POST /api/auth/team/:teamId/add-member - Add a member to a team
router.post('/team/:teamId/add-member', requireAuth, userController.addTeamMember);

// POST /api/auth/validate-member - Validate a member before adding to team
router.post('/validate-member', requireAuth, userController.validateMember);

// DELETE /api/auth/team/:teamId/member/:memberId - Remove a member from a team
router.delete('/team/:teamId/member/:memberId', requireAuth, userController.removeTeamMember);

// PUT /api/auth/team/:teamId/member/:memberId/replace - Replace a member
router.put('/team/:teamId/member/:memberId/replace', requireAuth, userController.replaceMember);

// POST /api/auth/accept-invitation - Accept a team invitation
router.post('/accept-invitation', requireAuth, userController.acceptTeamInvitation);

// POST /api/auth/reject-invitation - Reject a team invitation
router.post('/reject-invitation', requireAuth, userController.rejectTeamInvitation);

// POST /api/auth/confirm-team/:teamId - Confirm team registration
router.post('/confirm-team/:teamId', requireAuth, userController.confirmTeamRegistration);

// PUT /api/auth/notifications/:notificationId/read - Mark notification as read
router.put('/notifications/:notificationId/read', requireAuth, userController.markNotificationAsRead);

// POST /api/auth/cart/add - Add item to cart
router.post('/cart/add', requireAuth, userController.addToCart);

// DELETE /api/auth/cart/:cartItemId - Remove item from cart
router.delete('/cart/:cartItemId', requireAuth, userController.removeFromCart);

// DELETE /api/auth/cart/clear/:studentId - Clear user's cart
router.delete('/cart/clear/:studentId', requireAuth, userController.clearCart);

// POST /api/auth/cart/checkout - Checkout cart
router.post('/cart/checkout', requireAuth, userController.checkoutCart);

// DELETE /api/auth/cart/game/:gameId/:studentId - Remove cart item by game ID
router.delete('/cart/game/:gameId/:studentId', requireAuth, userController.removeFromCartByGameId);

// DELETE /api/auth/registration/:gameId/:studentId - Cancel game registration
router.delete('/registration/:gameId/:studentId', requireAuth, userController.cancelGameRegistration);

// POST /api/auth/request-game - Request a new game for a tournament
router.post('/request-game', requireAuth, userController.requestGame);

// POST /api/auth/request-tournament - Request a new tournament
router.post('/request-tournament', requireAuth, userController.requestTournament);

module.exports = router;