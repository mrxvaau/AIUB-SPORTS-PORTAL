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
                container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-2);">No registrations found.</p>';
                return;
            }

            // Sort newest first
            data.registrations.sort(function(a, b) {
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });

            var html = '<div style="overflow-x:auto;">'
                     + '<table style="width:100%;border-collapse:collapse;background:var(--bg-surface,rgba(255,255,255,0.04));border:1px solid var(--glass-border,rgba(255,255,255,0.08));border-radius:12px;overflow:hidden;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,.1));">'
                     + '<thead style="background:var(--bg-surface-2,rgba(255,255,255,0.07));border-bottom:1px solid var(--glass-border-2,rgba(255,255,255,0.12));"><tr>'
                     + '<th style="padding:14px 12px;text-align:left;font-weight:600;color:var(--text-2,#6b7280);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Game</th>'
                     + '<th style="padding:14px 12px;text-align:left;font-weight:600;color:var(--text-2,#6b7280);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Tournament</th>'
                     + '<th style="padding:14px 12px;text-align:left;font-weight:600;color:var(--text-2,#6b7280);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Status</th>'
                     + '<th style="padding:14px 12px;text-align:left;font-weight:600;color:var(--text-2,#6b7280);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Amount</th>'
                     + '<th style="padding:14px 12px;text-align:right;font-weight:600;color:var(--text-2,#6b7280);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Action</th>'
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
                    ? '<button onclick="openBkashModal(' + (fee || 0) + ')" style="padding:6px 14px;background:#e2136e;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;">Pay Now</button>'
                    : (fee > 0
                        ? '<span style="color:var(--success,#10b981);font-size:12px;font-weight:600;">✓ Paid</span>'
                        : '<span style="color:var(--success,#10b981);font-size:12px;font-weight:600;">✓ Free</span>');

                html += '<tr style="border-bottom:1px solid var(--glass-border,rgba(255,255,255,0.08));transition:background 0.15s;"'
                      + ' onmouseenter="this.style.background=\'var(--bg-surface-2,rgba(255,255,255,0.07))\'"'
                      + ' onmouseleave="this.style.background=\'transparent\'">'
                      + '<td style="padding:14px 12px;color:var(--text-1,#f1f5f9);font-weight:500;">' + gameName + '</td>'
                      + '<td style="padding:14px 12px;color:var(--text-2,rgba(255,255,255,0.65));">' + tourneyName + '</td>'
                      + '<td style="padding:14px 12px;"><span style="padding:4px 10px;border-radius:6px;background:' + statusColor + '18;color:' + statusColor + ';font-size:12px;font-weight:600;border:1px solid ' + statusColor + '30;">' + statusText + '</span></td>'
                      + '<td style="padding:14px 12px;color:var(--text-1,#f1f5f9);font-weight:600;">' + (fee > 0 ? '৳' + fee : '<span style="color:var(--success,#10b981);">Free</span>') + '</td>'
                      + '<td style="padding:14px 12px;text-align:right;">' + actionHtml + '</td>'
                      + '</tr>';
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p style="color:var(--text-2);">Failed to load registrations.</p>';
        }
    } catch (err) {
        console.error('Error loading payment history:', err);
        container.innerHTML = '<p style="color:var(--danger,#ef4444);">Error loading payment history.</p>';
    }
}
