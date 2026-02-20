// Registration Management with URL Routing
// This script handles the registration management panel with nested games and URL routing

// Navigation function with URL routing
function navigateToRegistrations() {
    // Hide all content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show registration management section
    const regSection = document.getElementById('registration-management-placeholder');
    if (regSection) {
        regSection.classList.add('active');
    }

    // Update URL without page reload - always use absolute path from origin
    const newUrl = window.location.origin + '/admin-dashboard.html/registrations';
    history.pushState({ view: 'registrations' }, '', newUrl);

    // Load content
    loadRegistrationManagementNested();
}

async function loadRegistrationManagementNested() {

    const contentDiv = document.getElementById('regManagementContent');
    if (!contentDiv) {
        console.error('regManagementContent element not found!');
        return;
    }

    try {

        // Show loading state
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="width: 50px; height: 50px; border: 4px solid #f3f4f6; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <p style="color: #6b7280;">Loading registration data...</p>
            </div>
        `;

        const API_URL = window.API_URL || 'http://localhost:3000/api';
        const userEmail = localStorage.getItem('userEmail');


        const response = await fetch(`${API_URL}/admin/registrations/overview`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('msAccessToken'),
                'x-user-email': userEmail || ''
            }
        });



        if (response.status === 401) {
            console.warn('Session expired in loadRegistrationManagementNested');
            localStorage.removeItem('msAccessToken');
            localStorage.removeItem('userEmail');
            window.location.href = 'index.html';
            return;
        }

        const data = await response.json();


        if (!data.success) {
            throw new Error(data.message || 'Failed to load registrations');
        }

        // Group games by tournament
        const tournamentGamesMap = {};
        if (data.games && data.games.length > 0) {
            data.games.forEach(game => {
                const tournamentId = game.tournament_id;
                if (!tournamentGamesMap[tournamentId]) {
                    tournamentGamesMap[tournamentId] = [];
                }
                tournamentGamesMap[tournamentId].push(game);
            });
        }

        // Render content
        let html = '<div style="padding: 0;">';

        if (data.tournaments && data.tournaments.length > 0) {
            data.tournaments.forEach(tournament => {
                const statusClass = tournament.status === 'ACTIVE' ? 'active' :
                    tournament.status === 'UPCOMING' ? 'upcoming' : 'completed';

                const tournamentGames = tournamentGamesMap[tournament.id] || [];
                const gameCount = tournamentGames.length;

                html += `
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
                            <div style="font-size: 18px; font-weight: 600; color: #1e293b;">${tournament.name || 'Unnamed Tournament'}</div>
                            <span class="reg-badge reg-badge-${statusClass}">${tournament.status || 'Unknown'}</span>
                        </div>
                        
                        <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 16px; flex-wrap: wrap;">
                            <div style="font-size: 13px; color: #64748b;">
                                📅 Deadline: ${new Date(tournament.registration_deadline).toLocaleDateString()}
                            </div>
                            <div style="font-size: 13px; color: #64748b;">
                                🎮 ${gameCount} Game${gameCount !== 1 ? 's' : ''}
                            </div>
                            <span style="background: #f0f9ff; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">
                                ${tournament.total_registrations} Total Registrations
                            </span>
                        </div>

                        <button onclick="toggleTournamentGames(${tournament.id})" 
                                style="background: #3b82f6; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
                            <span id="toggle-icon-${tournament.id}">▼</span>
                            <span id="toggle-text-${tournament.id}">Show Games</span>
                        </button>

                        <div id="games-container-${tournament.id}" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease;">
                            ${renderNestedGames(tournamentGames)}
                        </div>
                    </div>
                `;
            });
        } else {
            html += `
                <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 8px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                    <p style="color: #64748b; font-size: 16px;">No tournaments found</p>
                </div>
            `;
        }

        html += '</div>';
        contentDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading registration management:', error);
        contentDiv.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <p style="color: #ef4444; font-weight: 600; margin-bottom: 8px;">Failed to Load Registration Data</p>
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">${error.message}</p>
                <button onclick="loadRegistrationManagementNested()" 
                        style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
    }
}

function renderNestedGames(games) {
    if (games.length === 0) {
        return `
            <div style="text-align: center; padding: 30px; color: #94a3b8; font-style: italic; margin-top: 16px;">
                No games added to this tournament yet
            </div>
        `;
    }

    // Group games by name
    const gamesByName = {};
    games.forEach(game => {
        const name = game.game_name || 'Unnamed Game';
        if (!gamesByName[name]) {
            gamesByName[name] = [];
        }
        gamesByName[name].push(game);
    });

    let html = `<div style="display: flex; flex-direction: column; gap: 16px; padding: 16px; margin-top: 16px; background: #f8fafc; border-radius: 6px; border: 2px dashed #cbd5e1;">`;

    Object.entries(gamesByName).forEach(([gameName, gameVariants]) => {
        // Sort variants by category (e.g., Male, Female, Mix)
        const categoryOrder = { 'Male': 1, 'Female': 2, 'Mix': 3 };
        gameVariants.sort((a, b) => {
            const catA = categoryOrder[a.category] || 99;
            const catB = categoryOrder[b.category] || 99;
            return catA - catB;
        });

        html += `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="padding: 12px 16px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #334155; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 16px;">${gameName}</span>
                    <span style="font-size: 12px; color: #64748b; background: #e2e8f0; padding: 2px 8px; border-radius: 12px;">${gameVariants.length} Variant${gameVariants.length !== 1 ? 's' : ''}</span>
                </div>
                
                <div style="padding: 8px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid #f1f5f9;">
                                <th style="text-align: left; padding: 8px 12px; font-size: 12px; color: #64748b; font-weight: 600;">Category</th>
                                <th style="text-align: left; padding: 8px 12px; font-size: 12px; color: #64748b; font-weight: 600;">Type</th>
                                <th style="text-align: center; padding: 8px 12px; font-size: 12px; color: #64748b; font-weight: 600;">Registrations</th>
                                <th style="text-align: right; padding: 8px 12px; font-size: 12px; color: #64748b; font-weight: 600;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        gameVariants.forEach(game => {
            const categoryColor =
                game.category === 'Male' ? '#3b82f6' :
                    game.category === 'Female' ? '#ec4899' :
                        game.category === 'Mix' ? '#8b5cf6' : '#64748b';

            const categoryBg =
                game.category === 'Male' ? '#eff6ff' :
                    game.category === 'Female' ? '#fdf2f8' :
                        game.category === 'Mix' ? '#f5f3ff' : '#f1f5f9';

            html += `
                <tr style="border-bottom: 1px solid #f8fafc;">
                    <td style="padding: 10px 12px;">
                        <span style="background: ${categoryBg}; color: ${categoryColor}; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                            ${game.category || 'N/A'}
                        </span>
                    </td>
                    <td style="padding: 10px 12px; font-size: 13px; color: #475569;">
                        ${game.game_type || 'N/A'}
                    </td>
                    <td style="padding: 10px 12px; text-align: center;">
                        <span style="font-weight: 700; color: #1e293b;">${game.registration_count}</span>
                    </td>
                    <td style="padding: 10px 12px; text-align: right;">
                        <button onclick="manageGameRegistrations(${game.id}, '${game.game_name} - ${game.category}')" 
                                style="background: white; border: 1px solid #cbd5e1; color: #475569; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s; font-weight: 500;"
                                onmouseover="this.style.borderColor='#3b82f6'; this.style.color='#3b82f6'"
                                onmouseout="this.style.borderColor='#cbd5e1'; this.style.color='#475569'">
                            Manage
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

function toggleTournamentGames(tournamentId) {
    const container = document.getElementById(`games-container-${tournamentId}`);
    const icon = document.getElementById(`toggle-icon-${tournamentId}`);
    const text = document.getElementById(`toggle-text-${tournamentId}`);

    if (container.style.maxHeight && container.style.maxHeight !== '0px') {
        // Collapse
        container.style.maxHeight = '0';
        icon.textContent = '▼';
        text.textContent = 'Show Games';
    } else {
        // Expand - set to scrollHeight for smooth animation
        container.style.maxHeight = container.scrollHeight + 'px';
        icon.textContent = '▲';
        text.textContent = 'Hide Games';
    }
}

async function manageGameRegistrations(gameId, gameName) {
    const API_URL = window.API_URL || 'http://localhost:3000/api';
    const userEmail = localStorage.getItem('userEmail');

    // Create modal HTML structure
    const modalHTML = `
        <div id="registrationModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
            <div style="background: white; border-radius: 12px; width: 100%; max-width: 1200px; max-height: 90vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                <!-- Header -->
                <div style="padding: 24px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; z-index: 10;">
                    <div>
                        <h2 style="margin: 0; font-size: 24px; color: #1e293b;">Manage Registrations</h2>
                        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;" id="gameInfoText">Loading...</p>
                    </div>
                    <button onclick="closeRegistrationModal()" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #64748b; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: all 0.2s;">
                        ×
                    </button>
                </div>
                
                <!-- Search Bar -->
                <div style="padding: 20px 24px; border-bottom: 1px solid #e5e7eb; background: #f8fafc;">
                    <input type="text" id="registrationSearch" placeholder="Search by Student ID..." 
                           style="width: 100%; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px;" 
                           onkeyup="filterRegistrations()">
                </div>
                
                <!-- Content Area -->
                <div id="registrationContent" style="padding: 24px; min-height: 200px;">
                    <div style="text-align: center; padding: 60px 20px; color: #64748b;">
                        <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
                        <p>Loading registrations...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add modal to page
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    // Close function
    window.closeRegistrationModal = function () {
        document.getElementById('registrationModal').remove();
        delete window.closeRegistrationModal;
        delete window.filterRegistrations;
        delete window.updatePayment;
        delete window.updateTeamMemberPayment;
        delete window.updateMemberStatus;
        delete window.removeMember;
    };

    // Load registration data
    try {
        const response = await fetch(`${API_URL}/admin/games/${gameId}/registrations`, {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('msAccessToken'),
                'x-user-email': userEmail || ''
            }
        });

        if (response.status === 401) {
            console.warn('Session expired in manageGameRegistrations');
            localStorage.removeItem('msAccessToken');
            localStorage.removeItem('userEmail');
            window.location.href = 'index.html';
            return;
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to load registrations');
        }

        // Store data globally for filtering
        window.registrationData = data;

        // Update game info
        const game = data.game;
        document.getElementById('gameInfoText').textContent =
            `${game.game_name} • ${game.category} • ${game.is_team_game ? `Team (${game.team_size} players)` : 'Solo'} • Fee: ৳${game.fee_per_person}`;

        // Render registrations
        renderRegistrations(data);

    } catch (error) {
        console.error('Error loading registrations:', error);
        document.getElementById('registrationContent').innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <p style="color: #ef4444; font-weight: 600;">Failed to Load Registrations</p>
                <p style="color: #64748b; font-size: 14px;">${error.message}</p>
            </div>
        `;
    }
}

function renderRegistrations(data) {
    const container = document.getElementById('registrationContent');
    const registrations = data.registrations;
    const isTeamGame = data.game.is_team_game;

    if (!registrations || registrations.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #64748b;">
                <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                <p>No registrations found for this game</p>
            </div>
        `;
        return;
    }

    let html = '';

    if (isTeamGame) {
        // Team game registrations
        html += '<div style="display: flex; flex-direction: column; gap: 16px;">';

        registrations.forEach(reg => {
            const team = reg.team;
            const leader = reg.members.find(m => m.role === 'LEADER');
            const fillPercentage = (team.member_count / team.required_size) * 100;

            html += `
                <div data-search-text="${leader?.student_id || ''}" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <!-- Team Header -->
                    <div style="padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                            <div>
                                <h3 style="margin: 0; font-size: 18px;">${team.team_name}</h3>
                                <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Leader: ${leader?.full_name} (${leader?.student_id})</p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${reg.payment_status !== 'PAID' && reg.team.status !== 'CONFIRMED' ? `
                                    <button onclick="confirmRegistration(null, ${reg.team.id})" 
                                            style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                        Confirm Registration (Cash)
                                    </button>
                                ` : ''}
                                <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                                    ${team.status}
                                </span>
                            </div>
                        </div>
                        
                        <!-- Progress Bar -->
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                                <span>Team Members</span>
                                <span>${team.member_count}/${team.required_size}</span>
                            </div>
                            <div style="background: rgba(255,255,255,0.3); height: 8px; border-radius: 4px; overflow: hidden;">
                                <div style="background: white; height: 100%; width: ${fillPercentage}%; transition: width 0.3s;"></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Team Members Table -->
                    <div style="padding: 16px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <thead>
                                <tr style="border-bottom: 2px solid #e5e7eb; text-align: left;">
                                    <th style="padding: 10px;font-weight: 600; color: #475569;">Student ID</th>
                                    <th style="padding: 10px; font-weight: 600; color: #475569;">Name</th>
                                    <th style="padding: 10px; font-weight: 600; color: #475569;">Role</th>
                                    <th style="padding: 10px; font-weight: 600; color: #475569;">Status</th>
                                    <th style="padding: 10px; font-weight: 600; color: #475569;">Payment</th>
                                    <th style="padding: 10px; font-weight: 600; color: #475569;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>`;

            reg.members.forEach(member => {
                const statusColor = member.status === 'CONFIRMED' ? '#10b981' : member.status === 'REJECTED' ? '#ef4444' : '#f59e0b';
                const paymentColor = member.payment_status === 'PAID' ? '#10b981' : member.payment_status === 'UNPAID' ? '#ef4444' : '#f59e0b';

                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px;">${member.student_id}</td>
                        <td style="padding: 12px;">${member.full_name}</td>
                        <td style="padding: 12px;">
                            <span style="background: ${member.role === 'LEADER' ? '#8b5cf6' : '#64748b'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                                ${member.role}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                                ${member.status}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            <span style="background: ${paymentColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                                ${member.payment_status}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            <div style="display: flex; gap: 6px;">
                                ${member.status !== 'CONFIRMED' ? `
                                    <button onclick="updateMemberStatus(${member.id}, 'CONFIRMED')" 
                                            style="background: #10b981; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;"
                                            title="Confirm">
                                        ✓
                                    </button>
                                ` : ''}
                                ${member.payment_status !== 'PAID' ? `
                                    <button onclick="updateTeamMemberPayment(${member.id}, 'PAID')" 
                                            style="background: #3b82f6; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;"
                                            title="Mark as Paid">
                                        💳
                                    </button>
                                ` : ''}
                                ${member.role !== 'LEADER' ? `
                                    <button onclick="removeMember(${member.id}, '${member.full_name}')" 
                                            style="background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;"
                                            title="Remove">
                                        ×
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        html += '</div>';

    } else {
        // Solo game registrations
        html += `
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="border-bottom: 2px solid #e5e7eb; text-align: left; background: #f8fafc;">
                        <th style="padding: 12px; font-weight: 600; color: #475569;">Student ID</th>
                        <th style="padding: 12px; font-weight: 600; color: #475569;">Name</th>
                        <th style="padding: 12px; font-weight: 600; color: #475569;">Email</th>
                        <th style="padding: 12px; font-weight: 600; color: #475569;">Registered</th>
                        <th style="padding: 12px; font-weight: 600; color: #475569;">Payment</th>
                        <th style="padding: 12px; font-weight: 600; color: #475569;">Actions</th>
                    </tr>
                </thead>
                <tbody>`;

        registrations.forEach(reg => {
            const paymentColor = reg.payment_status === 'PAID' ? '#10b981' : reg.payment_status === 'UNPAID' ? '#ef4444' : '#f59e0b';

            html += `
                <tr data-search-text="${reg.user.student_id}" style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px; font-weight: 500;">${reg.user.student_id}</td>
                    <td style="padding: 12px;">${reg.user.full_name}</td>
                    <td style="padding: 12px; color: #64748b; font-size: 13px;">${reg.user.email}</td>
                    <td style="padding: 12px; color: #64748b; font-size: 13px;">${new Date(reg.registration_date).toLocaleDateString()}</td>
                    <td style="padding: 12px;">
                        <span style="background: ${paymentColor}; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                            ${reg.payment_status}
                        </span>
                    </td>
                    <td style="padding: 12px;">
                        <div style="display: flex; gap: 6px;">
                            ${reg.payment_status !== 'PAID' ? `
                                <button onclick="updatePayment(${reg.id}, 'PAID')" 
                                        style="background: #10b981; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                    Mark as Paid
                                </button>
                            ` : `
                                <button onclick="updatePayment(${reg.id}, 'PENDING')" 
                                        style="background: #f59e0b; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                    Mark as Pending
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;
    }

    container.innerHTML = html;
}

// Filter function
window.filterRegistrations = function () {
    const searchText = document.getElementById('registrationSearch').value.toLowerCase();
    const rows = document.querySelectorAll('[data-search-text]');

    rows.forEach(row => {
        const text = row.getAttribute('data-search-text').toLowerCase();
        row.style.display = text.includes(searchText) ? '' : 'none';
    });
};

// Update payment status
window.updatePayment = async function (registrationId, status) {
    const API_URL = window.API_URL || 'http://localhost:3000/api';
    const userEmail = localStorage.getItem('userEmail');

    if (!registrationId) {
        alert('Error: Missing registration ID');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/registrations/${registrationId}/payment`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('msAccessToken'),
                'x-user-email': userEmail || ''
            },
            body: JSON.stringify({ payment_status: status })
        });

        if (response.status === 401) {
            alert('Session expired. Please log in again.');
            window.location.href = 'index.html';
            return;
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        // Reload the modal
        const gameId_reload = window.registrationData.game.id;
        const gameName_reload = window.registrationData.game.game_name;
        // Don't close modal to keep context, just reload content
        // But the current implementation closes and reopens to refresh data
        // We can optimize this later, but for now stick to pattern
        closeRegistrationModal();
        manageGameRegistrations(gameId_reload, gameName_reload);

    } catch (error) {
        console.error('Error updating payment:', error);
        alert('Error updating payment status: ' + error.message);
    }
};

// Update team member payment status (robust)
window.updateTeamMemberPayment = async function (memberId, status) {
    const API_URL = window.API_URL || 'http://localhost:3000/api';
    const userEmail = localStorage.getItem('userEmail');

    if (!confirm('Are you sure you want to update payment status? This will create a registration record if one does not exist.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/team-members/${memberId}/payment`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('msAccessToken'),
                'x-user-email': userEmail || ''
            },
            body: JSON.stringify({ payment_status: status })
        });

        if (response.status === 401) {
            alert('Session expired. Please log in again.');
            window.location.href = 'index.html';
            return;
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        // Reload the modal
        const gameId_reload = window.registrationData.game.id;
        const gameName_reload = window.registrationData.game.game_name;
        closeRegistrationModal();
        manageGameRegistrations(gameId_reload, gameName_reload);

    } catch (error) {
        console.error('Error updating team member payment:', error);
        alert('Error updating payment status: ' + error.message);
    }
};

// Update member status
window.updateMemberStatus = async function (memberId, status) {
    const API_URL = window.API_URL || 'http://localhost:3000/api';
    const userEmail = localStorage.getItem('userEmail');

    try {
        const response = await fetch(`${API_URL}/admin/team-members/${memberId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('msAccessToken'),
                'x-user-email': userEmail || ''
            },
            body: JSON.stringify({ status })
        });

        if (response.status === 401) {
            alert('Session expired. Please log in again.');
            window.location.href = 'index.html';
            return;
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        // Reload the modal
        const gameId = window.registrationData.game.id;
        const gameName = window.registrationData.game.game_name;
        closeRegistrationModal();
        manageGameRegistrations(gameId, gameName);

    } catch (error) {
        console.error('Error updating member status:', error);
        alert('Error updating member status: ' + error.message);
    }
};

// Remove member
window.removeMember = async function (memberId, memberName) {
    if (!confirm(`Are you sure you want to remove ${memberName} from this team?`)) {
        return;
    }

    const API_URL = window.API_URL || 'http://localhost:3000/api';
    const userEmail = localStorage.getItem('userEmail');

    try {
        const response = await fetch(`${API_URL}/admin/team-members/${memberId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('msAccessToken'),
                'x-user-email': userEmail || ''
            }
        });

        if (response.status === 401) {
            alert('Session expired. Please log in again.');
            window.location.href = 'index.html';
            return;
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        // Reload the modal
        const gameId = window.registrationData.game.id;
        const gameName = window.registrationData.game.game_name;
        closeRegistrationModal();
        manageGameRegistrations(gameId, gameName);

    } catch (error) {
        console.error('Error removing member:', error);
        alert('Error removing member: ' + error.message);
    }
};

// Confirm Registration (Cash Override)
window.confirmRegistration = async function (registrationId, teamId) {
    const API_URL = window.API_URL || 'http://localhost:3000/api';
    const userEmail = localStorage.getItem('userEmail');

    let message = 'Are you sure you want to confirm this registration? This will mark it as PAID (Cash).';
    if (teamId) {
        message = 'Are you sure you want to confirm this TEAM? All members will be marked as PAID (Cash) and status CONFIRMED.';
    }

    if (!confirm(message)) {
        return;
    }

    try {
        // Construct the URL correctly. If teamId is present, we might use a different logic or pass it in body
        // The backend expects /registrations/confirm/:registrationId
        // If we have teamId, we can pass 'team' as ID and handle in backend or send a body

        let url = `${API_URL}/admin/registrations/confirm/`;
        let body = {};

        if (teamId) {
            url += 'team'; // Placeholder ID
            body = { teamId: teamId };
        } else {
            url += registrationId;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('msAccessToken'),
                'x-user-email': userEmail || ''
            },
            body: JSON.stringify(body)
        });

        if (response.status === 401) {
            alert('Session expired. Please log in again.');
            window.location.href = 'index.html';
            return;
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        // Reload the modal
        const gameId_reload = window.registrationData.game.id;
        const gameName_reload = window.registrationData.game.game_name;
        closeRegistrationModal();
        manageGameRegistrations(gameId_reload, gameName_reload);

    } catch (error) {
        console.error('Error confirming registration:', error);
        alert('Error: ' + error.message);
    }
};



// Handle browser back/forward buttons
window.addEventListener('popstate', function (event) {
    if (event.state && event.state.view === 'registrations') {
        navigateToRegistrations();
    } else if (window.location.pathname.includes('/registrations')) {
        navigateToRegistrations();
    }
});

// Check URL on page load and navigate if needed
window.addEventListener('DOMContentLoaded', function () {
    if (window.location.pathname.includes('/registrations')) {
        navigateToRegistrations();
    }
});
