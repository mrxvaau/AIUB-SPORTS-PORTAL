// AIUB Sports Portal - Backend Server (Production-Ready)
// Version 3.0 — Domain-agnostic, HA-ready, structured logging

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// Production modules
const logger = require('./lib/logger');
const { attachShutdown, shutdownGuard } = require('./lib/shutdown');
const { createRequestLogger } = require('./middleware/request-logger');

const app = express();

const PORT = process.env.PORT || 3000;
const SERVER_NAME = process.env.SERVER_NAME || 'app-server-1';
const APP_VERSION = process.env.APP_VERSION || require('./package.json').version;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ──────────────────────────────────────────────
// Trust Proxy (required behind Cloudflare/Nginx/LB)
// ──────────────────────────────────────────────
app.set('trust proxy', process.env.TRUST_PROXY || 1);

// ──────────────────────────────────────────────
// Security Headers
// ──────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false,       // Frontend handles CSP
    crossOriginEmbedderPolicy: false,   // Allow Supabase CDN embeds
    crossOriginResourcePolicy: { policy: 'cross-origin' } // Allow cross-origin images
}));

// ──────────────────────────────────────────────
// Shutdown Guard (503 during graceful shutdown)
// ──────────────────────────────────────────────
app.use(shutdownGuard);

// ──────────────────────────────────────────────
// Initialize Supabase
// ──────────────────────────────────────────────
const { initialize: initializeSupabase } = require('./config/supabase');

// ──────────────────────────────────────────────
// Import Routes
// ──────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const msAuthRoutes = require('./routes/msauth');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const healthRoutes = require('./routes/health');

// Domain-grouped routes
const userRoutes = require('./routes/user');
const tournamentRoutes = require('./routes/tournaments');
const registrationRoutes = require('./routes/registration');
const teamRoutes = require('./routes/teams');
const cartRoutes = require('./routes/cart');

// ──────────────────────────────────────────────
// CORS — Domain-Agnostic Configuration
// ──────────────────────────────────────────────
const buildAllowedOrigins = () => {
    const origins = [];

    // From CORS_ORIGINS env (comma-separated), e.g.: "https://sportsportal.com,https://admin.sportsportal.com"
    if (process.env.CORS_ORIGINS) {
        process.env.CORS_ORIGINS.split(',').forEach(o => origins.push(o.trim()));
    }

    // Legacy single CORS_ORIGIN env
    if (process.env.CORS_ORIGIN) {
        origins.push(process.env.CORS_ORIGIN.trim());
    }

    // FRONTEND_URL env
    if (process.env.FRONTEND_URL) {
        origins.push(process.env.FRONTEND_URL.trim());
    }

    // Tunnel URL if set at runtime
    if (process.env.TUNNEL_FRONTEND_URL) {
        origins.push(process.env.TUNNEL_FRONTEND_URL);
    }

    // Default localhost for development
    if (origins.length === 0 || NODE_ENV === 'development') {
        origins.push('http://localhost:3001', 'http://127.0.0.1:3001',
                      'http://localhost:3000', 'http://127.0.0.1:3000');
    }

    return [...new Set(origins)]; // Deduplicate
};

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, same-origin)
        if (!origin) return callback(null, true);

        const allowed = buildAllowedOrigins();

        if (allowed.includes(origin) || (NODE_ENV === 'development' && process.env.CORS_ORIGIN === '*')) {
            callback(null, true);
        } else {
            logger.warn({ origin, allowed }, 'CORS blocked request');
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: [
        'Content-Type', 'Authorization', 'X-User-Email', 'x-user-email',
        'X-Requested-With', 'Accept', 'Origin', 'X-Request-ID'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['X-Request-ID']
}));

// ──────────────────────────────────────────────
// Body Parsing
// ──────────────────────────────────────────────
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// ──────────────────────────────────────────────
// Static Files (legacy uploads — backward compat)
// ──────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: NODE_ENV === 'production' ? '7d' : 0
}));

// Handle favicon
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ──────────────────────────────────────────────
// Request Logging (structured JSON)
// ──────────────────────────────────────────────
app.use(createRequestLogger(logger));

// ──────────────────────────────────────────────
// Routes — Health (no auth, before all others)
// ──────────────────────────────────────────────
app.use('/health', healthRoutes);

// Legacy health endpoint alias (backward compat)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'AIUB Sports Portal API is running',
        version: APP_VERSION,
        server: SERVER_NAME,
        timestamp: new Date().toISOString()
    });
});

// ──────────────────────────────────────────────
// Rate Limiting
// ──────────────────────────────────────────────
const rateLimit = require('express-rate-limit');

// Strict limit on auth endpoints (prevent brute-force login)
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again in a minute.' }
});

// Moderate limit on admin endpoints
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' }
});

// Global fallback limit
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Rate limit exceeded. Please try again later.' }
});

app.use('/api/', globalLimiter);

// ──────────────────────────────────────────────
// Routes — Domain-Grouped
// ──────────────────────────────────────────────
app.use('/api/user', userRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/cart', cartRoutes);

// Legacy routes (backward compatibility)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/msauth', authLimiter, msAuthRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ──────────────────────────────────────────────
// Root Endpoint
// ──────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        message: 'AIUB Sports Portal API',
        version: APP_VERSION,
        server: SERVER_NAME,
        health: '/health',
        docs: '/api/health'
    });
});

// ──────────────────────────────────────────────
// Error Handling
// ──────────────────────────────────────────────
app.use((err, req, res, next) => {
    logger.error({ err, reqId: req.id, path: req.path }, 'Unhandled error');
    res.status(500).json({
        error: 'Internal Server Error',
        message: NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
        requestId: req.id
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        requestId: req.id
    });
});

// ──────────────────────────────────────────────
// Start Server
// ──────────────────────────────────────────────
async function startServer() {
    try {
        await initializeSupabase();
        logger.info('Supabase initialized successfully');

        const server = app.listen(PORT, () => {
            logger.info({
                port: PORT,
                server: SERVER_NAME,
                version: APP_VERSION,
                env: NODE_ENV,
                trustProxy: app.get('trust proxy')
            }, `🚀 AIUB Sports Portal started on port ${PORT}`);

            console.log('===========================================');
            console.log('🚀 AIUB Sports Portal Backend Started');
            console.log('===========================================');
            console.log(`📡 Server: ${SERVER_NAME}`);
            console.log(`🔧 Environment: ${NODE_ENV}`);
            console.log(`🌐 Port: ${PORT}`);
            console.log(`🏥 Health: http://localhost:${PORT}/health`);
            console.log(`📊 Detailed: http://localhost:${PORT}/health/detailed`);
            console.log('===========================================');

            // Signal PM2 that we're ready (for wait_ready mode)
            if (typeof process.send === 'function') {
                process.send('ready');
            }
        });

        // Attach graceful shutdown
        attachShutdown(server, {
            logger,
            onShutdown: async () => {
                logger.info('Running cleanup tasks...');
                // Add any cleanup here (close pools, flush logs, etc.)
            }
        });

    } catch (error) {
        logger.fatal({ err: error }, 'Failed to start server');
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;