/**
 * registration.js
 * ---------------
 * Full tournament registration logic — runs INSIDE the dashboard.
 * Entry point: loadRegistrationView()  (called by showSection in app.js)
 * Depends on: API_URL, authFetch  (from app.js / api-config.js)
 */

// ── State ─────────────────────────────────────────────────────
var gameDataMap      = new Map();
var currentGameId    = null;
var currentGameName  = null;
var currentCategory  = null;
var currentTeamSize  = 2;
var currentTeamId    = null;
var isEditMode       = false;
var replaceModalData = { teamId: null, memberId: null, currentMemberName: null, currentMemberStudentId: null };

// ── Registration status (home section widget) ─────────────────
async function loadAvailableTournaments() {
    try {
        var studentId   = localStorage.getItem('studentId');
        var res         = await authFetch(API_URL + '/dashboard/tournaments/' + studentId);
        var data        = await res.json();
        var registerBtn = document.getElementById('registerBtn');
        var messageDiv  = document.getElementById('registrationMessage');

        if (data.success && data.tournaments && data.tournaments.length > 0) {
            registerBtn.disabled    = false;
            registerBtn.textContent = 'Go to Registration';
            registerBtn.className   = 'active-registration-btn';
            messageDiv.innerHTML    = '<p>Registration is now open! Click the button to register for tournaments.</p>';
        } else {
            registerBtn.disabled    = true;
            registerBtn.textContent = 'Registration Closed';
            registerBtn.className   = 'disabled-btn';
            messageDiv.innerHTML    = '<p>No tournaments available for registration at the moment.</p>';
        }
    } catch (err) {
        console.error('Load tournaments error:', err);
        var rb = document.getElementById('registerBtn');
        if (rb) { rb.disabled = true; rb.className = 'disabled-btn'; }
        var md = document.getElementById('registrationMessage');
        if (md) md.innerHTML = '<p>Error loading tournament information. Please try again later.</p>';
    }
}

async function loadUserRegistrationStatus() {
    try {
        var studentId   = localStorage.getItem('studentId');
        var res         = await authFetch(API_URL + '/dashboard/registrations/' + studentId);
        var data        = await res.json();
        var registerBtn = document.getElementById('registerBtn');
        var messageDiv  = document.getElementById('registrationMessage');

        if (data.success && data.registrations) {
            if (data.registrations.length > 0) {
                var n = data.registrations.length;
                registerBtn.disabled    = false;
                registerBtn.textContent = 'View Registration (' + n + ')';
                registerBtn.className   = 'active-registration-btn';
                messageDiv.innerHTML    = '<p>You have registered for ' + n + ' game' + (n > 1 ? 's' : '') + '. Click to manage your registrations.</p>';
            } else {
                await loadAvailableTournaments();
            }
        }
    } catch (err) {
        console.error('Error loading registration status:', err);
    }
}

// Home widget button — go into registration section
function goToRegistration() { window.location.href = 'registration.html?v=' + Date.now(); }

