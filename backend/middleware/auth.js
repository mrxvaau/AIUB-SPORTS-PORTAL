// JWT Authentication Middleware
// Handles JWT token verification and user authentication

const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

// JWT Secret - MUST be set in environment variables
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.warn('⚠️  WARNING: JWT_SECRET not set in environment variables!');
    console.warn('   Generate a secure secret: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
}

// Token expiration time
const TOKEN_EXPIRATION = '1h'; // Access token expires in 1 hour
const REFRESH_TOKEN_EXPIRATION = '7d'; // Refresh token expires in 7 days

/**
 * Generate JWT tokens for a user
 * @param {Object} user - User object with id, email, student_id
 * @returns {Object} - { accessToken, refreshToken, expiresIn }
 */
function generateTokens(user) {
    const accessTokenPayload = {
        userId: user.id,
        studentId: user.student_id,
        email: user.email,
        type: 'access'
    };

    const refreshTokenPayload = {
        userId: user.id,
        studentId: user.student_id,
        email: user.email,
        type: 'refresh'
    };

    const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET, {
        expiresIn: TOKEN_EXPIRATION
    });

    const refreshToken = jwt.sign(refreshTokenPayload, JWT_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRATION
    });

    return {
        accessToken,
        refreshToken,
        expiresIn: 3600 // 1 hour in seconds
    };
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} - Decoded token payload
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token expired');
        } else if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        }
        throw error;
    }
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} - Token or null
 */
function extractTokenFromHeader(authHeader) {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
    }
    return null;
}

/**
 * Middleware to require authentication
 * Verifies JWT token and attaches user to request
 */
async function requireAuth(req, res, next) {
    try {
        // Try to get token from Authorization header
        const authHeader = req.headers.authorization;
        let token = extractTokenFromHeader(authHeader);

        // If no token in header, check cookies (for future implementation)
        if (!token) {
            token = req.cookies?.accessToken;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in.'
            });
        }

        // Verify token
        const decoded = verifyToken(token);

        if (decoded.type !== 'access') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token type'
            });
        }

        // Fetch fresh user data from database
        const { data: user, error } = await supabase
            .from('users')
            .select('id, student_id, email, full_name, profile_completed')
            .eq('id', decoded.userId)
            .single();

        if (error || !user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Attach user info to request
        req.user = {
            id: user.id,
            studentId: user.student_id,
            email: user.email,
            fullName: user.full_name,
            profileCompleted: user.profile_completed
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error.message);
        return res.status(401).json({
            success: false,
            message: error.message === 'Token expired' 
                ? 'Session expired. Please log in again.' 
                : 'Authentication failed'
        });
    }
}

/**
 * Middleware to require admin role
 * Must be used after requireAuth or with token verification
 */
async function requireAdmin(req, res, next) {
    try {
        // First ensure user is authenticated
        if (!req.user) {
            // Try to get token from header
            const authHeader = req.headers.authorization;
            let token = extractTokenFromHeader(authHeader);

            if (!token) {
                token = req.cookies?.accessToken;
            }

            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const decoded = verifyToken(token);
            
            // Fetch user data
            const { data: user, error } = await supabase
                .from('users')
                .select('id, student_id, email, full_name')
                .eq('id', decoded.userId)
                .single();

            if (error || !user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }

            req.user = {
                id: user.id,
                studentId: user.student_id,
                email: user.email,
                fullName: user.full_name
            };
        }

        // Check if user has admin roles
        // Check both users table (for user ID based roles) and admins table (for email based roles)
        const { data: userRoleData, error: userRoleError } = await supabase
            .from('admin_role_map')
            .select(`
                admin_roles(role_name)
            `)
            .eq('admin_id', req.user.id);

        let roles = [];
        if (userRoleData && userRoleData.length > 0) {
            roles = userRoleData.map(role => role.admin_roles.role_name);
        }

        // Also check admins table by email
        if (roles.length === 0) {
            const { data: adminRecord, error: adminError } = await supabase
                .from('admins')
                .select('id')
                .eq('email', req.user.email)
                .single();

            if (adminRecord) {
                const { data: adminRoleData, error: adminRoleError } = await supabase
                    .from('admin_role_map')
                    .select(`
                        admin_roles(role_name)
                    `)
                    .eq('admin_id', adminRecord.id);

                if (adminRoleData && adminRoleData.length > 0) {
                    roles = adminRoleData.map(role => role.admin_roles.role_name);
                }
            }
        }

        if (roles.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        // Attach admin info to request
        req.admin = {
            roles: roles,
            isSuperAdmin: roles.includes('SUPER_ADMIN')
        };

        next();
    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
}

/**
 * Optional auth middleware - attaches user if token is valid, but doesn't require it
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        let token = extractTokenFromHeader(authHeader);

        if (!token) {
            token = req.cookies?.accessToken;
        }

        if (!token) {
            return next(); // No token, continue without user
        }

        const decoded = verifyToken(token);

        const { data: user, error } = await supabase
            .from('users')
            .select('id, student_id, email, full_name, profile_completed')
            .eq('id', decoded.userId)
            .single();

        if (!error && user) {
            req.user = {
                id: user.id,
                studentId: user.student_id,
                email: user.email,
                fullName: user.full_name,
                profileCompleted: user.profile_completed
            };
        }

        next();
    } catch (error) {
        // Token invalid, but continue without user
        next();
    }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Valid refresh token
 * @returns {Object} - New tokens
 */
async function refreshAccessToken(refreshToken) {
    try {
        const decoded = verifyToken(refreshToken);

        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }

        // Fetch fresh user data
        const { data: user, error } = await supabase
            .from('users')
            .select('id, student_id, email')
            .eq('id', decoded.userId)
            .single();

        if (error || !user) {
            throw new Error('User not found');
        }

        // Generate new tokens
        return generateTokens(user);
    } catch (error) {
        throw new Error('Invalid refresh token');
    }
}

module.exports = {
    // Middleware
    requireAuth,
    requireAdmin,
    optionalAuth,
    
    // Token functions
    generateTokens,
    verifyToken,
    refreshAccessToken,
    extractTokenFromHeader,
    
    // Constants
    JWT_SECRET,
    TOKEN_EXPIRATION,
    REFRESH_TOKEN_EXPIRATION
};
