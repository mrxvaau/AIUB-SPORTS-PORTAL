// Authentication Routes
// Version 1.0

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// POST /api/auth/login - Login or register user
router.post('/login', userController.login);

// GET /api/auth/profile/:studentId - Get user profile
router.get('/profile/:studentId', userController.getProfile);

// PUT /api/auth/profile/:studentId - Update user profile
router.put('/profile/:studentId', userController.updateProfile);

// GET /api/auth/name-edit-count/:studentId - Get name edit count
router.get('/name-edit-count/:studentId', userController.getNameEditCount);

module.exports = router;