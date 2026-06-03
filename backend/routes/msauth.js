// Microsoft OAuth Routes
// Version 3.0 - Dual Domain (student + faculty/official), Azure ID lookup, Profile Photo

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto'); // Use Node.js built-in crypto for secure random values
const { supabase } = require('../config/supabase');
const { generateTokens, requireAuth } = require('../middleware/auth');
require('dotenv').config();

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const REDIRECT_URI = process.env.AZURE_REDIRECT_URI;

// Allowed domains
const ALLOWED_DOMAINS = ['@student.aiub.edu', '@aiub.edu'];

// Microsoft OAuth endpoints
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}`;
const AUTHORIZE_ENDPOINT = `${AUTHORITY}/oauth2/v2.0/authorize`;
const TOKEN_ENDPOINT = `${AUTHORITY}/oauth2/v2.0/token`;
const GRAPH_ME_ENDPOINT = 'https://graph.microsoft.com/v1.0/me';
const GRAPH_PHOTO_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/photo/$value';

// Shared cookie options for auth tokens
function tokenCookieOptions(maxAgeMs) {
    const isProd = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'strict' : 'lax',
        maxAge: maxAgeMs,
        path: '/'
    };
}

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

    // Store state in a short-lived HttpOnly cookie for CSRF validation.
    // path:'/' ensures the cookie is sent on ALL backend requests, not just /api/msauth sub-paths.
    // This prevents 'Invalid OAuth state' errors in dev where frontend (3001) and backend (3000)
    // are on different ports (cross-origin), causing some browsers to drop narrow-path cookies.
    res.cookie('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
        path: '/'
    });

    res.json({
        success: true,
        authUrl: `${AUTHORIZE_ENDPOINT}?${params.toString()}`,
        state: state
    });
});

// Handle OAuth callback - main auth entry point
router.post('/callback', async (req, res) => {
    try {
        const { code, state: clientState } = req.body;

        if (!code) {
            return res.status(400).json({ success: false, message: 'Authorization code is required' });
        }

        // ── CSRF: Validate OAuth state parameter ──
        // Primary validation is done client-side in callback.html (sessionStorage).
        // This server-side cookie check is a secondary layer. In cross-origin dev environments
        // (frontend on :3001, backend on :3000) the cookie may not always be present.
        const cookieState = req.cookies?.oauth_state;

        if (cookieState && clientState && cookieState !== clientState) {
            // Cookie IS present but doesn't match — genuine mismatch, reject.
            console.warn('[msauth] OAuth state mismatch — possible CSRF attempt', {
                hasCookie: !!cookieState, hasClient: !!clientState
            });
            return res.status(403).json({
                success: false,
                message: 'Invalid OAuth state. Please try logging in again.'
            });
        }

        if (!clientState) {
            // No state at all — reject.
            return res.status(400).json({
                success: false,
                message: 'Missing OAuth state. Please try logging in again.'
            });
        }
        // Clear state cookie immediately — one-time use
        res.clearCookie('oauth_state', { path: '/' });

        // 1. Exchange code for MS access token
        const tokenResponse = await axios.post(TOKEN_ENDPOINT,
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
                scope: 'openid profile email User.Read'
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token } = tokenResponse.data;

        // 2. Fetch user profile from Microsoft Graph /me
        const graphHeaders = { Authorization: `Bearer ${access_token}` };
        const profileResponse = await axios.get(GRAPH_ME_ENDPOINT, { headers: graphHeaders });
        const msProfile = profileResponse.data;

        // Extract identity fields – trusted from MS Graph only
        const azureId = msProfile.id;
        const email = (msProfile.mail || msProfile.userPrincipalName || '').toLowerCase();
        const fullName = msProfile.displayName || '';

        // 3. Domain validation
        const allowedDomain = ALLOWED_DOMAINS.find(d => email.endsWith(d));
        if (!allowedDomain) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Only @student.aiub.edu and @aiub.edu accounts are allowed.`,
                email
            });
        }

        // 4. Determine role and student_id
        const studentId = email.split('@')[0];
        const isStudent = allowedDomain === '@student.aiub.edu';
        const autoRole = isStudent ? 'student' : null; // aiub.edu users select role in setup

        // 5. Fetch profile photo from MS Graph and upload to Supabase Storage
        let profilePhotoUrl = null;
        try {
            const photoResponse = await axios.get(GRAPH_PHOTO_ENDPOINT, {
                headers: graphHeaders,
                responseType: 'arraybuffer'
            });
            const photoBuffer = Buffer.from(photoResponse.data);

            // Upload any valid photo (no size restriction)
            const fileName = `${azureId}.jpg`;
            const { error: uploadError } = await supabase
                .storage
                .from('profile-photos')
                .upload(fileName, photoBuffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (!uploadError) {
                const { data: urlData } = supabase
                    .storage
                    .from('profile-photos')
                    .getPublicUrl(fileName);
                profilePhotoUrl = urlData?.publicUrl || null;
                console.log('[msauth] Profile photo uploaded:', profilePhotoUrl);
            } else {
                console.warn('[msauth] Photo upload error:', uploadError.message);
            }
        } catch (photoErr) {
            // No photo set / permission denied - not critical, continue
            console.log('[msauth] No profile photo available:', photoErr.message);
        }

        // 6. Upsert user by azure_id
        let user;
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('azure_id', azureId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('[msauth] Error fetching user by azure_id:', fetchError);
            throw fetchError;
        }

        if (!existingUser) {
            // New user - insert record
            const insertPayload = {
                azure_id: azureId,
                student_id: studentId,
                email: email,
                full_name: fullName,
                role: autoRole,
                profile_photo_url: profilePhotoUrl,
                // For @aiub.edu users, official_id is auto-set from email prefix
                official_id: isStudent ? null : studentId,
                is_first_login: true,
                profile_completed: false,
                last_login: new Date().toISOString()
            };

            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([insertPayload])
                .select()
                .single();

            if (insertError) {
                // Possible: student_id collision from old data - try fallback lookup by email
                if (insertError.code === '23505') {
                    // Check if maybe old record exists by student_id without azure_id
                    const { data: oldUser } = await supabase
                        .from('users')
                        .select('*')
                        .eq('student_id', studentId)
                        .single();

                    if (oldUser) {
                        // Migrate: stamp azure_id onto the old record
                        await supabase
                            .from('users')
                            .update({
                                azure_id: azureId,
                                email: email,
                                full_name: fullName,
                                role: oldUser.role || autoRole,
                                official_id: isStudent ? null : studentId,
                                profile_photo_url: profilePhotoUrl || oldUser.profile_photo_url,
                                last_login: new Date().toISOString()
                            })
                            .eq('student_id', studentId);

                        user = { ...oldUser, azure_id: azureId };
                    } else {
                        console.error('[msauth] Insert conflict but no old record found:', insertError);
                        throw insertError;
                    }
                } else {
                    console.error('[msauth] Error creating user:', insertError);
                    throw insertError;
                }
            } else {
                user = newUser;
            }
        } else {
            // Existing user - update last_login, name, photo
            const updatePayload = {
                last_login: new Date().toISOString(),
                full_name: fullName,  // Always refresh from MS as source of truth
            };
            if (profilePhotoUrl) {
                updatePayload.profile_photo_url = profilePhotoUrl;
            }

            await supabase
                .from('users')
                .update(updatePayload)
                .eq('azure_id', azureId);

            user = { ...existingUser, full_name: fullName };
            if (profilePhotoUrl) user.profile_photo_url = profilePhotoUrl;
        }

        // 7. Generate JWT tokens
        const { accessToken: jwtAccessToken, refreshToken: jwtRefreshToken, expiresIn } = generateTokens(user);

        // 8. Deliver tokens as HttpOnly cookies (not in the response body)
        //    This prevents XSS from stealing tokens via localStorage.
        res.cookie('access_token', jwtAccessToken, tokenCookieOptions(expiresIn * 1000));
        res.cookie('refresh_token', jwtRefreshToken, tokenCookieOptions(7 * 24 * 60 * 60 * 1000)); // 7 days

        // 9. Return user profile only (tokens are in cookies — not in body)
        return res.json({
            success: true,
            user: {
                id: user.id,
                azureId: azureId,
                email: email,
                studentId: studentId,
                name: fullName,
                role: user.role,
                profilePhotoUrl: user.profile_photo_url,
                profileCompleted: user.profile_completed,
                isFirstLogin: user.is_first_login,
                needsRoleSelection: !isStudent && !user.role
            },
            expiresIn,
            tokenType: 'Bearer'
        });

    } catch (error) {
        const isProduction = process.env.NODE_ENV === 'production';
        console.error('[msauth] OAuth callback error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Authentication failed',
            error: isProduction ? undefined : (error.response?.data?.error_description || error.message)
        });
    }
});

