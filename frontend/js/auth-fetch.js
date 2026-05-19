/**
 * AIUB Sports Portal - Authenticated Fetch Utility
 * Wraps fetch() to automatically include JWT Authorization headers
 * and handle 401 responses by redirecting to login.
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
 * Fetch wrapper that attaches the JWT token from localStorage.
 * On 401 responses, clears auth state and redirects to login.
 *
 * @param {string} url - The URL to fetch
 * @param {object} [options={}] - Standard fetch options
 * @returns {Promise<Response|undefined>} The fetch response, or undefined on redirect
 */
async function authFetch(url, options = {}) {
    const token = safeGetItem('jwtToken') || safeGetItem('msAccessToken');
    if (!token) {
        redirectToLogin();
        return;
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        safeRemoveItem('isAuthenticated');
        safeRemoveItem('jwtToken');
        safeRemoveItem('msAccessToken');
        safeRemoveItem('studentId');
        safeRemoveItem('userEmail');
        safeRemoveItem('userName');
        redirectToLogin();
        return;
    }

    return response;
}
