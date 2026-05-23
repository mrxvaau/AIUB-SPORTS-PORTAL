/**
 * registration-page.js
 * --------------------
 * All logic for registration.html
 * Depends on: API_URL (api-config.js), authFetch (auth-fetch.js)
 */

var API_URL = (typeof API_CONFIG !== 'undefined' && API_CONFIG.API_BASE_URL)
    ? API_CONFIG.API_BASE_URL
    : (window.API_URL || '/api');

var gameDataMap      = new Map();
var currentGameId    = null;
var currentGameName  = null;
var currentCategory  = null;
var currentTeamSize  = 2;
var currentTeamId    = null;
var isEditMode       = false;
var teamMemberSlots  = 1;
var userGender       = null; // 'Male', 'Female', or null — used to filter visible categories

var replaceModalData = {
    teamId: null,
    memberId: null,
    currentMemberName: null,
    currentMemberStudentId: null
};

// ── Toast ────────────────────────────────────────────────────
function showToast(message, type, title) {
    type  = type  || 'success';
    title = title || { success:'Success!', error:'Error', info:'Info', warning:'Warning' }[type];

    var icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML =
        '<div class="toast-icon">' + (icons[type] || '✅') + '</div>' +
        '<div class="toast-content">' +
            '<div class="toast-title">' + title + '</div>' +
            '<div class="toast-message">' + message + '</div>' +
        '</div>' +
        '<button class="toast-close" onclick="this.parentElement.remove()">×</button>';

    container.appendChild(toast);
    toast.addEventListener('click', function(){ toast.remove(); });
    setTimeout(function(){ if (toast.parentElement) toast.remove(); }, 4000);
}

// ── Load Tournaments ─────────────────────────────────────────
async function loadTournaments() {
    try {
        var response = await authFetch(API_URL + '/tournaments');
        var data     = await response.json();

        document.getElementById('loading').style.display = 'none';

        if (!data.success || !data.tournaments || data.tournaments.length === 0) {
            document.getElementById('noTournaments').style.display = 'block';
            return;
        }

        var container     = document.getElementById('tournamentsContainer');
        var studentId     = localStorage.getItem('studentId');
        var userRegistrations = [];

        if (studentId) {
            try {
                var regRes  = await authFetch(API_URL + '/registration/my/' + studentId);
                var regData = await regRes.json();
                if (regData.success && regData.registrations) {
                    userRegistrations = regData.registrations;
                }
            } catch(e) { console.error('Error fetching registrations:', e); }

            // Fetch user gender for category filtering
            try {
                var profileRes  = await authFetch(API_URL + '/auth/profile/' + studentId);
                var profileData = await profileRes.json();
                if (profileData.success && profileData.user && profileData.user.gender) {
                    userGender = profileData.user.gender; // 'Male' or 'Female'
                }
            } catch(e) { console.error('Error fetching user profile:', e); }
        }

        for (var i = 0; i < data.tournaments.length; i++) {
            var tournament = data.tournaments[i];
            var tempId     = 'temp-card-' + tournament.id;
            container.innerHTML += '<div class="tournament-card" id="' + tempId + '">' +
                '<div style="text-align:center;padding:40px;">' +
                '<div class="spinner" style="width:36px;height:36px;margin:0 auto 16px;"></div>' +
                '<p>Loading ' + tournament.title + ' games...</p></div></div>';

            var gamesRes  = await authFetch(API_URL + '/tournaments/' + tournament.id + '/games');
            var gamesData = await gamesRes.json();

            var tempCard = document.getElementById(tempId);
            if (tempCard) tempCard.remove();

            if (gamesData.success) {
                container.innerHTML += createTournamentCard(tournament, gamesData.games);
                checkRegistrationStatusForTournament(tournament, gamesData.games, userRegistrations);
            } else {
                container.innerHTML += '<div class="tournament-card"><div class="tournament-info"><h1>' +
                    tournament.title + '</h1><div class="info-item">❌ Failed to load games</div></div></div>';
            }
        }
    } catch(err) {
        console.error('Error:', err);
        document.getElementById('loading').textContent = 'Error loading tournaments';
    }
}

