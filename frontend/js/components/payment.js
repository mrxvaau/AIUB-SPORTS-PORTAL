/**
 * payment.js  — Payment history section
 * Depends on: API_URL, authFetch, openBkashModal (cart.js)
 */

async function loadPaymentView() {
    var container = document.getElementById('paymentContent');
    container.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div><p>Loading payment history...</p></div>';

    try {
        var studentId = localStorage.getItem('studentId');
        var res  = await authFetch(API_URL + '/dashboard/registrations/' + studentId);
        var data = await res.json();

        if (data.success) {
            if (data.registrations.length === 0) {
                container.innerHTML = '<p style="text-align:center;padding:20px;">No registrations found.</p>';
                return;
            }

            // Sort newest first
            data.registrations.sort(function(a, b) {
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });

            var html = '<div style="overflow-x:auto;">'
                     + '<table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">'
                     + '<thead style="background:#f3f4f6;border-bottom:2px solid #e5e7eb;"><tr>'
                     + '<th style="padding:12px;text-align:left;font-weight:600;color:#374151;">Game</th>'
                     + '<th style="padding:12px;text-align:left;font-weight:600;color:#374151;">Tournament</th>'
                     + '<th style="padding:12px;text-align:left;font-weight:600;color:#374151;">Status</th>'
                     + '<th style="padding:12px;text-align:left;font-weight:600;color:#374151;">Amount</th>'
                     + '<th style="padding:12px;text-align:right;font-weight:600;color:#374151;">Action</th>'
                     + '</tr></thead><tbody>';

            data.registrations.forEach(function(reg) {
                var statusColor = (reg.payment_status === 'PAID' || reg.payment_status === 'CONFIRMED')
                    ? '#10b981' : (reg.payment_status === 'PENDING' ? '#f59e0b' : '#ef4444');
                var statusText = reg.payment_status || 'UNPAID';
                var fee        = reg.team_id && reg.teams ? (reg.teams.game && reg.teams.game.feePerPerson || 0)
                    : (reg.game ? reg.game.feePerPerson : (reg.tournament_games && reg.tournament_games.fee_per_person || 0));
                var gameName   = reg.game ? reg.game.name : (reg.tournament_games && reg.tournament_games.game_name || 'N/A');
                var tourneyName = reg.game ? reg.game.tournamentTitle : (reg.tournament_games && reg.tournament_games.tournaments && reg.tournament_games.tournaments.title || 'N/A');

                var actionHtml = (statusText === 'PENDING' || statusText === 'UNPAID')
                    ? '<button onclick="openBkashModal(' + (fee || 0) + ')" style="padding:6px 12px;background:#e2136e;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Pay Now</button>'
                    : '<span style="color:#6b7280;font-size:12px;">Paid</span>';

                html += '<tr style="border-bottom:1px solid #f3f4f6;">'
                      + '<td style="padding:12px;">' + gameName + '</td>'
                      + '<td style="padding:12px;">' + tourneyName + '</td>'
                      + '<td style="padding:12px;"><span style="padding:4px 8px;border-radius:4px;background:' + statusColor + '20;color:' + statusColor + ';font-size:12px;font-weight:600;">' + statusText + '</span></td>'
                      + '<td style="padding:12px;">৳' + fee + '</td>'
                      + '<td style="padding:12px;text-align:right;">' + actionHtml + '</td>'
                      + '</tr>';
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p>Failed to load registrations.</p>';
        }
    } catch (err) {
        console.error('Error loading payment history:', err);
        container.innerHTML = '<p>Error loading payment history.</p>';
    }
}
