/**
 * schedule.js  — Game schedule cards (home + registration sections)
 * Depends on: API_URL, authFetch
 */

async function loadUserSchedule() {
    var studentId = localStorage.getItem('studentId');
    if (!studentId) return;

    var containers = [
        document.getElementById('scheduleContentHome'),
        document.getElementById('scheduleContent')
    ].filter(Boolean);

    try {
        var res  = await authFetch(API_URL + '/dashboard/schedule/' + studentId);
        var data = await res.json();
        var html = buildScheduleHTML(data.success ? data.matches : []);
        containers.forEach(function(c) { c.innerHTML = html; });
    } catch (err) {
        console.error('Error loading schedule:', err);
        var errHtml = '<div class="no-matches-msg">Could not load schedule.</div>';
        containers.forEach(function(c) { c.innerHTML = errHtml; });
    }
}

function buildScheduleHTML(matches) {
    if (!matches || matches.length === 0) {
        return '<div class="no-matches-msg">No upcoming matches scheduled yet.</div>';
    }

    var display = matches.slice(0, 6);
    var html    = '';
    display.forEach(function(m) {
        var start       = new Date(m.scheduled_start);
        var dateStr     = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        var timeStr     = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        var statusClass = (m.status || '').toLowerCase().includes('played')  ? 'played'
                        : (m.status || '').toLowerCase().includes('cancel') ? 'cancelled' : 'scheduled';
        var scoreText   = m.status === 'PLAYED' && m.score_a != null && m.score_b != null
                        ? (m.score_a + ' - ' + m.score_b) : '';

        html += '<div class="match-item">'
              + '<div class="match-time-block"><div class="match-date">' + dateStr + '</div><div class="match-time">' + timeStr + '</div></div>'
              + '<div class="match-details">'
              + '<div class="match-game-name">' + (m.game_name || 'Game') + (m.tournament_title ? ' - ' + m.tournament_title : '') + '</div>'
              + '<div class="match-vs">' + (m.participant_a_label || 'TBD') + ' vs ' + (m.participant_b_label || 'TBD') + (scoreText ? ' • ' + scoreText : '') + '</div>'
              + '<div class="match-venue">' + (m.venue_name || '') + (m.round_label ? ' • ' + m.round_label : '') + '</div>'
              + '</div>'
              + '<span class="match-status-badge ' + statusClass + '">' + (m.status || 'SCHEDULED') + '</span>'
              + '</div>';
    });

    if (matches.length > 6) {
        html += '<div style="text-align:center;padding:8px;color:#6b7280;font-size:12px;">+ ' + (matches.length - 6) + ' more matches</div>';
    }
    return html;
}
