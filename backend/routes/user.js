// User Routes
// Profile, notifications, and invitations

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const notificationController = require('../controllers/notificationController');
const teamController = require('../controllers/teamController');
const { requireAuth } = require('../middleware/auth');

// GET /api/user/profile/:studentId - Get user profile
router.get('/profile/:studentId', requireAuth, authController.getProfile);

// PUT /api/user/profile/:studentId - Update user profile
router.put('/profile/:studentId', requireAuth, authController.updateProfile);

// PUT /api/user/profile-setup - Complete profile setup
router.put('/profile-setup', requireAuth, authController.completeProfileSetup);

// GET /api/user/name-edit-count/:studentId - Get name edit count
router.get('/name-edit-count/:studentId', requireAuth, authController.getNameEditCount);

// GET /api/user/notifications/:studentId - Get user notifications
router.get('/notifications/:studentId', requireAuth, notificationController.getNotifications);

// PUT /api/user/notifications/:notificationId/read - Mark notification as read
router.put('/notifications/:notificationId/read', requireAuth, notificationController.markNotificationAsRead);

// GET /api/user/pending-invitations/:studentId - Get pending team invitations
router.get('/pending-invitations/:studentId', requireAuth, teamController.getPendingTeamInvitations);

module.exports = router;