// ── Main Registration View ────────────────────────────────────
async function loadRegistrationView() {
    var container = document.getElementById('registrationContent');
    if (!container) return;

    // Reset gameDataMap for fresh load
    gameDataMap.clear();

    container.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;padding:60px;">' +
        '<div class="spinner" style="width:40px;height:40px;border-width:4px;margin-bottom:18px;"></div>' +
        '<p style="color:var(--text-2,#94a3b8);">Loading tournaments...</p></div>';

    try {
        var res  = await authFetch(API_URL + '/tournaments');
        var data = await res.json();

        if (!data.success || !data.tournaments || data.tournaments.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-2,#9ca3af);"><p>No active tournaments at the moment.</p></div>';
            return;
        }

        var studentId         = localStorage.getItem('studentId');
        var userRegistrations = [];

        try {
            var regRes  = await authFetch(API_URL + '/registration/my/' + studentId);
            var regData = await regRes.json();
            if (regData.success && regData.registrations) {
                userRegistrations = regData.registrations;
            }
        } catch (e) { console.error('Error fetching registrations:', e); }

        // Build each tournament card one-by-one (shows progress)
        var html = '';
        container.innerHTML = '';

        for (var i = 0; i < data.tournaments.length; i++) {
            var tournament = data.tournaments[i];

            // Placeholder while loading games
            var placeholder = document.createElement('div');
            placeholder.className = 'reg-tournament-card';
            placeholder.style.cssText = 'background:var(--bg-surface-2,#1e293b);border:1px solid var(--glass-border,rgba(148,163,184,.15));border-radius:14px;padding:24px;margin-bottom:20px;text-align:center;';
            placeholder.innerHTML = '<div class="spinner" style="width:28px;height:28px;border-width:3px;margin:0 auto 12px;"></div><p style="color:var(--text-2,#94a3b8);font-size:14px;">Loading ' + tournament.title + '...</p>';
            container.appendChild(placeholder);

            try {
                var gamesRes  = await authFetch(API_URL + '/tournaments/' + tournament.id + '/games');
                var gamesData = await gamesRes.json();
                placeholder.outerHTML = gamesData.success
                    ? buildTournamentCard(tournament, gamesData.games, userRegistrations)
                    : buildErrorCard(tournament.title);
            } catch (e) {
                placeholder.outerHTML = buildErrorCard(tournament.title);
            }
        }

        // Re-query all new cards and run status updates
        document.querySelectorAll('.reg-tournament-card[data-tid]').forEach(function(card) {
            var tid = parseInt(card.getAttribute('data-tid'));
            var t   = data.tournaments.find(function(x){ return x.id === tid; });
            // status badges already built inline, no extra pass needed
        });

    } catch (err) {
        console.error('Error loading registration view:', err);
        container.innerHTML = '<div style="text-align:center;padding:60px;color:#ef4444;"><p>Error loading tournaments. Please try again.</p></div>';
    }
}

function buildErrorCard(title) {
    return '<div class="reg-tournament-card" style="background:var(--bg-surface-2,#1e293b);border:1px solid var(--glass-border,rgba(148,163,184,.15));border-radius:14px;padding:24px;margin-bottom:20px;">' +
        '<p style="color:#ef4444;">❌ Failed to load games for <strong>' + title + '</strong>. Please refresh.</p></div>';
}

