// AIUB Sports Portal - Backend Server
// Version 1.0

const util = require('util');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Patch util.isDate for OracleDB compatibility with newer Node.js versions
if (!util.isDate) {
    util.isDate = function (date) {
        return date instanceof Date;
    };
}

const app = express();
const PORT = process.env.PORT || 3000;

const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const msAuthRoutes = require('./routes/msauth');
const adminRoutes = require('./routes/admin');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    // Add debugging for file access
    setHeaders: (res, filePath) => {
        console.log('Serving file:', filePath);
    }
}));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/msauth', msAuthRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'AIUB Sports Portal API is running',
        version: '1.0',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to AIUB Sports Portal API',
        version: '1.0',
        endpoints: {
            health: '/api/health',
            login: 'POST /api/auth/login',
            profile: 'GET /api/auth/profile/:studentId',
            updateProfile: 'PUT /api/auth/profile/:studentId'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist'
    });
});

// Start server
app.listen(PORT, () => {
    console.log('===========================================');
    console.log('🚀 AIUB Sports Portal Backend Started');
    console.log('===========================================');
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log('===========================================');
});

module.exports = app;