// ── Build Tournament Card HTML ────────────────────────────────
function createTournamentCard(tournament, games) {
    var maleGames   = games.filter(function(g){ return g.category === 'Male'; });
    var femaleGames = games.filter(function(g){ return g.category === 'Female'; });
    var mixGames    = games.filter(function(g){ return g.category === 'Mix'; });

    [].concat(maleGames, femaleGames, mixGames).forEach(function(game) {
        var info = {
            name: game.game_name,
            category: game.category,
            type: game.game_type,
            fee: game.fee_per_person,
            fee_per_person: game.fee_per_person,
            team_size: game.team_size || 1,
            allow_cross_department: game.allow_cross_department || false
        };
        gameDataMap.set(String(game.id), info);
        gameDataMap.set(Number(game.id), info);
    });

    var photoUrl = tournament.photo_url || tournament.PHOTO_URL || '';
    var imageHtml = '';
    if (photoUrl && typeof photoUrl === 'string') {
        if (photoUrl.startsWith('data:image')) {
            imageHtml = '<img src="' + photoUrl + '" class="tournament-image" alt="Tournament">';
        } else if (photoUrl.startsWith('/uploads/')) {
            var base = API_URL.replace('/api', '');
            var full = photoUrl.startsWith('http') ? photoUrl : base + photoUrl;
            imageHtml = '<img src="' + full + '" class="tournament-image" alt="Tournament" onerror="this.style.display=\'none\'">';
        } else if (photoUrl.startsWith('http')) {
            imageHtml = '<img src="' + photoUrl + '" class="tournament-image" alt="Tournament" onerror="this.style.display=\'none\'">';
        } else {
            imageHtml = '<img src="data:image;base64,' + photoUrl + '" class="tournament-image" alt="Tournament">';
        }
    } else {
        imageHtml = '<div class="tournament-image" style="display:flex;align-items:center;justify-content:center;color:#6b7280;">No Image</div>';
    }

    var safeTitle = tournament.title.replace(/'/g, "\\'");

    // Filter categories based on user gender
    // Male users: see Male + Mix only
    // Female users: see Female + Mix only
    // Unknown/Other/null: see everything
    var showMale   = !userGender || userGender === 'Male'   || userGender === 'Other';
    var showFemale = !userGender || userGender === 'Female' || userGender === 'Other';

    return '<div class="tournament-card">' +
        '<div class="tournament-header">' + imageHtml +
        '<div class="tournament-info"><h1>' + tournament.title + '</h1>' +
        '<div class="info-item">📅 Registration Deadline: ' + new Date(tournament.registration_deadline).toLocaleDateString() + '</div>' +
        '<div class="info-item">📊 Status: ' + tournament.status + '</div>' +
        (tournament.description ? '<div class="info-item">📝 ' + tournament.description + '</div>' : '') +
        '</div></div>' +
        (showMale   && maleGames.length   > 0 ? createCategorySection('Male',   maleGames)   : '') +
        (showFemale && femaleGames.length > 0 ? createCategorySection('Female', femaleGames) : '') +
        (mixGames.length    > 0 ? createCategorySection('Mix',    mixGames)    : '') +
        '</div>';
}

function createCategorySection(category, games) {
    if (!games.length) return '';
    return '<div class="category-section"><div class="category-title">' + category + ' Category</div>' +
        '<div class="games-grid">' +
        games.map(function(game) {
            var safeGameName = game.game_name.replace(/'/g, "\\'");
            return '<div class="game-card" data-game-id="' + game.id + '" data-team-size="' + (game.team_size || 1) + '">' +
                '<div class="game-name">' + game.game_name + '</div>' +
                '<div class="game-type">Type: ' + game.game_type + ((game.team_size || 1) > 1 ? ' (Team of ' + game.team_size + ')' : '') + '</div>' +
                '<div class="game-fee">৳' + game.fee_per_person + ' per person</div>' +
                '<div class="registration-status" style="display:none;"><span class="status-text"></span></div>' +
                '<div style="display:flex;gap:8px;margin-top:10px;">' +
                '<button class="register-btn" data-game-id="' + game.id + '" data-game-name="' + game.game_name + '" data-game-category="' + game.category + '" style="flex:1;">Register Now</button>' +
                '<button class="edit-team-btn" data-game-id="' + game.id + '" ' +
                    'style="display:none;flex:0 0 auto;padding:10px 14px;background:#3b82f6;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;" ' +
                    'onclick="editTeam(' + game.id + ', \'' + safeGameName + '\', \'' + game.category + '\')">✏️ Edit Team</button>' +
                '</div></div>';
        }).join('') +
        '</div></div>';
}

// ── Registration Status ───────────────────────────────────────
function checkRegistrationStatusForTournament(tournament, games, userRegistrations) {
    var regMap = new Map();
    userRegistrations.forEach(function(reg) {
        var gid = reg.gameId || reg.game_id;
        regMap.set(gid, reg);
        regMap.set(String(gid), reg);
        regMap.set(Number(gid), reg);
    });

    games.forEach(function(game) {
        var gameCard = document.querySelector('.game-card[data-game-id="' + game.id + '"]');
        if (!gameCard) return;

        var button    = gameCard.querySelector('.register-btn');
        var statusDiv = gameCard.querySelector('.registration-status');
        var statusText = gameCard.querySelector('.status-text');
        if (!button) return;

        var registration = regMap.get(game.id) || regMap.get(String(game.id)) || regMap.get(Number(game.id));

        if (registration) {
            var paymentStatus = registration.paymentStatus || registration.payment_status;
            button.innerHTML = 'Cancel Registration';
            button.className = 'register-btn cancel';

            if (statusDiv && statusText) {
                statusDiv.style.display = 'block';
                if (paymentStatus === 'PAID') {
                    statusDiv.style.cssText += 'background:#d1fae5;color:#065f46;';
                    statusText.textContent = 'PAID';
                    button.innerHTML = 'Registration Confirmed';
                    button.className = 'register-btn';
                    button.disabled  = true;
                    button.style.background = '#10b981';
                    button.style.cursor     = 'default';
                    var editBtn = gameCard.querySelector('.edit-team-btn');
                    if (editBtn) editBtn.style.display = 'none';
                } else if (paymentStatus === 'PENDING') {
                    statusDiv.style.cssText += 'background:#fef3c7;color:#d97706;';
                    statusText.textContent = 'PENDING';
                    var editBtnP = gameCard.querySelector('.edit-team-btn');
                    var teamSize = parseInt(gameCard.dataset.teamSize) || 1;
                    if (editBtnP) editBtnP.style.display = teamSize > 1 ? 'block' : 'none';
                } else {
                    statusDiv.style.cssText += 'background:#fecaca;color:#b91c1c;';
                    statusText.textContent = 'UNPAID';
                    var editBtnU = gameCard.querySelector('.edit-team-btn');
                    var teamSizeU = parseInt(gameCard.dataset.teamSize) || 1;
                    if (editBtnU) editBtnU.style.display = teamSizeU > 1 ? 'block' : 'none';
                }
            }
        } else {
            button.innerHTML = 'Register Now';
            button.className = 'register-btn';
            if (statusDiv) statusDiv.style.display = 'none';
            var editBtnN = gameCard.querySelector('.edit-team-btn');
            if (editBtnN) editBtnN.style.display = 'none';
        }
    });
}

// ── Confirm Modal ─────────────────────────────────────────────
function openConfirmModal(title, message, confirmCallback) {
    document.getElementById('confirmModalTitle').textContent   = title;
    document.getElementById('confirmModalMessage').textContent = message;
    document.getElementById('confirmModalConfirmBtn').onclick  = confirmCallback;
    document.getElementById('confirmModal').classList.add('active');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
}

// ── Register / Cancel ─────────────────────────────────────────
async function registerForGame(gameId, gameName, category) {
    var studentId = localStorage.getItem('studentId');
    if (!studentId) { window.location.href = 'login.html'; return; }

    var gameData = gameDataMap.get(gameId) || gameDataMap.get(String(gameId)) || gameDataMap.get(Number(gameId));
    var teamSize = gameData && gameData.team_size ? gameData.team_size : 1;

    if (teamSize > 1) { openTeamModal(gameId, gameName, category, teamSize); return; }

    var gameCard = document.querySelector('.game-card[data-game-id="' + gameId + '"]');
    if (!gameCard) return;
    var feeMatch = gameCard.querySelector('.game-fee').textContent.match(/৳(\d+)/);
    var fee      = feeMatch ? parseInt(feeMatch[1]) : 0;
    var isFree   = !fee || fee === 0;
    var button   = gameCard.querySelector('.register-btn');
    if (!button || button.textContent.trim() === 'Cancel Registration') return;

    openConfirmModal(
        'Confirm Registration',
        'Register for ' + gameName + ' in ' + category + ' category?' + (isFree ? '\nThis is a FREE tournament — no payment required!' : '\nFee: ৳' + fee),
        async function() {
            closeConfirmModal();
            var origHtml    = button.innerHTML;
            button.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;"><div class="spinner" style="width:15px;height:15px;margin-right:7px;"></div>Registering...</div>';
            button.disabled  = true;

            try {
                var res  = await authFetch(API_URL + '/registration/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentId: studentId, gameId: gameId })
                });
                var result = await res.json();

                if (result.success) {
                    if (isFree) {
                        // Free game: show confirmation popup
                        showFreeConfirmPopup(gameId, gameName, null, function() {
                            button.innerHTML  = 'Cancel Registration';
                            button.className  = 'register-btn cancel';
                            button.disabled   = false;
                            button.setAttribute('data-game-id', gameId);
                            button.setAttribute('data-game-name', gameName);
                            button.setAttribute('data-game-category', category);
                        });
                    } else {
                        // Paid game: add to cart
                        try {
                            await authFetch(API_URL + '/cart/add', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ studentId: studentId, item_type: 'GAME_REGISTRATION', item_id: result.registration.id, tournament_game_id: gameId })
                            });
                        } catch(e) { console.error('Cart error:', e); }
                        button.innerHTML  = 'Cancel Registration';
                        button.className  = 'register-btn cancel';
                        button.disabled   = false;
                        button.setAttribute('data-game-id', gameId);
                        button.setAttribute('data-game-name', gameName);
                        button.setAttribute('data-game-category', category);
                        showToast('Successfully registered for ' + gameName + '!', 'success', 'Registered');
                    }
                } else {
                    showToast(result.message || 'Unknown error', 'error', 'Registration Failed');
                    button.innerHTML = origHtml;
                    button.disabled  = false;
                }
            } catch(err) {
                console.error(err);
                showToast('Error registering. Please try again.', 'error');
                button.innerHTML = origHtml;
                button.disabled  = false;
            }
        }
    );
}

