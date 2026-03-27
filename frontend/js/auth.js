/**
 * AIUB Sports Portal - Authentication Module
 * Handles admin authentication and access control
 */

/**
 * Check if user is authenticated and has admin privileges
 * @returns {Promise<boolean>} - True if user is admin, false otherwise
 */
async function checkAdminAccess() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        alert('Access denied. Please log in first.');
        window.location.href = 'login.html';
        return false;
    }

    try {
        const response = await authFetch(`${API_URL}/admin/check-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: userEmail })
        });

        if (!response) return false; // authFetch redirected to login

        const result = await response.json();

        console.log('Admin check result:', result);

        if (!result.success || !result.isAdmin) {
            console.log('Admin access denied. Result:', result);
            alert('Access denied. Admin privileges required.');
            window.location.href = 'dashboard.html';
            return false;
        }

        // Update welcome message based on admin status and role
        if (result.admin && result.admin.full_name) {
            const roleName = result.role || 'Admin';
            const rolesList = result.roles ? `(${result.roles.join(', ')})` : '';
            const welcomeName = document.getElementById('welcomeName');
            const welcomeText = document.getElementById('welcomeText');

            if (welcomeName) {
                welcomeName.textContent = `Welcome, ${result.admin.full_name} ${rolesList}`;
            }
            if (welcomeText) {
                welcomeText.textContent = `Welcome, ${result.admin.full_name} ${rolesList}`;
            }
        } else {
            const welcomeName = document.getElementById('welcomeName');
            const welcomeText = document.getElementById('welcomeText');

            if (welcomeName) welcomeName.textContent = 'Admin Dashboard';
            if (welcomeText) welcomeText.textContent = 'Welcome Admin';
        }

        return true;
    } catch (error) {
        console.error('Admin check error:', error);
        alert('Error verifying admin status. Please try again.');
        window.location.href = 'login.html';
        return false;
    }
}

/**
 * Check user authentication on page load
 * Redirects to login if not authenticated
 */
function checkAuthentication() {
    if (localStorage.getItem('isAuthenticated') !== 'true') {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}