// ── Build Tournament Card HTML ────────────────────────────────
function buildTournamentCard(tournament, games, userRegistrations) {
    // Populate gameDataMap
    games.forEach(function(game) {
        var info = { name: game.game_name, category: game.category, type: game.game_type, fee: game.fee_per_person, fee_per_person: game.fee_per_person, team_size: game.team_size || 1 };
        gameDataMap.set(game.id, info);
        gameDataMap.set(String(game.id), info);
    });

    // Build registration lookup
    var regMap = new Map();
    (userRegistrations || []).forEach(function(reg) {
        var gid = reg.gameId || reg.game_id;
        regMap.set(gid, reg); regMap.set(String(gid), reg); regMap.set(Number(gid), reg);
    });

    var maleGames   = games.filter(function(g){ return g.category === 'Male'; });
    var femaleGames = games.filter(function(g){ return g.category === 'Female'; });
    var mixGames    = games.filter(function(g){ return g.category === 'Mix'; });

    // Image
    var photoUrl = tournament.photo_url || tournament.PHOTO_URL || '';
    var imageHtml = '';
    if (photoUrl && typeof photoUrl === 'string') {
        var imgSrc = photoUrl.startsWith('data:image') ? photoUrl
            : photoUrl.startsWith('/uploads/') ? (API_URL.replace('/api','') + photoUrl)
            : photoUrl;
        imageHtml = '<img src="' + imgSrc + '" alt="' + tournament.title + '" style="width:240px;height:170px;border-radius:10px;object-fit:contain;border:1px solid var(--glass-border,rgba(148,163,184,.15));background:var(--bg-surface-1,#0f172a);flex-shrink:0;" onerror="this.style.display=\'none\'">';
    }

    var safeTitle = (tournament.title || '').replace(/'/g, "\\'");

    var html = '<div class="reg-tournament-card" data-tid="' + tournament.id + '" style="background:var(--bg-surface-2,#1e293b);border:1px solid var(--glass-border,rgba(148,163,184,.15));border-radius:14px;margin-bottom:20px;overflow:hidden;">'
        + '<div style="display:flex;gap:24px;padding:22px;align-items:flex-start;">'
        + imageHtml
        + '<div style="flex:1;">'
        + '<h2 style="font-size:22px;font-weight:700;color:var(--accent,#3b82f6);margin-bottom:10px;">' + tournament.title + '</h2>'
        + '<p style="color:var(--text-2,#94a3b8);font-size:14px;margin-bottom:6px;">📅 Deadline: ' + new Date(tournament.registration_deadline).toLocaleDateString() + '</p>'
        + '<p style="color:var(--text-2,#94a3b8);font-size:14px;margin-bottom:6px;">📊 Status: ' + tournament.status + '</p>'
        + (tournament.description ? '<p style="color:var(--text-2,#94a3b8);font-size:13px;margin-top:6px;">' + tournament.description + '</p>' : '')
        + '</div></div>';

    // Category sections
    if (maleGames.length)   html += buildCategorySection('Male',   maleGames,   regMap);
    if (femaleGames.length) html += buildCategorySection('Female', femaleGames, regMap);
    if (mixGames.length)    html += buildCategorySection('Mix',    mixGames,    regMap);

    // Request Game button
    html += '<div style="padding:16px 22px 20px;border-top:1px solid var(--glass-border,rgba(148,163,184,.1));text-align:right;">'
        + '<button onclick="requestGameForTournament(' + tournament.id + ',\'' + safeTitle + '\')" '
        + 'style="padding:9px 18px;background:#f59e0b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:opacity 0.2s;" '
        + 'onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">🎮 Request New Game</button>'
        + '</div></div>';

    return html;
}

function buildCategorySection(category, games, regMap) {
    var icon = category === 'Male' ? '👨' : category === 'Female' ? '👩' : '🤝';
    var col  = category === 'Male' ? 'linear-gradient(135deg,#1e3a8a,#3b82f6)' : category === 'Female' ? 'linear-gradient(135deg,#7c3aed,#a78bfa)' : 'linear-gradient(135deg,#065f46,#10b981)';

    var html = '<div style="padding:0 22px 6px;">'
        + '<div style="background:' + col + ';color:white;padding:10px 16px;border-radius:8px;font-size:15px;font-weight:600;margin-bottom:12px;">' + icon + ' ' + category + ' Category</div>'
        + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">';

    games.forEach(function(game) {
        var reg = regMap.get(game.id) || regMap.get(String(game.id));
        var isTeam = (game.team_size || 1) > 1;
        var safeGameName = game.game_name.replace(/'/g, "\\'");
        var payStatus = reg ? (reg.paymentStatus || reg.payment_status) : null;

        // Status chip
        var statusHtml = '';
        if (reg) {
            var chipColor = payStatus === 'PAID' ? '#d1fae5;color:#065f46' : payStatus === 'PENDING' ? '#fef3c7;color:#d97706' : '#fecaca;color:#b91c1c';
            statusHtml = '<div style="margin-top:8px;padding:5px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + chipColor + ';">Status: ' + payStatus + '</div>';
        }

        // Action buttons
        var btnHtml = '';
        if (!reg) {
            btnHtml = '<button class="reg-action-btn" data-game-id="' + game.id + '" data-game-name="' + safeGameName + '" data-game-category="' + game.category + '" data-action="register" '
                + 'style="width:100%;padding:10px;background:var(--accent,#3b82f6);color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-top:10px;transition:opacity 0.2s;" '
                + 'onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">Register Now</button>';
        } else if (payStatus === 'PAID') {
            btnHtml = '<button disabled style="width:100%;padding:10px;background:#10b981;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:default;margin-top:10px;">✅ Confirmed</button>';
        } else {
            var editBtnHtml = isTeam ? '<button class="reg-edit-team-btn" data-game-id="' + game.id + '" data-game-name="' + safeGameName + '" data-game-category="' + game.category + '" '
                + 'onclick="editTeam(' + game.id + ',\'' + safeGameName + '\',\'' + game.category + '\')" '
                + 'style="flex:0 0 auto;padding:10px 12px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;" '
                + 'onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">✏️ Edit</button>' : '';
            btnHtml = '<div style="display:flex;gap:8px;margin-top:10px;">'
                + '<button class="reg-action-btn" data-game-id="' + game.id + '" data-game-name="' + safeGameName + '" data-game-category="' + game.category + '" data-action="cancel" '
                + 'style="flex:1;padding:10px;background:#ef4444;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.2s;" '
                + 'onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">Cancel</button>'
                + editBtnHtml
                + '</div>';
        }

        html += '<div style="background:var(--bg-surface-1,#0f172a);border:1px solid var(--glass-border,rgba(148,163,184,.15));border-radius:10px;padding:16px;transition:border-color 0.2s;" '
            + 'onmouseover="this.style.borderColor=\'var(--accent,#3b82f6)\'" onmouseout="this.style.borderColor=\'var(--glass-border,rgba(148,163,184,.15))\'">'
            + '<div style="font-size:16px;font-weight:700;color:var(--text-1,#f1f5f9);margin-bottom:6px;">' + game.game_name + '</div>'
            + '<div style="color:var(--text-2,#94a3b8);font-size:13px;margin-bottom:4px;">Type: ' + game.game_type + (isTeam ? ' (Team of ' + game.team_size + ')' : '') + '</div>'
            + '<div style="color:#10b981;font-weight:700;font-size:15px;">৳' + game.fee_per_person + ' per person</div>'
            + statusHtml
            + btnHtml
            + '</div>';
    });

    html += '</div></div><div style="height:16px;"></div>';
    return html;
}

// ── Event delegation for all registration action buttons ──────
document.addEventListener('click', function(e) {
    var btn = e.target.closest('.reg-action-btn');
    if (!btn) return;
    var gameId   = btn.getAttribute('data-game-id');
    var gameName = btn.getAttribute('data-game-name');
    var category = btn.getAttribute('data-game-category');
    var action   = btn.getAttribute('data-action');
    if (!gameId || !action) return;

    if (action === 'register') {
        var gd = gameDataMap.get(gameId) || gameDataMap.get(Number(gameId));
        var teamSize = gd ? (gd.team_size || 1) : 1;
        if (teamSize > 1) { openTeamModal(Number(gameId), gameName, category, teamSize); }
        else { registerForGame(gameId, gameName, category, btn); }
    } else if (action === 'cancel') {
        cancelRegistration(gameId, gameName, category, btn);
    }
});

// ── Confirm Modal ─────────────────────────────────────────────
function openConfirmModal(title, message, onConfirm) {
    var modal  = document.getElementById('confirmModal');
    var titleEl = document.getElementById('confirmModalTitle');
    var msgEl   = document.getElementById('confirmModalMessage');
    var confirmBtn = document.getElementById('confirmModalConfirmBtn');
    if (!modal) return;
    titleEl.textContent = title;
    msgEl.textContent   = message;
    confirmBtn.onclick  = onConfirm;
    modal.classList.add('active');
}

function closeConfirmModal() {
    var m = document.getElementById('confirmModal');
    if (m) m.classList.remove('active');
}

// ── Solo Register ─────────────────────────────────────────────
async function registerForGame(gameId, gameName, category, btn) {
    var studentId = localStorage.getItem('studentId');
    if (!studentId) { window.location.href = 'login.html'; return; }

    var gd  = gameDataMap.get(gameId) || gameDataMap.get(String(gameId)) || gameDataMap.get(Number(gameId));
    var fee = gd ? gd.fee_per_person : 0;

    openConfirmModal(
        'Confirm Registration',
        'Register for ' + gameName + ' (' + category + ')?\nFee: ৳' + fee,
        async function() {
            closeConfirmModal();
            if (btn) { var orig = btn.innerHTML; btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></div>Registering...'; btn.disabled = true; }

            try {
                var res    = await authFetch(API_URL + '/registration/register', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentId: studentId, gameId: gameId })
                });
                var result = await res.json();
                if (result.success) {
                    try {
                        await authFetch(API_URL + '/cart/add', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ studentId: studentId, item_type: 'GAME_REGISTRATION', item_id: result.registration.id, tournament_game_id: gameId })
                        });
                    } catch(e) { console.error('Cart error:', e); }
                    showDashboardToast('Registered for ' + gameName + '!', 'success');
                    loadRegistrationView();
                    loadUserRegistrationStatus();
                } else {
                    showDashboardToast(result.message || 'Registration failed', 'error');
                    if (btn) { btn.innerHTML = orig; btn.disabled = false; }
                }
            } catch (err) {
                console.error(err);
                showDashboardToast('Error registering. Please try again.', 'error');
                if (btn) { btn.innerHTML = orig; btn.disabled = false; }
            }
        }
    );
}

