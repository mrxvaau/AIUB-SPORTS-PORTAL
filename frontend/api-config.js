// API Configuration
// This file contains the API endpoints for the AIUB Sports Portal
// Version 2.0 — Domain-grouped route structure

// Default base URL
// Check for tunnel configuration (loaded from js/tunnel-config.js)
let apiBaseUrl = 'http://localhost:3000/api';

// If we are on a tunnel hostname (loca.lt) AND we have a backend URL configured
if (typeof window !== 'undefined' && window.location.hostname.includes('loca.lt')) {
    if (typeof TUNNEL_CONFIG !== 'undefined' && TUNNEL_CONFIG.backendUrl) {
        apiBaseUrl = TUNNEL_CONFIG.backendUrl + '/api';
        console.log('[API Config] Using Tunnel Backend:', apiBaseUrl);
    } else {
        console.warn('[API Config] Running on tunnel but no backend URL found in TUNNEL_CONFIG');
    }
}

const API_CONFIG = {
    // Base URL for the API
    API_BASE_URL: apiBaseUrl,

    // Specific endpoints
    ENDPOINTS: {
        // Auth (login stays on /auth)
        AUTH_LOGIN: '/auth/login',
        MS_AUTH_LOGIN: '/msauth/login',
        MS_AUTH_CALLBACK: '/msauth/callback',

        // User profile & notifications
        USER_PROFILE: (studentId) => `/user/profile/${studentId}`,
        UPDATE_PROFILE: (studentId) => `/user/profile/${studentId}`,
        PROFILE_SETUP: '/user/profile-setup',
        NAME_EDIT_COUNT: (studentId) => `/user/name-edit-count/${studentId}`,
        NOTIFICATIONS: (studentId) => `/user/notifications/${studentId}`,
        MARK_NOTIFICATION_READ: (notificationId) => `/user/notifications/${notificationId}/read`,
        PENDING_INVITATIONS: (studentId) => `/user/pending-invitations/${studentId}`,

        // Tournaments
        TOURNAMENTS: '/tournaments',
        TOURNAMENT_GAMES: (id) => `/tournaments/${id}/games`,
        REQUEST_GAME: '/tournaments/request-game',
        REQUEST_TOURNAMENT: '/tournaments/request',
        GET_USER_GAME_REQUESTS: (studentId) => `/tournaments/game-requests/${studentId}`,
        GET_USER_TOURNAMENT_REQUESTS: (studentId) => `/tournaments/requests/${studentId}`,

        // Registration
        REGISTER_GAME: '/registration/register',
        USER_REGISTRATIONS: (studentId) => `/registration/my/${studentId}`,
        CANCEL_REGISTRATION: (gameId, studentId) => `/registration/${gameId}/${studentId}`,

        // Teams
        CREATE_TEAM: '/teams/create',
        TEAM_DETAILS: (teamId) => `/teams/${teamId}`,
        ADD_TEAM_MEMBER: (teamId) => `/teams/${teamId}/members`,
        VALIDATE_MEMBER: '/teams/validate-member',
        REMOVE_TEAM_MEMBER: (teamId, memberId) => `/teams/${teamId}/members/${memberId}`,
        REPLACE_MEMBER: (teamId, memberId) => `/teams/${teamId}/members/${memberId}/replace`,
        ACCEPT_INVITATION: '/teams/invitations/accept',
        REJECT_INVITATION: '/teams/invitations/reject',
        CONFIRM_TEAM: (teamId) => `/teams/${teamId}/confirm`,
        TEAM_BY_GAME: (gameId, studentId) => `/teams/by-game/${gameId}/${studentId}`,

        // Cart
        CART_ADD: '/cart/add',
        CART_GET: (studentId) => `/cart/${studentId}`,
        CART_REMOVE: (cartItemId) => `/cart/${cartItemId}`,
        CART_CLEAR: (studentId) => `/cart/clear/${studentId}`,
        CART_CHECKOUT: '/cart/checkout',
        CART_REMOVE_BY_GAME: (gameId, studentId) => `/cart/game/${gameId}/${studentId}`,

        // Admin endpoints (unchanged)
        CHECK_ADMIN: '/admin/check-admin',
        PROMOTE_USER: '/admin/promote-user',
        ASSIGN_ROLE: '/admin/assign-role',
        REMOVE_ROLE: (adminId, roleId) => `/admin/remove-role/${adminId}/${roleId}`,
        DEMOTE_MODERATOR: (userId) => `/admin/demote-moderator/${userId}`,
        MODERATORS: '/admin/moderators',
        ROLES: '/admin/roles',
        PERMISSIONS: '/admin/permissions',
        ASSIGN_PERMISSION: '/admin/assign-permission',
        AUDIT_LOGS: '/admin/audit-logs',
        TOURNAMENT_REQUESTS: '/admin/tournament-requests',
        GAME_REQUESTS: '/admin/game-requests',
        CREATE_TOURNAMENT: '/admin/tournaments',
        GET_TOURNAMENTS: '/admin/tournaments',
        GET_TOURNAMENT_GAMES: (id) => `/admin/tournaments/${id}/games`,
        UPDATE_TOURNAMENT: (id) => `/admin/tournaments/${id}`,
        DELETE_TOURNAMENT: (id) => `/admin/tournaments/${id}`,

        // Dashboard endpoints (unchanged)
        DASHBOARD_PROFILE: (studentId) => `/dashboard/profile/${studentId}`,
        DASHBOARD_TOURNAMENTS: (studentId) => `/dashboard/tournaments/${studentId}`,
        DASHBOARD_REGISTRATIONS: (studentId) => `/dashboard/registrations/${studentId}`,
        DASHBOARD_OVERVIEW: (studentId) => `/dashboard/overview/${studentId}`,

        // Health check
        HEALTH: '/health'
    }
};

// Function to build API URL
function buildApiUrl(endpoint) {
    return API_CONFIG.API_BASE_URL + endpoint;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_CONFIG, buildApiUrl };
} else {
    window.API_CONFIG = API_CONFIG;
    window.buildApiUrl = buildApiUrl;
}