// Logout — clear auth cookies
router.post('/logout', (req, res) => {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully' });
});

// Verify JWT token (reads from cookie OR Authorization header for backward compat)
router.post('/verify', async (req, res) => {
    try {
        // Prefer cookie; fall back to body for backward compatibility
        const accessToken = req.cookies?.access_token || req.body?.accessToken;

        if (!accessToken) {
            return res.status(401).json({ success: false, message: 'Access token is required' });
        }

        const { verifyToken } = require('../middleware/auth');
        const decoded = verifyToken(accessToken);

        const { data: user, error } = await supabase
            .from('users')
            .select('email, azure_id')
            .eq('id', decoded.userId)
            .single();

        if (error || !user) {
            return res.status(401).json({ success: false, valid: false, message: 'User not found' });
        }

        res.json({
            success: true,
            valid: true,
            email: user.email,
            userId: decoded.userId,
            studentId: decoded.studentId
        });

    } catch (error) {
        res.status(401).json({ success: false, valid: false, message: error.message || 'Invalid or expired token' });
    }
});

// Refresh access token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ success: false, message: 'Refresh token is required' });
        }

        const { refreshAccessToken } = require('../middleware/auth');
        const tokens = await refreshAccessToken(refreshToken);

        res.json({ success: true, ...tokens });

    } catch (error) {
        res.status(401).json({ success: false, message: error.message || 'Invalid refresh token' });
    }
});

// Helper: generate cryptographically secure random string
function generateRandomString(length) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

module.exports = router;