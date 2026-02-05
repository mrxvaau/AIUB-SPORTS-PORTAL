/**
 * AIUB Sports Portal - Utility Functions
 * Shared utility functions used across the application
 */

/**
 * Show an alert message to the user
 * @param {string} message - The message to display
 * @param {string} type - Alert type: 'success' or 'error'
 */
function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;

    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.classList.remove('hidden');

    setTimeout(() => {
        alertBox.classList.add('hidden');
    }, 5000);
}

/**
 * Logout the user and redirect to login page
 */
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

/**
 * Build API URL using the configuration
 * @param {string} endpoint - The API endpoint
 * @returns {string} - Full API URL
 */
function buildApiUrl(endpoint) {
    if (typeof API_CONFIG !== 'undefined' && API_CONFIG.API_BASE_URL) {
        return API_CONFIG.API_BASE_URL + endpoint;
    }
    return API_URL + endpoint;
}

/**
 * Get the current API URL from configuration
 * @returns {string} - The API base URL
 */
function getApiUrl() {
    if (typeof API_CONFIG !== 'undefined' && API_CONFIG.API_BASE_URL) {
        return API_CONFIG.API_BASE_URL;
    }
    return 'http://localhost:3000/api';
}
