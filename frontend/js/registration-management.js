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
    if (!contentDiv) return;

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
                'x-user-email': userEmail || ''
            }
        });

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

    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; padding: 16px; margin-top: 16px; background: #f8fafc; border-radius: 6px; border: 2px dashed #cbd5e1;">`;

    games.forEach(game => {
        html += `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; transition: all 0.2s;">
                <div style="font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">${game.game_name || 'Unnamed Game'}</div>
                <div style="display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap;">
                    <span class="reg-badge reg-badge-active" style="font-size: 11px;">${game.category || 'N/A'}</span>
                    <span class="reg-badge reg-badge-upcoming" style="font-size: 11px;">${game.game_type || 'N/A'}</span>
                </div>
                <div style="font-size: 20px; font-weight: 700; color: #3b82f6; margin-bottom: 10px;">${game.registration_count} Registrations</div>
                <button onclick="manageGameRegistrations(${game.id}, '${game.game_name}')" 
                        style="width: 100%; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s;">
                    View Registered Users
                </button>
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
        delete window.updateMemberStatus;
        delete window.removeMember;
    };

    // Load registration data
    try {
        const response = await fetch(`${API_URL}/admin/games/${gameId}/registrations`, {
            headers: { 'x-user-email': userEmail || '' }
        });

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
                            <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                                ${team.status}
                            </span>
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
                                    <button onclick="updatePayment(${data.game.id}, '${member.student_id}', 'PAID')" 
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
                                <button onclick="updatePayment(${data.game.id}, '${reg.user.student_id}', 'PAID')" 
                                        style="background: #10b981; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                    Mark as Paid
                                </button>
                            ` : `
                                <button onclick="updatePayment(${data.game.id}, '${reg.user.student_id}', 'PENDING')" 
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
window.updatePayment = async function (gameId, studentId, status) {
    const API_URL = window.API_URL || 'http://localhost:3000/api';
    const userEmail = localStorage.getItem('userEmail');

    try {
        // First, get the registration ID
        const dataResponse = await fetch(`${API_URL}/admin/games/${gameId}/registrations?search=${studentId}`, {
            headers: { 'x-user-email': userEmail || '' }
        });
        const data = await dataResponse.json();

        if (!data.success || !data.registrations || data.registrations.length === 0) {
            throw new Error('Registration not found');
        }

        // Find the specific registration
        let registrationId;
        if (data.game.is_team_game) {
            // For team games, find the member and their registration
            for (const teamReg of data.registrations) {
                const member = teamReg.members.find(m => m.student_id === studentId);
                if (member) {
                    // Need to get the game_registration ID for this user
                    const regResponse = await fetch(`${API_URL}/registrations/user/${studentId}`, {
                        headers: { 'x-user-email': userEmail || '' }
                    });
                    const regData = await regResponse.json();
                    const userGameReg = regData.registrations?.find(r => r.game_id == gameId);
                    if (userGameReg) {
                        registrationId = userGameReg.id;
                        break;
                    }
                }
            }
        } else {
            registrationId = data.registrations[0].id;
        }

        if (!registrationId) {
            throw new Error('Could not find registration ID');
        }

        const response = await fetch(`${API_URL}/admin/registrations/${registrationId}/payment`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-email': userEmail || ''
            },
            body: JSON.stringify({ payment_status: status })
        });

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
        console.error('Error updating payment:', error);
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
                'x-user-email': userEmail || ''
            },
            body: JSON.stringify({ status })
        });

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
            headers: { 'x-user-email': userEmail || '' }
        });

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