async function cancelRegistration(gameId, gameName, category, button) {
    var studentId = localStorage.getItem('studentId');
    if (!studentId) { window.location.href = 'login.html'; return; }

    openConfirmModal(
        'Cancel Registration',
        'Are you sure you want to cancel your registration for ' + gameName + '?\nThis action cannot be undone.',
        async function() {
            closeConfirmModal();
            var origHtml    = button.innerHTML;
            button.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;"><div class="spinner" style="width:15px;height:15px;margin-right:7px;"></div>Canceling...</div>';
            button.disabled  = true;

            try {
                var res  = await authFetch(API_URL + '/registration/' + gameId + '/' + studentId, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });
                var result = await res.json();

                if (result.success) {
                    try {
                        await authFetch(API_URL + '/cart/game/' + gameId + '/' + studentId, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    } catch(e) { console.error('Cart remove error:', e); }
                    button.innerHTML = 'Register Now';
                    button.className = 'register-btn';
                    button.disabled  = false;
                    button.setAttribute('data-game-id', gameId);
                    button.setAttribute('data-game-name', gameName);
                    button.setAttribute('data-game-category', category);
                    var gameCard  = button.closest('.game-card');
                    if (gameCard) {
                        var statusDiv = gameCard.querySelector('.registration-status');
                        if (statusDiv) statusDiv.style.display = 'none';
                        var editBtn = gameCard.querySelector('.edit-team-btn');
                        if (editBtn) editBtn.style.display = 'none';
                    }
                    showToast('Registration for ' + gameName + ' canceled.', 'success', 'Canceled');
                } else {
                    showToast(result.message || 'Unknown error', 'error', 'Cancellation Failed');
                    button.innerHTML = origHtml;
                    button.disabled  = false;
                }
            } catch(err) {
                console.error(err);
                showToast('Error canceling. Please try again.', 'error');
                button.innerHTML = origHtml;
                button.disabled  = false;
            }
        }
    );
}

