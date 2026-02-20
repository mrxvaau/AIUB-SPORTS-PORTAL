/**
 * Admin Dashboard Router
 * Handles client-side routing for the admin dashboard
 * Uses Hash Routing (#/path) to ensure compatibility with static servers and direct link access.
 */

const ADMIN_ROUTES = {
    '/': 'existing-tournaments',
    '/tournaments': 'existing-tournaments',
    '/tournaments/create': 'create-tournament',
    '/registrations': 'registration-management-placeholder',
    '/users': 'user-management-placeholder',
    '/database': 'database-placeholder',
    '/database/maintenance': 'database-maintenance-placeholder',
    '/database/tournament-data': 'tournament-data-management-placeholder',
    '/content': 'content-management-placeholder',
    '/reports': 'analytics-reporting-placeholder',
    '/settings': 'system-configuration-placeholder',
    '/messages': 'messages-placeholder',
    '/bugs': 'bug-report-placeholder',
    '/moderators': 'admin-management-placeholder'
};

/**
 * Initialize the router
 */
function initRouter() {


    // Handle hash changes (back/forward/manual url change)
    window.addEventListener('hashchange', handleRoute);

    // Handle initial load
    window.addEventListener('load', handleRoute);

    // Also call immediately in case load already fired
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        handleRoute();
    }
}

/**
 * Navigate to a specific path
 * @param {string} path - The path to navigate to (e.g., '/users')
 */
function navigateTo(path) {

    window.location.hash = path;
}

/**
 * Handle routing based on current URL Hash
 */
function handleRoute() {
    // Get the hash path, removing the '#'
    // If empty, default to '/'
    let path = window.location.hash.slice(1) || '/';



    // Handle root hash case (empty hash)
    if (path === '') path = '/';

    // Find the matching route
    let sectionId = ADMIN_ROUTES[path];


    // Default to tournaments if route not found
    if (!sectionId) {
        // Check if it's a sub-route of registrations which handles its own routing
        if (path.startsWith('/registrations')) {
            sectionId = ADMIN_ROUTES['/registrations'];
        } else {
            // Check for potential sub-paths matching generic parents
            sectionId = ADMIN_ROUTES['/'];
        }

    }

    // Update the UI
    if (typeof showSection === 'function') {
        if (sectionId) {
            showSection(sectionId);
        } else {
            console.warn('No section ID found for path:', path);
        }
    } else {
        console.error('showSection function not found. Is admin-dashboard.html loaded?');
    }

    // Update active state in sidebar
    updateSidebaractive(path);
}

/**
 * Update the active state in the sidebar
 * @param {string} currentPath 
 */
function updateSidebaractive(currentPath) {
    // Remove active class from all sidebar buttons
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Find button that navigates to this path
    // We look for onclick="navigateTo('currentPath')"

    // Exact match approach
    // Note: escape quotes in selector just in case
    let activeBtn = document.querySelector(`.sidebar-btn[onclick="navigateTo('${currentPath}')"]`);

    if (activeBtn) {
        activeBtn.classList.add('active');
        // If it's in a submenu, ensure submenu is open
        const parentSubmenu = activeBtn.closest('.submenu');
        if (parentSubmenu) {
            parentSubmenu.classList.add('expanded');
            // Rotate icon of the parent button controller if possible
            if (parentSubmenu.id === 'databaseSubmenu') {
                const icon = document.getElementById('databaseMenuIcon');
                if (icon) icon.style.transform = 'rotate(0deg)';
            }
        }
    }
}

// Export functions for global usage
window.initRouter = initRouter;
window.navigateTo = navigateTo;
