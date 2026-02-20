// AIUB Sports Portal - Backend Server (Supabase)
// Version 1.0

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;

const path = require('path');

// Initialize Supabase
const { initialize: initializeSupabase } = require('./config/supabase');

// Import routes
const authRoutes = require('./routes/auth');
const msAuthRoutes = require('./routes/msauth');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Define allowed origins
        const allowedOrigins = [
            'http://localhost:3001',
            'http://127.0.0.1:3001',
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ];

        // Add tunnel frontend URL if available (set when tunnels are started)
        if (process.env.TUNNEL_FRONTEND_URL) {
            allowedOrigins.push(process.env.TUNNEL_FRONTEND_URL);
        }

        // Check if the origin is in the allowed list
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development' && process.env.CORS_ORIGIN === '*') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,  // Allow cookies/auth headers
    optionsSuccessStatus: 200,  // For older browsers
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-User-Email',
        'x-user-email',
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    // Add debugging for file access
    setHeaders: (res, filePath) => {
        console.log('Serving file:', filePath);
    }
}));

// Handle favicon requests to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No content response
});

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/msauth', msAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);

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

// Initialize database connection when server starts
async function startServer() {
    try {
        // Initialize Supabase connection
        await initializeSupabase();
        console.log('✅ Supabase initialized successfully');

        // Start server
        app.listen(PORT, () => {
            console.log('===========================================');
            console.log('🚀 AIUB Sports Portal Backend Started');
            console.log('===========================================');
            console.log(`📡 Server running on: http://localhost:${PORT}`);
            console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
            console.log('===========================================');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

module.exports = app;