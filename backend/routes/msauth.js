// Microsoft OAuth Routes
// Version 1.1

const express = require('express');
const router = express.Router();
const axios = require('axios');
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

        // Return user data
        res.json({
            success: true,
            user: {
                email: email,
                studentId: studentId,
                name: userProfile.displayName,
                givenName: userProfile.givenName,
                surname: userProfile.surname
            },
            accessToken: access_token
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

// Verify token
router.post('/verify', async (req, res) => {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: 'Access token is required'
            });
        }

        // Verify token with Microsoft Graph
        const response = await axios.get(GRAPH_ENDPOINT, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const email = response.data.mail || response.data.userPrincipalName;

        res.json({
            success: true,
            valid: true,
            email: email
        });

    } catch (error) {
        res.status(401).json({
            success: false,
            valid: false,
            message: 'Invalid or expired token'
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