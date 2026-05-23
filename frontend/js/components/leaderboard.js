/**
 * leaderboard.js  — Match Results & Leaderboard section
 * Depends on: API_URL, authFetch
 */

async function loadLeaderboardView() {
    var container = document.getElementById('leaderboardContent');
    container.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div><p>Loading match results...</p></div>';

    try {
        var res  = await authFetch(API_URL + '/dashboard/leaderboard');
        var data = await res.json();

        if (!data.success || !data.games || data.games.length === 0) {
            container.innerHTML = '<div class="no-matches-msg">No match results available yet.</div>';
            return;
        }

        var html = '<div class="leaderboard-container">';
        data.games.forEach(function(game) {
            var progressPct = game.total > 0 ? Math.round((game.played / game.total) * 100) : 0;
            html += '<div class="leaderboard-game-group">'
                  + '<div class="leaderboard-game-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === \'none\' ? \'block\' : \'none\'">'
                  + '<h3>' + game.game_name + (game.tournament_title ? ' (' + game.tournament_title + ')' : '') + '</h3>'
                  + '<div class="game-meta"><span>' + (game.category || '') + '</span><span>' + (game.game_type || '') + '</span><span>' + game.played + '/' + game.total + ' played</span></div>'
                  + '</div>'
                  + '<div>'
                  + '<table class="leaderboard-matches-table">'
                  + '<thead><tr><th>Round</th><th>Match</th><th>Score</th><th>Winner</th><th>Venue</th><th>Time</th><th>Status</th></tr></thead>'
                  + '<tbody>';

            game.matches.forEach(function(m) {
                var timeStr    = m.time ? new Date(m.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
                var scoreStr   = m.score_a != null && m.score_b != null ? (m.score_a + ' - ' + m.score_b) : '-';
                var statusClass = m.status === 'PLAYED' ? 'played' : m.status === 'CANCELLED' ? 'cancelled' : 'scheduled';
                html += '<tr>'
                      + '<td>' + (m.round_label || '-') + '</td>'
                      + '<td>' + (m.participant_a || 'TBD') + ' vs ' + (m.participant_b || 'TBD') + '</td>'
                      + '<td class="score-cell">' + scoreStr + '</td>'
                      + '<td class="winner-cell">' + (m.winner || '-') + '</td>'
                      + '<td>' + (m.venue || '-') + '</td>'
                      + '<td>' + timeStr + '</td>'
                      + '<td><span class="match-status-badge ' + statusClass + '">' + m.status + '</span></td>'
                      + '</tr>';
            });

            html += '</tbody></table>'
                  + '<div class="leaderboard-progress"><span>' + progressPct + '% complete</span>'
                  + '<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:' + progressPct + '%"></div></div>'
                  + '<span>' + game.played + '/' + game.total + '</span></div>'
                  + '</div></div>';
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Error loading leaderboard:', err);
        container.innerHTML = '<div class="no-matches-msg">Could not load match results. Please try again later.</div>';
    }
}
