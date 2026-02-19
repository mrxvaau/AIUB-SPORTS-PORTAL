// User Controller - Index File
// Version 3.0 - Refactored into domain-specific controllers
// This file re-exports all functions from the split controllers for backward compatibility

// Import all controllers
const authController = require('./authController');
const tournamentController = require('./tournamentController');
const registrationController = require('./registrationController');
const teamController = require('./teamController');
const notificationController = require('./notificationController');
const cartController = require('./cartController');
const requestController = require('./requestController');

// ============================================
// Re-export all functions for backward compatibility
// ============================================

// Auth & Profile functions (from authController)
exports.login = authController.login;
exports.getProfile = authController.getProfile;
exports.updateProfile = authController.updateProfile;
exports.getNameEditCount = authController.getNameEditCount;
exports.checkModeratorStatus = authController.checkModeratorStatus;
exports.debugAdminCheck = authController.debugAdminCheck;
exports.getUserProfile = authController.getUserProfile;

// Tournament functions (from tournamentController)
exports.getAvailableTournaments = tournamentController.getAvailableTournaments;
exports.getTournamentGames = tournamentController.getTournamentGames;

// Registration functions (from registrationController)
exports.registerForGame = registrationController.registerForGame;
exports.getUserRegistrations = registrationController.getUserRegistrations;
exports.cancelGameRegistration = registrationController.cancelGameRegistration;
exports.checkoutCart = registrationController.checkoutCart;

// Team functions (from teamController)
exports.createTeam = teamController.createTeam;
exports.getTeamDetails = teamController.getTeamDetails;
exports.getTeamByGame = teamController.getTeamByGame;
exports.addTeamMember = teamController.addTeamMember;
exports.removeTeamMember = teamController.removeTeamMember;
exports.replaceMember = teamController.replaceMember;
exports.acceptTeamInvitation = teamController.acceptTeamInvitation;
exports.rejectTeamInvitation = teamController.rejectTeamInvitation;
exports.confirmTeamRegistration = teamController.confirmTeamRegistration;
exports.getPendingTeamInvitations = teamController.getPendingTeamInvitations;
exports.validateMember = teamController.validateMember;

// Notification functions (from notificationController)
exports.getNotifications = notificationController.getNotifications;
exports.markNotificationAsRead = notificationController.markNotificationAsRead;

// Cart functions (from cartController)
exports.addToCart = cartController.addToCart;
exports.getCart = cartController.getCart;
exports.removeFromCart = cartController.removeFromCart;
exports.removeFromCartByGameId = cartController.removeFromCartByGameId;
exports.clearCart = cartController.clearCart;

// Request functions (from requestController)
exports.requestGame = requestController.requestGame;
exports.requestTournament = requestController.requestTournament;
exports.getUserGameRequests = requestController.getUserGameRequests;
exports.getUserTournamentRequests = requestController.getUserTournamentRequests;

// ============================================
// Also export the individual controllers for direct access
// ============================================
module.exports.controllers = {
    auth: authController,
    tournament: tournamentController,
    registration: registrationController,
    team: teamController,
    notification: notificationController,
    cart: cartController,
    request: requestController
};