// ── Team Modal — Create ───────────────────────────────────────
function openTeamModal(gameId, gameName, category, teamSize) {
    teamSize = teamSize || 2;
    isEditMode      = false;
    currentTeamId   = null;
    currentGameId   = gameId;
    currentGameName = gameName;
    currentCategory = category;
    currentTeamSize = teamSize;

    var teamNameInput = document.getElementById('teamName');
    var teamNameError = document.getElementById('teamNameError');
    teamNameInput.disabled = false;
    teamNameInput.value    = '';
    teamNameInput.style.borderColor = '';
    teamNameInput.style.background  = '';
    if (teamNameError) teamNameError.style.display = 'none';

    teamNameInput.oninput = function() {
        this.style.borderColor = '';
        this.style.background  = '';
        if (teamNameError) teamNameError.style.display = 'none';
    };

    document.getElementById('modalGameName').textContent = gameName;

    var gameData     = gameDataMap.get(gameId) || gameDataMap.get(String(gameId)) || gameDataMap.get(Number(gameId));
    var feePerPerson = gameData ? gameData.fee_per_person : 0;
    var subtitle     = document.querySelector('.team-modal-subtitle');
    if (subtitle) {
        subtitle.textContent = category + ' Category | Team of ' + teamSize + ' | ৳' + feePerPerson + ' × ' + teamSize + ' = ৳' + (feePerPerson * teamSize);
    }

    var slotsHtml = '<div class="team-member-slot leader">' +
        '<div class="member-role">👑 Leader</div>' +
        '<div class="member-info"><div class="member-id">' + (localStorage.getItem('studentId') || '') + '</div>' +
        '<div style="font-size:12px;opacity:0.7;">' + (localStorage.getItem('userName') || 'You') + '</div></div>' +
        '<div class="member-status confirmed">✅ Confirmed</div></div>';

    for (var i = 1; i < teamSize; i++) {
        slotsHtml += '<div class="team-member-slot" id="member-slot-' + i + '">' +
            '<div class="member-role">👤 Member ' + (i + 1) + '</div>' +
            '<div class="member-info"><input type="text" class="team-form-input member-id-input" placeholder="Student ID (XX-XXXXX-X)" data-slot="' + i + '"></div>' +
            '<div class="member-status pending">⏳ Pending</div></div>';
    }

    document.getElementById('teamMembersList').innerHTML = slotsHtml;
    teamMemberSlots = teamSize;

    var reqMsg = document.querySelector('.team-required-msg');
    if (reqMsg) reqMsg.textContent = '⚠️ All ' + teamSize + ' members must confirm participation before registration is finalized.';

    var modalBtns = document.querySelector('.team-modal-buttons');
    if (modalBtns) {
        modalBtns.innerHTML =
            '<button class="btn-cancel" onclick="closeTeamModal()">Cancel</button>' +
            '<button class="btn-confirm" onclick="createTeam()">Create Team &amp; Register</button>';
    }

    document.getElementById('teamModal').style.display = 'flex';
}

function closeTeamModal() {
    document.getElementById('teamModal').style.display = 'none';
}

