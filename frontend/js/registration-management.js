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

function manageGameRegistrations(gameId, gameName) {
    alert(`Game registration management feature coming soon!\nGame: ${gameName} (ID: ${gameId})`);
    // TODO: Navigate to detailed game registration management page
}

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
