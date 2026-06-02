/**
 * AIUB Sports Portal - Authenticated Fetch Utility
 * Version 2.0 - Secure Cookie-Based Auth
 *
 * Primary:  HttpOnly cookie 'access_token' (set by /api/msauth/callback)
 * Fallback: Bearer token from localStorage (backward compat, will be removed)
 *
 * Cross-browser safe: uses try-catch around all storage access to handle
 * browsers that block or sandbox localStorage (Opera, Firefox strict, Safari ITP).
 */

/**
 * Safe wrapper around localStorage — returns null instead of throwing
 * when storage is blocked by browser privacy settings.
 */
function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

function safeRemoveItem(key) {
    try { localStorage.removeItem(key); } catch (e) {}
    try { sessionStorage.removeItem(key); } catch (e) {}
}

/**
 * Redirect to login only if not already on login page (prevents loop).
 */
function redirectToLogin() {
    if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
    }
}

/**
 * Clear all locally stored session data (non-sensitive display data).
 * Tokens are stored in HttpOnly cookies and cleared by the /logout endpoint.
 */
function clearLocalSession() {
    const keys = [
        'isAuthenticated', 'jwtToken', 'msAccessToken', 'jwtRefreshToken',
        'studentId', 'userEmail', 'userName', 'userRole', 'azureId',
        'profilePhotoUrl', 'userData', 'needsRoleSelection', 'isAdmin'
    ];
    keys.forEach(safeRemoveItem);
}

/**
 * Logout: clear cookies via API + local session data.
 */
async function logout() {
    try {
        await fetch(buildApiUrl ? buildApiUrl('/api/msauth/logout') : '/api/msauth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (e) {
        // Ignore network errors on logout
    }
    clearLocalSession();
    window.location.href = 'login.html';
}

/**
 * Authenticated fetch — sends HttpOnly cookies automatically.
 * Falls back to Authorization header for backward compatibility.
 *
 * @param {string} url - The URL to fetch
 * @param {object} [options={}] - Standard fetch options
 * @returns {Promise<Response|undefined>} The fetch response, or undefined on redirect
 */
async function authFetch(url, options = {}) {
    // Always send cookies (HttpOnly access_token is the primary auth mechanism)
    const fetchOptions = {
        ...options,
        credentials: 'include',
        headers: { ...options.headers }
    };

    // Backward-compat: if a legacy JWT is still in localStorage, send it too
    // This ensures no-one is logged out during the transition.
    const legacyToken = safeGetItem('jwtToken') || safeGetItem('msAccessToken');
    if (legacyToken && !fetchOptions.headers['Authorization']) {
        fetchOptions.headers['Authorization'] = `Bearer ${legacyToken}`;
    }

    const response = await fetch(url, fetchOptions);

    if (response.status === 401) {
        clearLocalSession();
        redirectToLogin();
        return;
    }

    return response;
}
