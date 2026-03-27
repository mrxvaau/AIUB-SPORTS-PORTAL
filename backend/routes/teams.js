// Team Routes
// Team creation, membership, and invitations

const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { requireAuth } = require('../middleware/auth');

// POST /api/teams/create - Create a team
router.post('/create', requireAuth, teamController.createTeam);

// GET /api/teams/:teamId - Get team details
router.get('/:teamId', requireAuth, teamController.getTeamDetails);

// GET /api/teams/by-game/:gameId/:studentId - Get team by game and student
router.get('/by-game/:gameId/:studentId', requireAuth, teamController.getTeamByGame);

// POST /api/teams/:teamId/members - Add a team member
router.post('/:teamId/members', requireAuth, teamController.addTeamMember);

// POST /api/teams/validate-member - Validate a member
router.post('/validate-member', requireAuth, teamController.validateMember);

// DELETE /api/teams/:teamId/members/:memberId - Remove a team member
router.delete('/:teamId/members/:memberId', requireAuth, teamController.removeTeamMember);

// PUT /api/teams/:teamId/members/:memberId/replace - Replace a team member
router.put('/:teamId/members/:memberId/replace', requireAuth, teamController.replaceMember);

// POST /api/teams/invitations/accept - Accept a team invitation
router.post('/invitations/accept', requireAuth, teamController.acceptTeamInvitation);

// POST /api/teams/invitations/reject - Reject a team invitation
router.post('/invitations/reject', requireAuth, teamController.rejectTeamInvitation);

// POST /api/teams/:teamId/confirm - Confirm team registration
router.post('/:teamId/confirm', requireAuth, teamController.confirmTeamRegistration);

module.exports = router;
