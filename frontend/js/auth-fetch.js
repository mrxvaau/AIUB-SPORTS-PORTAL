/**
 * AIUB Sports Portal - Authenticated Fetch Utility
 * Wraps fetch() to automatically include JWT Authorization headers
 * and handle 401 responses by redirecting to login.
 */

/**
 * Fetch wrapper that attaches the JWT token from localStorage.
 * On 401 responses, clears auth state and redirects to login.
 *
 * @param {string} url - The URL to fetch
 * @param {object} [options={}] - Standard fetch options
 * @returns {Promise<Response|undefined>} The fetch response, or undefined on redirect
 */
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('studentId');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        window.location.href = 'login.html';
        return;
    }

    return response;
}