// ── Team Modal — Edit ─────────────────────────────────────────
async function editTeam(gameId, gameName, category) {
    var studentId = localStorage.getItem('studentId');
    if (!studentId) { alert('Please log in first!'); return; }

    try {
        var res  = await authFetch(API_URL + '/teams/by-game/' + gameId + '/' + studentId);
        var data = await res.json();
        if (!data.success) { alert(data.message || 'No team found for this game.'); return; }

        var team     = data.team;
        var gameData = gameDataMap.get(gameId) || gameDataMap.get(String(gameId)) || gameDataMap.get(Number(gameId));
        var teamSize = (team.game && team.game.teamSize) || (gameData && gameData.team_size) || 2;

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
        team.members.forEach(function(member, index) {
            var isLeader    = member.role === 'LEADER';
            var statusClass = member.status === 'CONFIRMED' ? 'confirmed' : 'pending';
            var statusIcon  = member.status === 'CONFIRMED' ? '✅' : member.status === 'REJECTED' ? '❌' : '⏳';
            var memberName  = (member.user && member.user.name) || 'Awaiting Response';
            var memberSid   = (member.user && member.user.student_id) || 'Pending...';
            var safeName    = memberName.replace(/'/g, "\\'");

            slotsHtml += '<div class="team-member-slot ' + (isLeader ? 'leader' : '') + '" data-member-id="' + member.id + '">' +
                '<div class="member-role">' + (isLeader ? '👑 Leader' : '👤 Member ' + (index + 1)) + '</div>' +
                '<div class="member-info"><div class="member-id">' + memberSid + '</div><div style="font-size:12px;opacity:0.7;">' + memberName + '</div></div>' +
                '<div class="member-status ' + statusClass + '">' + statusIcon + ' ' + member.status + '</div>' +
                (!isLeader ? '<button style="padding:5px 10px;background:#f59e0b;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;" onclick="replaceMember(' + team.id + ',' + member.id + ',\'' + safeName + '\',\'' + memberSid + '\')">🔄 Replace</button>' : '') +
                '</div>';
        });

        document.getElementById('teamMembersList').innerHTML = slotsHtml;

        var confirmedCount = team.members.filter(function(m){ return m.status === 'CONFIRMED'; }).length;
        var pendingCount   = team.members.filter(function(m){ return m.status === 'PENDING'; }).length;
        var reqMsg = document.querySelector('.team-required-msg');
        if (reqMsg) reqMsg.innerHTML = '📊 Team Status: ' + confirmedCount + '/' + teamSize + ' confirmed | ' + pendingCount + ' pending<br><small>Click 🔄 Replace to swap a member before payment.</small>';

        var modalBtns = document.querySelector('.team-modal-buttons');
        if (modalBtns) modalBtns.innerHTML = '<button class="btn-cancel" onclick="closeTeamModal()">Close</button>';

        document.getElementById('teamModal').style.display = 'flex';
    } catch(err) {
        console.error('Error fetching team:', err);
        alert('Error loading team data. Please try again.');
    }
}

// ── Create Team ───────────────────────────────────────────────
async function createTeam() {
    var teamNameInput = document.getElementById('teamName');
    var teamName      = teamNameInput.value.trim();
    var studentId     = localStorage.getItem('studentId');
    var teamNameError = document.getElementById('teamNameError');

    teamNameInput.style.borderColor = '';
    teamNameInput.style.background  = '';
    if (teamNameError) teamNameError.style.display = 'none';

    if (!teamName) {
        teamNameInput.style.borderColor = '#ef4444';
        teamNameInput.style.background  = 'rgba(239,68,68,0.08)';
        if (teamNameError) teamNameError.style.display = 'block';
        teamNameInput.focus();
        return;
    }

    var memberInputs = document.querySelectorAll('#teamMembersList .member-info input');
    var memberIds    = [studentId];
    memberInputs.forEach(function(inp){
        var mid = inp.value.trim();
        if (mid) memberIds.push(mid);
    });

    for (var i = 0; i < memberIds.length; i++) {
        if (!/^\d{2}-\d{5}-\d$/.test(memberIds[i])) {
            showToast('Invalid student ID: ' + memberIds[i] + '. Use XX-XXXXX-X format.', 'error', 'Invalid Format');
            return;
        }
    }

    var seen = new Set();
    for (var j = 0; j < memberIds.length; j++) {
        if (seen.has(memberIds[j])) {
            showToast('Duplicate ID: ' + memberIds[j] + '. Each member must have a unique ID.', 'error', 'Duplicate ID');
            return;
        }
        seen.add(memberIds[j]);
    }

    var createBtn    = document.querySelector('.btn-confirm');
    var originalText = createBtn.textContent;
    createBtn.textContent = 'Validating...';
    createBtn.disabled    = true;

    try {
        // Validate members first
        if (memberIds.length > 1) {
            createBtn.textContent = 'Checking members...';
            for (var k = 1; k < memberIds.length; k++) {
                var valRes  = await authFetch(API_URL + '/teams/validate-member', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberStudentId: memberIds[k], gameId: currentGameId, leaderStudentId: studentId })
                });
                var valResult = await valRes.json();
                if (!valResult.success) {
                    createBtn.textContent = originalText;
                    createBtn.disabled    = false;
                    if (valResult.errorType === 'department_mismatch') {
                        showDepartmentErrorPopup(valResult, memberIds[k], k);
                    } else {
                        showGenderErrorPopup(valResult, memberIds[k], k);
                    }
                    return;
                }
            }
        }

        // Create team
        createBtn.textContent = 'Creating...';
        var res    = await authFetch(API_URL + '/teams/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, gameId: currentGameId, teamName: teamName })
        });
        var result = await res.json();

        if (result.success) {
            createBtn.textContent = 'Adding members...';
            for (var m = 1; m < memberIds.length; m++) {
                await addTeamMember(result.team.id, memberIds[m]);
            }

            // Check if this is a free game
            var gameData = gameDataMap.get(currentGameId) || gameDataMap.get(String(currentGameId)) || gameDataMap.get(Number(currentGameId));
            var gameFee = gameData ? (gameData.fee_per_person || gameData.fee || 0) : 0;
            var isFree  = !gameFee || gameFee === 0;

            if (isFree) {
                // Free game: show confirm registration popup
                closeTeamModal();
                showFreeConfirmPopup(currentGameId, currentGameName, result.team.id, function() {
                    location.reload();
                });
            } else {
                // Paid game: add to cart
                await addToCart(studentId, 'TEAM_REGISTRATION', result.team.id, currentGameId);
                showToast('Team created and added to cart!', 'success', 'Team Created');
                closeTeamModal();
                location.reload();
            }
        } else {
            showToast(result.message || 'Unknown error', 'error', 'Team Creation Failed');
        }
    } catch(err) {
        console.error('Team creation error:', err);
        alert('Error creating team. Please try again.');
    } finally {
        createBtn.textContent = originalText;
        createBtn.disabled    = false;
    }
}

