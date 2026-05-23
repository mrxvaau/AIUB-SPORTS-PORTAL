/**
 * registration.js  — Tournament cards, team modal, replace-member modal
 * Depends on: API_URL, authFetch
 */

// ── Global state for team modal ──────────────────────────────
var gameDataMap     = new Map();
var currentTeamSize = 2;
var currentTeamId   = null;
var isEditMode      = false;
var currentGameId   = null;
var currentGameName = null;
var currentCategory = null;
var replaceModalData = { teamId: null, memberId: null, currentMemberName: null, currentMemberStudentId: null };

// ── Registration status ──────────────────────────────────────
async function loadAvailableTournaments() {
    try {
        var studentId = localStorage.getItem('studentId');
        var res  = await authFetch(API_URL + '/dashboard/tournaments/' + studentId);
        var data = await res.json();
        var registerBtn = document.getElementById('registerBtn');
        var messageDiv  = document.getElementById('registrationMessage');

        if (data.success && data.tournaments && data.tournaments.length > 0) {
            registerBtn.disabled   = false;
            registerBtn.textContent = 'Registration';
            registerBtn.className  = 'active-registration-btn';
            messageDiv.innerHTML   = '<p>Registration is now open! Click the button to register for tournaments.</p>';
        } else {
            registerBtn.disabled    = true;
            registerBtn.textContent = 'Registration Closed';
            messageDiv.innerHTML    = '<p>No tournaments available for registration at the moment.</p>';
        }
    } catch (err) {
        console.error('Load tournaments error:', err);
        document.getElementById('registerBtn').disabled = true;
        document.getElementById('registrationMessage').innerHTML = '<p>Error loading tournament information. Please try again later.</p>';
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
                registerBtn.textContent = 'Registered (' + n + ')';
                registerBtn.className   = 'active-registration-btn';
                messageDiv.innerHTML    = '<p>You have registered for ' + n + ' game' + (n > 1 ? 's' : '') + '. Check your registration status.</p>';
            } else {
                await loadAvailableTournaments();
            }
        }
    } catch (err) {
        console.error('Error loading registration status:', err);
    }
}

function goToRegistration() { window.location.href = 'registration.html'; }

// ── Registration View ────────────────────────────────────────
async function loadRegistrationView() {
    var container = document.getElementById('registrationContent');
    container.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div><p>Loading tournaments...</p></div>';
    try {
        var studentId = localStorage.getItem('studentId');
        var res  = await authFetch(API_URL + '/dashboard/tournaments/' + studentId);
        var data = await res.json();

        if (data.success && data.tournaments && data.tournaments.length > 0) {
            var html = '<div class="games-grid">';
            data.tournaments.forEach(function(t) {
                html += '<div class="tournament-card">'
                      + '<div class="tournament-header">'
                      + '<h3 class="tournament-title">' + t.title + '</h3>'
                      + '<p class="tournament-deadline">Deadline: ' + new Date(t.deadline).toLocaleDateString() + '</p>'
                      + '</div>'
                      + '<div class="tournament-body">'
                      + '<p class="tournament-description">' + (t.description || 'Join now and compete with the best!') + '</p>'
                      + '<button class="view-games-btn" onclick="loadTournamentGamesForPanel(' + t.id + ')">View Games</button>'
                      + '<div id="panel-games-' + t.id + '" class="game-list" style="display:none;"></div>'
                      + '</div>'
                      + '</div>';
            });
            html += '</div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280;"><p>No tournaments available at the moment.</p></div>';
        }
    } catch (err) {
        console.error('Error loading registration view:', err);
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;"><p>Error loading tournaments. Please try again later.</p></div>';
    }
}

async function loadTournamentGamesForPanel(tournamentId) {
    var gamesContainer = document.getElementById('panel-games-' + tournamentId);
    if (gamesContainer.style.display === 'block') { gamesContainer.style.display = 'none'; return; }
    gamesContainer.style.display = 'block';
    gamesContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7280;font-size:14px;">Loading games...</div>';

    try {
        var res  = await authFetch(API_URL + '/tournaments/' + tournamentId + '/games');
        var data = await res.json();
        if (data.success && data.games && data.games.length > 0) {
            var html = '';
            data.games.forEach(function(game) {
                gameDataMap.set(game.id, game);
                html += '<div class="game-item">'
                      + '<div class="game-info">'
                      + '<div class="game-name">' + game.game_name + '</div>'
                      + '<div class="game-meta">' + game.category + ' • ' + game.game_type + ' • <span style="color:#10b981;font-weight:600;">৳' + game.fee_per_person + '</span></div>'
                      + '</div>'
                      + '<button class="register-btn-sm" onclick="registerForGamePanel(' + game.id + ', \'' + game.game_name + '\', \'' + game.category + '\')">Register</button>'
                      + '</div>';
            });
            gamesContainer.innerHTML = html;
        } else {
            gamesContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7280;font-size:14px;">No games found for this tournament.</div>';
        }
    } catch (err) {
        console.error('Error loading games:', err);
        gamesContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:14px;">Error loading games.</div>';
    }
}

async function registerForGamePanel(gameId, gameName, category) {
    var studentId = localStorage.getItem('studentId');
    if (!studentId) { alert('Please log in first!'); return; }

    var gameData = gameDataMap.get(gameId);
    if (!gameData) { alert('Game data not found. Please refresh.'); return; }

    var teamSize = gameData.team_size || 1;
    if (teamSize > 1) { openTeamModal(gameId, gameName, category, teamSize); return; }

    if (!confirm('Register for ' + gameName + ' (' + category + ')?\nFee: ৳' + (gameData.fee_per_person || 0))) return;

    try {
        var res    = await authFetch(API_URL + '/registration/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, gameId: gameId })
        });
        var result = await res.json();
        if (result.success) {
            await authFetch(API_URL + '/cart/add', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId: studentId, item_type: 'GAME_REGISTRATION', item_id: result.registration.id, tournament_game_id: gameId })
            });
            alert('Successfully registered for ' + gameName + '! Added to cart.');
            loadAvailableTournaments();
            openCartModal();
        } else {
            alert('Registration Failed: ' + result.message);
        }
    } catch (err) {
        console.error('Registration error:', err);
        alert('Error registering for game.');
    }
}