// ── Cancel Registration ───────────────────────────────────────
async function cancelRegistration(gameId, gameName, category, btn) {
    var studentId = localStorage.getItem('studentId');
    if (!studentId) { window.location.href = 'login.html'; return; }

    openConfirmModal(
        'Cancel Registration',
        'Cancel your registration for ' + gameName + '?\nThis action cannot be undone.',
        async function() {
            closeConfirmModal();
            if (btn) { var orig = btn.innerHTML; btn.innerHTML = 'Canceling...'; btn.disabled = true; }

            try {
                var res    = await authFetch(API_URL + '/registration/' + gameId + '/' + studentId, {
                    method: 'DELETE', headers: { 'Content-Type': 'application/json' }
                });
                var result = await res.json();
                if (result.success) {
                    try {
                        await authFetch(API_URL + '/cart/game/' + gameId + '/' + studentId, {
                            method: 'DELETE', headers: { 'Content-Type': 'application/json' }
                        });
                    } catch(e) { console.error('Cart remove error:', e); }
                    showDashboardToast('Registration for ' + gameName + ' canceled.', 'success');
                    loadRegistrationView();
                    loadUserRegistrationStatus();
                } else {
                    showDashboardToast(result.message || 'Cancellation failed', 'error');
                    if (btn) { btn.innerHTML = orig; btn.disabled = false; }
                }
            } catch (err) {
                console.error(err);
                showDashboardToast('Error canceling. Please try again.', 'error');
                if (btn) { btn.innerHTML = orig; btn.disabled = false; }
            }
        }
    );
}