function showGenderErrorPopup(result, studentId, memberIndex) {
    var requiredGender = result.requiredGender || 'correct gender';
    var memberName     = result.memberName     || studentId;
    var memberGender   = result.memberGender   || 'unknown';

    var overlay = document.createElement('div');
    overlay.id  = 'genderErrorOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(4px);';
    overlay.innerHTML =
        '<div style="background:var(--bg-card);border-radius:12px;max-width:430px;width:90%;box-shadow:0 20px 50px rgba(0,0,0,0.4);overflow:hidden;border:1px solid var(--border-color);">' +
        '<div style="background:linear-gradient(135deg,#dc2626,#b91c1c);color:white;padding:20px;text-align:center;">' +
        '<div style="font-size:44px;margin-bottom:8px;">⚠️</div><h3 style="margin:0;font-size:18px;">Gender Mismatch</h3></div>' +
        '<div style="padding:24px;">' +
        '<div style="background:rgba(239,68,68,0.08);border-left:4px solid #dc2626;padding:14px;border-radius:6px;margin-bottom:18px;">' +
        '<p style="margin:0;font-size:14px;"><strong>' + memberName + '</strong> is <strong>' + memberGender + '</strong><br><br>This game requires a <strong>' + requiredGender + '</strong> team member.</p></div>' +
        '<p style="text-align:center;font-size:13px;margin-bottom:18px;">Please enter a valid ' + requiredGender + ' student ID.</p>' +
        '<div style="display:flex;justify-content:center;">' +
        '<button onclick="document.getElementById(\'genderErrorOverlay\').remove();" style="padding:11px 22px;background:#f59e0b;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;">✏️ Change Member ID</button>' +
        '</div></div></div>';
    document.body.appendChild(overlay);
}

function showDepartmentErrorPopup(result, studentId, memberIndex) {
    var memberName       = result.memberName       || studentId;
    var memberDepartment = result.memberDepartment  || 'unknown';
    var leaderDepartment = result.leaderDepartment  || 'unknown';

    var overlay = document.createElement('div');
    overlay.id  = 'departmentErrorOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(4px);';
    overlay.innerHTML =
        '<div style="background:var(--bg-card);border-radius:12px;max-width:430px;width:90%;box-shadow:0 20px 50px rgba(0,0,0,0.4);overflow:hidden;border:1px solid var(--border-color);">' +
        '<div style="background:linear-gradient(135deg,#d97706,#b45309);color:white;padding:20px;text-align:center;">' +
        '<div style="font-size:44px;margin-bottom:8px;">⚠️</div><h3 style="margin:0;font-size:18px;">Department Mismatch</h3></div>' +
        '<div style="padding:24px;">' +
        '<div style="background:rgba(217,119,6,0.08);border-left:4px solid #d97706;padding:14px;border-radius:6px;margin-bottom:18px;">' +
        '<p style="margin:0;font-size:14px;"><strong>' + memberName + '</strong> is from <strong>' + memberDepartment + '</strong>.<br><br>This tournament requires same-department teams. Please add someone from your department (<strong>' + leaderDepartment + '</strong>).</p></div>' +
        '<p style="text-align:center;font-size:13px;margin-bottom:18px;">Enter a student ID from the <strong>' + leaderDepartment + '</strong> department.</p>' +
        '<div style="display:flex;justify-content:center;">' +
        '<button onclick="document.getElementById(\'departmentErrorOverlay\').remove();" style="padding:11px 22px;background:#d97706;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;">✏️ Change Member ID</button>' +
        '</div></div></div>';
    document.body.appendChild(overlay);
}