// ── Tournament modal (legacy) ─────────────────────────────
function closeTournamentModal() { document.getElementById('tournamentModal').classList.add('hidden'); }

// ── Team Modal ───────────────────────────────────────────────
function openTeamModal(gameId, gameName, category, teamSize) {
    teamSize = teamSize || 2;
    isEditMode      = false;
    currentTeamId   = null;
    currentGameId   = gameId;
    currentGameName = gameName;
    currentCategory = category;
    currentTeamSize = teamSize;

    document.getElementById('teamName').disabled = false;
    document.getElementById('modalGameName').textContent = gameName;
    document.getElementById('teamName').value = '';

    var gameData    = gameDataMap.get(gameId);
    var feePerPerson = gameData ? gameData.fee_per_person : 0;
    var totalFee    = feePerPerson * teamSize;
    var subtitle    = document.querySelector('.team-modal-subtitle');
    if (subtitle) { subtitle.textContent = category + ' Category | Team Size: ' + teamSize + ' | Fee: ৳' + feePerPerson + ' × ' + teamSize + ' = ৳' + totalFee; }

    var leaderHtml = '<div class="team-member-slot leader" style="display:flex;gap:10px;padding:10px;background:#dbeafe;border-radius:6px;margin-bottom:10px;border:1px solid #3b82f6;">'
                   + '<div class="member-role" style="font-weight:600;color:#3b82f6;">👑 Leader</div>'
                   + '<div class="member-info" style="flex:1;"><div class="member-id">' + localStorage.getItem('studentId') + '</div>'
                   + '<div class="member-name">' + (localStorage.getItem('userName') || 'You') + '</div></div>'
                   + '<div class="member-status confirmed" style="color:#065f46;font-size:12px;font-weight:600;">✅ Confirmed</div>'
                   + '</div>';

    var slotsHtml = leaderHtml;
    for (var i = 1; i < teamSize; i++) {
        slotsHtml += '<div class="team-member-slot" style="display:flex;gap:10px;padding:10px;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:10px;">'
                   + '<div class="member-role" style="font-weight:600;color:#3b82f6;">👤 Member ' + (i + 1) + '</div>'
                   + '<div class="member-info" style="flex:1;"><input type="text" class="team-form-input member-id-input" placeholder="Enter student ID (XX-XXXXX-X)" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:4px;" data-slot="' + i + '"></div>'
                   + '<div class="member-status pending" style="color:#d97706;font-size:12px;">⏳ Pending</div>'
                   + '</div>';
    }

    document.getElementById('teamMembersList').innerHTML = slotsHtml;
    document.getElementById('teamModal').style.display = 'flex';
}

function closeTeamModal() { document.getElementById('teamModal').style.display = 'none'; }

async function createTeam() {
    var teamName  = document.getElementById('teamName').value.trim();
    var studentId = localStorage.getItem('studentId');
    if (!teamName) { alert('Team name is required'); return; }

    var memberInputs = document.querySelectorAll('#teamMembersList .member-info input');
    var memberIds    = [studentId];
    memberInputs.forEach(function(inp) { var mid = inp.value.trim(); if (mid) memberIds.push(mid); });

    if (memberIds.length < currentTeamSize) {
        if (!confirm('You have only filled ' + memberIds.length + ' out of ' + currentTeamSize + ' slots. Continue? (You can add members later)')) return;
    }

    var createBtn    = document.querySelector('#teamModal .btn-confirm');
    var originalText = createBtn.textContent;
    createBtn.textContent = 'Creating...';
    createBtn.disabled    = true;

    try {
        var res    = await authFetch(API_URL + '/teams/create', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, gameId: currentGameId, teamName: teamName })
        });
        var result = await res.json();
        if (result.success) {
            createBtn.textContent = 'Adding members...';
            for (var i = 1; i < memberIds.length; i++) {
                await _addTeamMember(result.team.id, memberIds[i]);
            }
            await authFetch(API_URL + '/cart/add', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId: studentId, item_type: 'TEAM_REGISTRATION', item_id: result.team.id, tournament_game_id: currentGameId })
            });
            alert('Team created and added to cart!');
            closeTeamModal();
            openCartModal();
        } else {
            alert('Failed: ' + result.message);
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Team creation failed.');
    } finally {
        createBtn.textContent = originalText;
        createBtn.disabled    = false;
    }
}

async function _addTeamMember(teamId, memberStudentId) {
    var leaderStudentId = localStorage.getItem('studentId');
    try {
        await authFetch(API_URL + '/teams/' + teamId + '/members', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leaderStudentId: leaderStudentId, memberStudentId: memberStudentId })
        });
    } catch (e) { console.error(e); }
}

// ── Replace Member Modal ────────────────────────────────────
function closeReplaceMemberModal() {
    var m = document.getElementById('replaceMemberModal');
    m.style.display    = 'none';
    m.style.visibility = 'hidden';
    replaceModalData   = { teamId: null, memberId: null, currentMemberName: null, currentMemberStudentId: null };
}

function replaceMember(teamId, memberId, memberName, memberStudentId) {
    alert('Replace functionality is available in Registration Details view.');
}

function confirmReplaceMember() {
    alert('Replace functionality is available in Registration Details view.');
}