// ── Toast (uses dashboard's existing toast or fallback) ───────
function showDashboardToast(message, type) {
    // Use dashboard premium toast if available, else native toast container
    if (typeof showToastNotification === 'function') {
        showToastNotification(message, type);
        return;
    }
    var container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;';
        document.body.appendChild(container);
    }
    var icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    var colors = { success: 'linear-gradient(135deg,#10b981,#059669)', error: 'linear-gradient(135deg,#ef4444,#dc2626)', info: 'linear-gradient(135deg,#3b82f6,#2563eb)', warning: 'linear-gradient(135deg,#f59e0b,#d97706)' };
    var toast = document.createElement('div');
    toast.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.3);background:' + (colors[type] || colors.info) + ';color:white;animation:slideIn 0.35s ease-out;cursor:pointer;min-width:280px;';
    toast.innerHTML = '<span style="font-size:20px;">' + (icons[type] || '✅') + '</span><span style="flex:1;font-size:13px;">' + message + '</span>';
    container.appendChild(toast);
    toast.addEventListener('click', function(){ toast.remove(); });
    setTimeout(function(){ if(toast.parentElement) toast.remove(); }, 4000);
}

// ── Team Modal ─────────────────────────────────────────────────
function openTeamModal(gameId, gameName, category, teamSize) {
    teamSize = teamSize || 2;
    isEditMode      = false;
    currentTeamId   = null;
    currentGameId   = gameId;
    currentGameName = gameName;
    currentCategory = category;
    currentTeamSize = teamSize;

    var nameInput = document.getElementById('teamName');
    var nameError = document.getElementById('teamNameError');
    if (!nameInput) return;
    nameInput.disabled      = false;
    nameInput.value         = '';
    nameInput.style.cssText = '';
    if (nameError) nameError.style.display = 'none';

    document.getElementById('modalGameName').textContent = gameName;

    var gd = gameDataMap.get(gameId) || gameDataMap.get(String(gameId));
    var feePerPerson = gd ? gd.fee_per_person : 0;
    var subtitle = document.querySelector('.team-modal-subtitle');
    if (subtitle) { subtitle.textContent = category + ' Category | Team of ' + teamSize + ' | ৳' + feePerPerson + ' × ' + teamSize + ' = ৳' + (feePerPerson * teamSize); }

    var slotsHtml = '<div style="display:flex;gap:10px;padding:10px;background:#dbeafe;border-radius:6px;margin-bottom:10px;border:1px solid #3b82f6;">'
        + '<div style="font-weight:600;color:#3b82f6;min-width:70px;">👑 Leader</div>'
        + '<div style="flex:1;"><div style="font-weight:500;">' + (localStorage.getItem('studentId') || '') + '</div>'
        + '<div style="font-size:12px;opacity:0.7;">' + (localStorage.getItem('userName') || 'You') + '</div></div>'
        + '<div style="color:#065f46;font-size:12px;font-weight:600;">✅ Confirmed</div></div>';

    for (var i = 1; i < teamSize; i++) {
        slotsHtml += '<div style="display:flex;gap:10px;padding:10px;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:10px;align-items:center;">'
            + '<div style="font-weight:600;color:#3b82f6;min-width:70px;">👤 Member ' + (i + 1) + '</div>'
            + '<div style="flex:1;"><input type="text" class="team-form-input member-id-input" placeholder="Student ID (XX-XXXXX-X)" data-slot="' + i + '" style="width:100%;"></div>'
            + '<div style="color:#d97706;font-size:12px;">⏳ Pending</div></div>';
    }

    document.getElementById('teamMembersList').innerHTML = slotsHtml;

    var reqMsg = document.querySelector('.team-required-msg');
    if (reqMsg) reqMsg.textContent = '⚠️ All ' + teamSize + ' members must confirm before registration is finalized.';

    var modalBtns = document.querySelector('.team-modal-buttons');
    if (modalBtns) modalBtns.innerHTML =
        '<button class="btn-cancel" onclick="closeTeamModal()">Cancel</button>' +
        '<button class="btn-confirm" onclick="createTeam()">Create Team &amp; Register</button>';

    document.getElementById('teamModal').style.display = 'flex';
}

