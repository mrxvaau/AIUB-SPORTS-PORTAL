/**
 * app.js  — Dashboard bootstrap / navigation / DOMContentLoaded init
 * This is the ONLY inline script equivalent. Glues all components together.
 * Depends on: all component files above, API_URL, authFetch
 */

// ── API URL ──────────────────────────────────────────────────
// Resolved from api-config.js (global API_CONFIG) or fallback
var API_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.API_BASE_URL)
    ? API_CONFIG.API_BASE_URL
    : (window.API_URL || '/api');

// ── Navigation ───────────────────────────────────────────────
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(function(s) {
        s.style.display = 'none';
    });
    var sel = document.getElementById(sectionId);
    if (sel) sel.style.display = 'block';

    // Lazy-load section content
    if      (sectionId === 'registrationSection')  loadRegistrationView();
    else if (sectionId === 'paymentSection')        loadPaymentView();
    else if (sectionId === 'notificationSection')   loadNotificationsView();
    else if (sectionId === 'leaderboardSection')    loadLeaderboardView();
    else if (sectionId === 'messageSection')        { loadMyMessages(); }
    else if (sectionId === 'reportSection')         { loadMyBugReports(); }
}

// ── Shared helpers ───────────────────────────────────────────


function goToAdmin() { window.location.href = 'admin-dashboard.html'; }

// ── Theme persistence ────────────────────────────────────────
(function applyStoredTheme() {
    var stored = null;
    try { stored = localStorage.getItem('dashboardTheme'); } catch(e){}
    if (stored) document.documentElement.setAttribute('data-theme', stored);
})();

// ── DOMContentLoaded bootstrap ───────────────────────────────
document.addEventListener('partials:loaded', function () {
    // Wait for partials to inject before touching injected IDs
    _bootstrap();
});

// Fallback: if partials already loaded or partials:loaded never fires (e.g. partials disabled)
window.addEventListener('DOMContentLoaded', function () {
    // Short delay allows load-partials.js to finish its synchronous work
    setTimeout(_bootstrap, 200);
});

var _bootstrapped = false;
function _bootstrap() {
    if (_bootstrapped) return;
    _bootstrapped = true;

    // Auth guard
    var isAuthenticated = false;
    var comingFromLogin = false;
    try { isAuthenticated = localStorage.getItem('isAuthenticated') === 'true'; } catch(e){}
    try {
        comingFromLogin = sessionStorage.getItem('redirectingToDashboard') === 'true';
        sessionStorage.removeItem('redirectingToDashboard');
    } catch(e){}

    if (!isAuthenticated && !comingFromLogin) {
        window.location.href = 'login.html';
        return;
    }

    // Load all initial data
    loadProfile();
    loadAvailableTournaments();
    loadUserRegistrationStatus();
    loadUserSchedule();

    // Welcome screen on first login
    var justCompleted = false;
    try { justCompleted = sessionStorage.getItem('profileJustCompleted'); } catch(e){}
    if (justCompleted) {
        try { sessionStorage.removeItem('profileJustCompleted'); } catch(e){}
        var userName = 'Player';
        try { userName = localStorage.getItem('userName') || 'Player'; } catch(e){}
        var ws = document.getElementById('welcomeName');
        var wScreen = document.getElementById('welcomeScreen');
        if (ws) ws.textContent = userName;
        if (wScreen) {
            wScreen.style.display = 'flex';
            setTimeout(function(){ wScreen.style.display = 'none'; }, 3000);
        }
    }
}
