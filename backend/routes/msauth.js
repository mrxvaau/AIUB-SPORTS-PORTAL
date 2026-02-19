// Microsoft OAuth Routes
// Version 2.0 - With JWT Authentication

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { supabase } = require('../config/supabase');
const { generateTokens } = require('../middleware/auth');
require('dotenv').config();

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const REDIRECT_URI = process.env.AZURE_REDIRECT_URI;
const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || '@student.aiub.edu';

// Microsoft OAuth endpoints
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}`;
const AUTHORIZE_ENDPOINT = `${AUTHORITY}/oauth2/v2.0/authorize`;
const TOKEN_ENDPOINT = `${AUTHORITY}/oauth2/v2.0/token`;
const GRAPH_ENDPOINT = 'https://graph.microsoft.com/v1.0/me';

// Generate authorization URL
router.get('/login', (req, res) => {
    const state = generateRandomString(32);
    const nonce = generateRandomString(32);

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        response_mode: 'query',
        scope: 'openid profile email User.Read',
        state: state,
        nonce: nonce,
        prompt: 'select_account'
    });

    const authUrl = `${AUTHORIZE_ENDPOINT}?${params.toString()}`;

    res.json({
        success: true,
        authUrl: authUrl,
        state: state
    });
});

// Handle OAuth callback
router.post('/callback', async (req, res) => {
    try {
        const { code, state } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Authorization code is required'
            });
        }

        // Exchange code for token
        const tokenResponse = await axios.post(TOKEN_ENDPOINT,
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
                scope: 'openid profile email User.Read'
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token, id_token } = tokenResponse.data;

        // Get user profile from Microsoft Graph
        const profileResponse = await axios.get(GRAPH_ENDPOINT, {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        const userProfile = profileResponse.data;
        const email = userProfile.mail || userProfile.userPrincipalName;

        // Validate email domain
        if (!email || !email.endsWith(ALLOWED_DOMAIN)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Only ${ALLOWED_DOMAIN} emails are allowed.`,
                email: email
            });
        }

        // Validate AIUB email format (XX-XXXXX-X@student.aiub.edu)
        const emailPattern = /^\d{2}-\d{5}-\d@student\.aiub\.edu$/;
        if (!emailPattern.test(email)) {
            return res.status(403).json({
                success: false,
                message: 'Invalid AIUB student email format. Expected: XX-XXXXX-X@student.aiub.edu',
                email: email
            });
        }

        // Extract student ID
        const studentId = email.split('@')[0];

        // Check if user exists or create new user
        let user;
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('student_id', studentId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching user:', fetchError);
            throw fetchError;
        }

        if (!existingUser) {
            // Create new user
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([{
                    student_id: studentId,
                    email: email,
                    full_name: userProfile.displayName,
                    is_first_login: true,
                    profile_completed: false,
                    last_login: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Error creating user:', insertError);
                throw insertError;
            }
            user = newUser;
        } else {
            // Update existing user
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    last_login: new Date().toISOString(),
                    full_name: userProfile.displayName // Update name from Microsoft
                })
                .eq('student_id', studentId);

            if (updateError) {
                console.error('Error updating user:', updateError);
            }

            user = existingUser;
        }

        // Generate JWT tokens
        const { accessToken: jwtAccessToken, refreshToken: jwtRefreshToken, expiresIn } = generateTokens(user);

        // Return user data with JWT tokens
        res.json({
            success: true,
            user: {
                id: user.id,
                email: email,
                studentId: studentId,
                name: userProfile.displayName,
                givenName: userProfile.givenName,
                surname: userProfile.surname,
                profileCompleted: user.profile_completed,
                isFirstLogin: user.is_first_login
            },
            accessToken: jwtAccessToken,
            refreshToken: jwtRefreshToken,
            expiresIn: expiresIn,
            tokenType: 'Bearer'
        });

    } catch (error) {
        console.error('OAuth callback error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Authentication failed',
            error: error.response?.data?.error_description || error.message
        });
    }
});

// Verify JWT token
router.post('/verify', async (req, res) => {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: 'Access token is required'
            });
        }

        // Verify JWT token
        const { verifyToken } = require('../middleware/auth');
        const decoded = verifyToken(accessToken);

        // Fetch user to verify still exists
        const { data: user, error } = await supabase
            .from('users')
            .select('email')
            .eq('id', decoded.userId)
            .single();

        if (error || !user) {
            return res.status(401).json({
                success: false,
                valid: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            valid: true,
            email: user.email,
            userId: decoded.userId,
            studentId: decoded.studentId
        });

    } catch (error) {
        res.status(401).json({
            success: false,
            valid: false,
            message: error.message || 'Invalid or expired token'
        });
    }
});

// Refresh access token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        const { refreshAccessToken } = require('../middleware/auth');
        const tokens = await refreshAccessToken(refreshToken);

        res.json({
            success: true,
            ...tokens
        });

    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message || 'Invalid refresh token'
        });
    }
});

// Helper function to generate random string
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

module.exports = router;