function closeTeamModal() { document.getElementById('teamModal').style.display = 'none'; }

// ── Team Modal — Edit ─────────────────────────────────────────
async function editTeam(gameId, gameName, category) {
    var studentId = localStorage.getItem('studentId');
    if (!studentId) { alert('Please log in first!'); return; }

    try {
        var res  = await authFetch(API_URL + '/teams/by-game/' + gameId + '/' + studentId);
        var data = await res.json();
        if (!data.success) { alert(data.message || 'No team found for this game.'); return; }

        var team     = data.team;
        var gd       = gameDataMap.get(gameId) || gameDataMap.get(String(gameId));
        var teamSize = (team.game && team.game.teamSize) || (gd && gd.team_size) || 2;

        isEditMode      = true;
        currentTeamId   = team.id;
        currentGameId   = gameId;
        currentGameName = gameName;
        currentCategory = category;
        currentTeamSize = teamSize;

        document.getElementById('modalGameName').textContent = gameName + ' (Edit Team)';
        document.getElementById('teamName').value    = team.team_name;
        document.getElementById('teamName').disabled = true;

        var subtitle = document.querySelector('.team-modal-subtitle');
        if (subtitle) subtitle.textContent = category + ' Category | Editing Team Members';

        var slotsHtml = '';
        (team.members || []).forEach(function(member, index) {
            var isLeader    = member.role === 'LEADER';
            var statusClass = member.status === 'CONFIRMED' ? 'color:#065f46' : 'color:#d97706';
            var statusIcon  = member.status === 'CONFIRMED' ? '✅' : member.status === 'REJECTED' ? '❌' : '⏳';
            var memberName  = (member.user && member.user.name) || 'Awaiting';
            var memberSid   = (member.user && member.user.student_id) || 'Pending...';
            var safeName    = memberName.replace(/'/g, "\\'");

            slotsHtml += '<div style="display:flex;gap:10px;padding:10px;border:1px solid ' + (isLeader ? '#3b82f6' : '#e5e7eb') + ';border-radius:6px;margin-bottom:10px;background:' + (isLeader ? '#dbeafe' : '#f9fafb') + ';align-items:center;">'
                + '<div style="font-weight:600;color:#3b82f6;min-width:80px;">' + (isLeader ? '👑 Leader' : '👤 Member ' + (index + 1)) + '</div>'
                + '<div style="flex:1;"><div style="font-weight:500;">' + memberSid + '</div><div style="font-size:12px;opacity:0.7;">' + memberName + '</div></div>'
                + '<div style="' + statusClass + ';font-size:12px;font-weight:600;">' + statusIcon + ' ' + member.status + '</div>'
                + (!isLeader ? '<button onclick="replaceMember(' + team.id + ',' + member.id + ',\'' + safeName + '\',\'' + memberSid + '\')" style="padding:5px 10px;background:#f59e0b;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;margin-left:8px;">🔄</button>' : '')
                + '</div>';
        });

        document.getElementById('teamMembersList').innerHTML = slotsHtml;

        var confirmed = (team.members || []).filter(function(m){ return m.status === 'CONFIRMED'; }).length;
        var pending   = (team.members || []).filter(function(m){ return m.status === 'PENDING'; }).length;
        var reqMsg = document.querySelector('.team-required-msg');
        if (reqMsg) reqMsg.innerHTML = '📊 ' + confirmed + '/' + teamSize + ' confirmed | ' + pending + ' pending<br><small>Click 🔄 to swap a member.</small>';

        var modalBtns = document.querySelector('.team-modal-buttons');
        if (modalBtns) modalBtns.innerHTML = '<button class="btn-cancel" onclick="closeTeamModal()">Close</button>';

        document.getElementById('teamModal').style.display = 'flex';
    } catch (err) {
        console.error('Error loading team:', err);
        alert('Error loading team data. Please try again.');
    }
}

// ── Create Team ───────────────────────────────────────────────
async function createTeam() {
    var nameInput = document.getElementById('teamName');
    var teamName  = nameInput.value.trim();
    var studentId = localStorage.getItem('studentId');
    var nameError = document.getElementById('teamNameError');

    nameInput.style.cssText = '';
    if (nameError) nameError.style.display = 'none';

    if (!teamName) {
        nameInput.style.borderColor = '#ef4444';
        nameInput.style.background  = 'rgba(239,68,68,0.08)';
        if (nameError) nameError.style.display = 'block';
        nameInput.focus();
        return;
    }

    var memberInputs = document.querySelectorAll('#teamMembersList .member-id-input');
    var memberIds    = [studentId];
    memberInputs.forEach(function(inp) { var v = inp.value.trim(); if (v) memberIds.push(v); });

    var seen = new Set();
    for (var j = 0; j < memberIds.length; j++) {
        if (memberIds[j] !== studentId && !/^\d{2}-\d{5}-\d$/.test(memberIds[j])) {
            showDashboardToast('Invalid ID: ' + memberIds[j] + '. Use XX-XXXXX-X format.', 'error'); return;
        }
        if (seen.has(memberIds[j])) { showDashboardToast('Duplicate member ID: ' + memberIds[j], 'error'); return; }
        seen.add(memberIds[j]);
    }

    var createBtn    = document.querySelector('#teamModal .btn-confirm');
    var origText     = createBtn.textContent;
    createBtn.disabled    = true;
    createBtn.textContent = 'Validating...';

    try {
        // Validate gender for each member
        for (var k = 1; k < memberIds.length; k++) {
            createBtn.textContent = 'Checking member ' + k + '...';
            var valRes = await authFetch(API_URL + '/teams/validate-member', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberStudentId: memberIds[k], gameId: currentGameId, leaderStudentId: studentId })
            });
            var valResult = await valRes.json();
            if (!valResult.success) {
                createBtn.textContent = origText; createBtn.disabled = false;
                showDashboardToast('Member ' + memberIds[k] + ': ' + (valResult.message || 'Gender mismatch'), 'error');
                return;
            }
        }

        // Create team
        createBtn.textContent = 'Creating...';
        var res = await authFetch(API_URL + '/teams/create', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, gameId: currentGameId, teamName: teamName })
        });
        var result = await res.json();

        if (result.success) {
            createBtn.textContent = 'Adding members...';
            for (var m = 1; m < memberIds.length; m++) {
                await _addTeamMember(result.team.id, memberIds[m]);
            }
            await authFetch(API_URL + '/cart/add', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId: studentId, item_type: 'TEAM_REGISTRATION', item_id: result.team.id, tournament_game_id: currentGameId })
            });
            showDashboardToast('Team created and added to cart!', 'success');
            closeTeamModal();
            loadRegistrationView();
            loadUserRegistrationStatus();
        } else {
            showDashboardToast(result.message || 'Team creation failed', 'error');
        }
    } catch (err) {
        console.error('Team creation error:', err);
        showDashboardToast('Error creating team. Please try again.', 'error');
    } finally {
        createBtn.textContent = origText;
        createBtn.disabled    = false;
    }
}