function showFreeConfirmPopup(gameId, gameName, teamId, onSuccess) {
    var overlay = document.createElement('div');
    overlay.id  = 'freeConfirmOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(5px);';
    overlay.innerHTML =
        '<div style="background:var(--bg-card,#fff);border-radius:16px;max-width:460px;width:92%;box-shadow:0 25px 60px rgba(0,0,0,0.5);overflow:hidden;border:1px solid var(--border-color,#e5e7eb);animation:fadeInScale 0.3s ease-out;">' +
        '<div style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:24px;text-align:center;">' +
        '<div style="font-size:48px;margin-bottom:10px;">🎉</div>' +
        '<h3 style="margin:0;font-size:20px;font-weight:700;">Confirm Registration</h3>' +
        '<p style="margin:6px 0 0;font-size:13px;opacity:0.9;">Free Tournament — No Payment Required</p>' +
        '</div>' +
        '<div style="padding:24px;">' +
        '<div style="background:rgba(245,158,11,0.08);border-left:4px solid #f59e0b;padding:16px;border-radius:8px;margin-bottom:20px;">' +
        '<p style="margin:0;font-size:14px;line-height:1.6;color:var(--text-primary,#111);">' +
        '<strong>⚠️ Please read carefully:</strong><br><br>' +
        'Once you confirm your registration for <strong>' + gameName + '</strong>, ' +
        'your spot will be <strong>locked and finalized</strong>.<br><br>' +
        '• You <strong>cannot undo</strong> this action<br>' +
        '• Team members <strong>cannot be changed</strong> after confirmation<br>' +
        '• Your registration status will be set to <strong>Confirmed</strong>' +
        '</p></div>' +
        '<p style="text-align:center;font-size:13px;color:var(--text-secondary,#6b7280);margin-bottom:20px;">Are you sure you want to confirm your registration?</p>' +
        '<div style="display:flex;gap:12px;justify-content:center;">' +
        '<button id="freeConfirmCancelBtn" style="padding:12px 24px;background:var(--bg-card,#f3f4f6);color:var(--text-primary,#374151);border:1px solid var(--border-color,#d1d5db);border-radius:10px;cursor:pointer;font-weight:600;font-size:14px;transition:all 0.2s;">Cancel</button>' +
        '<button id="freeConfirmYesBtn" style="padding:12px 24px;background:linear-gradient(135deg,#059669,#047857);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;font-size:14px;box-shadow:0 4px 12px rgba(5,150,105,0.3);transition:all 0.2s;">✅ Confirm Registration</button>' +
        '</div></div></div>';

    document.body.appendChild(overlay);

    document.getElementById('freeConfirmCancelBtn').onclick = function() {
        overlay.remove();
    };

    document.getElementById('freeConfirmYesBtn').onclick = async function() {
        var btn = this;
        btn.textContent = 'Confirming...';
        btn.disabled = true;

        try {
            var studentId = localStorage.getItem('studentId');
            var body = { studentId: studentId, gameId: gameId };
            if (teamId) body.teamId = teamId;

            var res = await authFetch(API_URL + '/registration/confirm-free', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            var result = await res.json();

            if (result.success) {
                overlay.remove();
                showToast('Registration confirmed for ' + gameName + '! 🎉', 'success', 'Confirmed!');
                if (onSuccess) onSuccess();
            } else {
                showToast(result.message || 'Confirmation failed', 'error', 'Error');
                btn.textContent = '✅ Confirm Registration';
                btn.disabled = false;
            }
        } catch(err) {
            console.error('Free confirm error:', err);
            showToast('Error confirming. Please try again.', 'error');
            btn.textContent = '✅ Confirm Registration';
            btn.disabled = false;
        }
    };
}

async function addTeamMember(teamId, memberStudentId) {
    var leaderStudentId = localStorage.getItem('studentId');
    try {
        var res  = await authFetch(API_URL + '/teams/' + teamId + '/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leaderStudentId: leaderStudentId, memberStudentId: memberStudentId })
        });
        var result = await res.json();
        if (result.alreadyOnTeam) {
            showToast(result.message || 'This user is already on a team for this game.', 'error', 'Already on Team');
        }
        return result;
    } catch(err) {
        console.error(err);
        return { success: false };
    }
}

async function addToCart(studentId, itemType, itemId, tournamentGameId) {
    try {
        var res = await authFetch(API_URL + '/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, item_type: itemType, item_id: itemId, tournament_game_id: tournamentGameId })
        });
        return await res.json();
    } catch(err) {
        console.error(err);
        return { success: false };
    }
}

