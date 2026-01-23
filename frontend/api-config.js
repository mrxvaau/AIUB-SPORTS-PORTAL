// API Configuration
// This file contains the API endpoints for the AIUB Sports Portal
// To switch environments, update the API_BASE_URL

const API_CONFIG = {
    // Base URL for the API - change this to match your backend server
    API_BASE_URL: 'http://localhost:3000/api', // Default for development
    
    // Specific endpoints
    ENDPOINTS: {
        AUTH_LOGIN: '/auth/login',
        MS_AUTH_LOGIN: '/msauth/login',
        MS_AUTH_CALLBACK: '/msauth/callback',
        USER_PROFILE: (studentId) => `/auth/profile/${studentId}`,
        UPDATE_PROFILE: (studentId) => `/auth/profile/${studentId}`,
        NAME_EDIT_COUNT: (studentId) => `/auth/name-edit-count/${studentId}`,
        TOURNAMENTS: '/auth/tournaments',
        TOURNAMENT_GAMES: (id) => `/auth/tournaments/${id}/games`,
        REGISTER_GAME: '/auth/register',
        USER_REGISTRATIONS: (studentId) => `/auth/registrations/${studentId}`,
        CREATE_TEAM: '/auth/create-team',
        TEAM_DETAILS: (teamId) => `/auth/team/${teamId}`,
        ADD_TEAM_MEMBER: (teamId) => `/auth/team/${teamId}/add-member`,
        ACCEPT_INVITATION: '/auth/accept-invitation',
        CONFIRM_TEAM: (teamId) => `/auth/confirm-team/${teamId}`,
        NOTIFICATIONS: (studentId) => `/auth/notifications/${studentId}`,
        MARK_NOTIFICATION_READ: (notificationId) => `/auth/notifications/${notificationId}/read`,
        PENDING_INVITATIONS: (studentId) => `/auth/pending-invitations/${studentId}`,
        CART_ADD: '/auth/cart/add',
        CART_GET: (studentId) => `/auth/cart/${studentId}`,
        CART_REMOVE: (cartItemId) => `/auth/cart/${cartItemId}`,
        CART_CLEAR: (studentId) => `/auth/cart/clear/${studentId}`,
        CANCEL_REGISTRATION: (gameId, studentId) => `/auth/registration/${gameId}/${studentId}`,
        
        // Admin endpoints
        CHECK_ADMIN: '/admin/check-admin',
        PROMOTE_USER: '/admin/promote-user',
        DEMOTE_MODERATOR: (userId) => `/admin/demote-moderator/${userId}`,
        MODERATORS: '/admin/moderators',
        CREATE_TOURNAMENT: '/admin/tournaments',
        GET_TOURNAMENTS: '/admin/tournaments',
        GET_TOURNAMENT_GAMES: (id) => `/admin/tournaments/${id}/games`,
        UPDATE_TOURNAMENT: (id) => `/admin/tournaments/${id}`,
        DELETE_TOURNAMENT: (id) => `/admin/tournaments/${id}`,
        
        // Dashboard endpoints
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