async function _addTeamMember(teamId, memberStudentId) {
    var leaderStudentId = localStorage.getItem('studentId');
    try {
        var res = await authFetch(API_URL + '/teams/' + teamId + '/members', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leaderStudentId: leaderStudentId, memberStudentId: memberStudentId })
        });
        return await res.json();
    } catch (e) { console.error(e); return { success: false }; }
}

// ── Replace Member Modal ──────────────────────────────────────
function replaceMember(teamId, memberId, memberName, memberStudentId) {
    replaceModalData = { teamId: teamId, memberId: memberId, currentMemberName: memberName || 'Unknown', currentMemberStudentId: memberStudentId || 'Unknown' };

    var modal = document.getElementById('replaceMemberModal');
    if (!modal) return;
    document.getElementById('currentMemberName').textContent   = replaceModalData.currentMemberName + ' (' + replaceModalData.currentMemberStudentId + ')';
    document.getElementById('newMemberStudentId').value        = '';
    document.getElementById('newMemberInfo').style.display     = 'none';
    document.getElementById('newMemberError').style.display    = 'none';
    document.getElementById('replaceConfirmation').style.display = 'none';
    modal.style.display    = 'flex';
    modal.style.visibility = 'visible';
}

function closeReplaceMemberModal() {
    var m = document.getElementById('replaceMemberModal');
    if (m) { m.style.display = 'none'; m.style.visibility = 'hidden'; }
    replaceModalData = { teamId: null, memberId: null, currentMemberName: null, currentMemberStudentId: null };
}

