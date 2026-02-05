/**
 * AIUB Sports Portal - Admin Dashboard Main Module
 * Handles initialization, section switching, and core UI functionality
 */

// Current active section
let currentSection = 'existing-tournaments';

// API URL from configuration
const API_URL = typeof API_CONFIG !== 'undefined' && API_CONFIG.API_BASE_URL
    ? API_CONFIG.API_BASE_URL
    : 'http://localhost:3000/api';

/**
 * Initialize the admin dashboard
 */
async function initAdminDashboard() {
    const isAdmin = await checkAdminAccess();
    if (!isAdmin) {
        return; // User will be redirected by the checkAdminAccess function
    }

    // Load the default section
    showSection('existing-tournaments');
}

/**
 * Show a specific section in the dashboard
 * @param {string} sectionId - The ID of the section to show
 */
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show the requested section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    currentSection = sectionId;

    // Load content based on section
    if (sectionId === 'existing-tournaments') {
        loadTournaments();
    } else if (sectionId === 'create-tournament') {
        loadCreateTournamentForm();
    }
}

/**
 * Show placeholder section for features under development
 * @param {string} name - Name of the placeholder to show
 */
function showPlaceholder(name) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Map placeholder names to section IDs
    const placeholderMap = {
        'Messages': 'messages-placeholder',
        'Bug Report': 'bug-report-placeholder',
        'Database': 'database-placeholder',
        'User Management': 'user-management-placeholder',
        'Tournament Data Management': 'tournament-data-management-placeholder',
        'Registration Management': 'registration-management-placeholder',
        'Database Maintenance': 'database-maintenance-placeholder',
        'Content Management': 'content-management-placeholder',
        'Analytics & Reporting': 'analytics-reporting-placeholder',
        'System Configuration': 'system-configuration-placeholder',
        'Moderator Management': 'admin-management-placeholder'
    };

    const sectionId = placeholderMap[name];
    if (sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('active');
        }
    }

    // Load admin management interface if applicable
    if (name === 'Moderator Management') {
        loadAdminManagement();
    }
}

/**
 * Toggle Database submenu visibility
 */
function toggleDatabaseSubmenu() {
    const submenu = document.getElementById('databaseSubmenu');
    const icon = document.getElementById('databaseMenuIcon');
    const isExpanded = submenu.classList.contains('expanded');

    // Close all other submenus first
    document.querySelectorAll('.submenu').forEach(menu => {
        if (menu !== submenu) {
            menu.classList.remove('expanded');
        }
    });

    // Toggle this submenu
    if (isExpanded) {
        submenu.classList.remove('expanded');
    } else {
        submenu.classList.add('expanded');
    }

    // Rotate the icon
    if (icon) {
        icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initAdminDashboard);

// Check authentication on page load
window.addEventListener('DOMContentLoaded', () => {
    if (!checkAuthentication()) {
        return;
    }
    // Load the existing tournaments by default
    loadTournaments();
});