// ── Replace Member ────────────────────────────────────────────
function replaceMember(teamId, memberId, memberName, memberStudentId) {
    openReplaceMemberModal(teamId, memberId, memberName, memberStudentId);
}

function openReplaceMemberModal(teamId, memberId, memberName, memberStudentId) {
    replaceModalData = {
        teamId: teamId,
        memberId: memberId,
        currentMemberName: memberName || 'Unknown',
        currentMemberStudentId: memberStudentId || 'Unknown'
    };
    document.getElementById('currentMemberName').textContent = replaceModalData.currentMemberName + ' (' + replaceModalData.currentMemberStudentId + ')';
    document.getElementById('newMemberStudentId').value      = '';
    document.getElementById('newMemberInfo').style.display   = 'none';
    document.getElementById('newMemberError').style.display  = 'none';
    document.getElementById('replaceConfirmation').style.display = 'none';
    document.getElementById('replaceMemberModal').style.display  = 'flex';
}

function closeReplaceMemberModal() {
    document.getElementById('replaceMemberModal').style.display = 'none';
    replaceModalData = { teamId: null, memberId: null, currentMemberName: null, currentMemberStudentId: null };
}

async function confirmReplaceMember() {
    var newStudentId    = document.getElementById('newMemberStudentId').value.trim();
    var leaderStudentId = localStorage.getItem('studentId');
    var errorEl         = document.getElementById('newMemberError');
    var infoEl          = document.getElementById('newMemberInfo');

    function setError(msg) {
        errorEl.textContent      = '❌ ' + msg;
        errorEl.style.display    = 'block';
        infoEl.style.display     = 'none';
    }

    if (!newStudentId) { setError('Please enter a student ID'); return; }
    if (!/^\d{2}-\d{5}-\d{1}$/.test(newStudentId)) { setError('Invalid format. Use: XX-XXXXX-X (e.g., 23-54919-3)'); return; }
    if (newStudentId === leaderStudentId) { setError('You cannot add yourself as a team member'); return; }
    if (newStudentId === replaceModalData.currentMemberStudentId) { setError('This is the same person you are trying to replace'); return; }

    document.getElementById('replaceConfirmation').style.display = 'block';
    document.getElementById('confirmationText').innerHTML =
        'This will remove <strong>' + replaceModalData.currentMemberName + '</strong> and invite <strong>' + newStudentId + '</strong>.';

    var confirmBtn   = document.getElementById('confirmReplaceBtn');
    var origText     = confirmBtn.textContent;
    confirmBtn.textContent = 'Replacing...';
    confirmBtn.disabled    = true;

    try {
        var res  = await authFetch(API_URL + '/teams/' + replaceModalData.teamId + '/members/' + replaceModalData.memberId + '/replace', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: leaderStudentId, newMemberStudentId: newStudentId })
        });
        var result = await res.json();

        if (result.success) {
            infoEl.innerHTML   = '✅ <strong>Success!</strong> ' + result.message;
            infoEl.style.display   = 'block';
            errorEl.style.display  = 'none';
            setTimeout(function() {
                closeReplaceMemberModal();
                if (currentTeamId && currentGameId) editTeam(currentGameId, currentGameName, currentCategory);
            }, 1500);
        } else {
            setError(result.message || 'Failed to replace member');
        }
    } catch(err) {
        console.error(err);
        setError('Network error. Please try again.');
    } finally {
        confirmBtn.textContent = origText;
        confirmBtn.disabled    = false;
    }
}


// ── Event Delegation ──────────────────────────────────────────
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('register-btn')) {
        var button   = e.target;
        var gameId   = button.getAttribute('data-game-id');
        var gameName = button.getAttribute('data-game-name');
        var category = button.getAttribute('data-game-category');
        if (!gameId || !gameName || !category) return;

        if (button.textContent.trim() === 'Register Now') {
            registerForGame(gameId, gameName, category);
        } else if (button.textContent.trim() === 'Cancel Registration') {
            cancelRegistration(gameId, gameName, category, button);
        }
    }
});

// ── Bootstrap ─────────────────────────────────────────────────
(function applyTheme() {
    var stored = null;
    try { stored = localStorage.getItem('dashboardTheme'); } catch(e) {}
    if (stored) document.documentElement.setAttribute('data-theme', stored);
})();

// Run immediately — this script is loaded dynamically AFTER DOM is ready,
// so window.onload has already fired. We just call loadTournaments() directly.
(function bootstrap() {
    if (localStorage.getItem('isAuthenticated') !== 'true') {
        window.location.href = 'login.html';
        return;
    }
    loadTournaments();
})();

window.addEventListener('pageshow', function(event) {
    if (event.persisted && localStorage.getItem('isAuthenticated') === 'true') {
        document.getElementById('tournamentsContainer').innerHTML = '';
        document.getElementById('loading').style.display = 'flex';
        loadTournaments();
    }
});