async function confirmReplaceMember() {
    var newStudentId    = document.getElementById('newMemberStudentId').value.trim();
    var leaderStudentId = localStorage.getItem('studentId');
    var errorEl         = document.getElementById('newMemberError');
    var infoEl          = document.getElementById('newMemberInfo');

    function setError(msg) { errorEl.textContent = '❌ ' + msg; errorEl.style.display = 'block'; infoEl.style.display = 'none'; }

    if (!newStudentId) { setError('Please enter a student ID'); return; }
    if (!/^\d{2}-\d{5}-\d$/.test(newStudentId)) { setError('Invalid format. Use: XX-XXXXX-X'); return; }
    if (newStudentId === leaderStudentId) { setError('You cannot add yourself as a member'); return; }
    if (newStudentId === replaceModalData.currentMemberStudentId) { setError('This is the same person you are replacing'); return; }

    document.getElementById('replaceConfirmation').style.display = 'block';
    document.getElementById('confirmationText').innerHTML = 'This will remove <strong>' + replaceModalData.currentMemberName + '</strong> and invite <strong>' + newStudentId + '</strong>.';

    var confirmBtn   = document.getElementById('confirmReplaceBtn');
    var origText     = confirmBtn.textContent;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Replacing...';

    try {
        var res = await authFetch(API_URL + '/teams/' + replaceModalData.teamId + '/members/' + replaceModalData.memberId + '/replace', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: leaderStudentId, newMemberStudentId: newStudentId })
        });
        var result = await res.json();
        if (result.success) {
            infoEl.innerHTML = '✅ <strong>Success!</strong> ' + result.message;
            infoEl.style.display = 'block'; errorEl.style.display = 'none';
            setTimeout(function() {
                closeReplaceMemberModal();
                if (currentGameId) editTeam(currentGameId, currentGameName, currentCategory);
            }, 1500);
        } else {
            setError(result.message || 'Failed to replace member');
        }
    } catch (err) {
        console.error(err);
        setError('Network error. Please try again.');
    } finally {
        confirmBtn.textContent = origText;
        confirmBtn.disabled    = false;
    }
}

// ── Request Game ──────────────────────────────────────────────
function requestGameForTournament(tournamentId, tournamentTitle) {
    openConfirmModal(
        '🎮 Request New Game',
        'Submit a game request for "' + tournamentTitle + '"?',
        function() {
            closeConfirmModal();
            var gameName = prompt('Game name (e.g., Badminton):');
            var category = prompt('Category (Male / Female / Mix):');
            var gameType = prompt('Game type (Solo / Duo / Team):');
            if (!gameName || !category || !gameType) { showDashboardToast('All fields are required.', 'warning'); return; }

            var studentId = localStorage.getItem('studentId');
            authFetch(API_URL + '/tournaments/request-game', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId: studentId, tournamentId: tournamentId, gameName: gameName, category: category, gameType: gameType })
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success) showDashboardToast('Game request submitted!', 'success');
                else showDashboardToast('Error: ' + data.message, 'error');
            })
            .catch(function(err) { console.error(err); showDashboardToast('Error submitting request.', 'error'); });
        }
    );
}
