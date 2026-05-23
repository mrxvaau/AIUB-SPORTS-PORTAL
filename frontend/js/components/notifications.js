/**
 * notifications.js  — Notification modal + inline section
 * Depends on: API_URL, authFetch
 */

// ── Popup Modal ──────────────────────────────────────────────
async function openNotificationsModal() {
    try {
        var studentId  = localStorage.getItem('studentId');
        var res        = await authFetch(API_URL + '/user/notifications/' + studentId + '?t=' + Date.now());
        var data       = await res.json();

        if (data.success) {
            var list = document.getElementById('notificationList');
            if (data.notifications.length === 0) {
                list.innerHTML = '<p>No notifications found.</p>';
            } else {
                list.innerHTML = data.notifications.map(_buildNotifHtml).join('');
                var unread = data.notifications.filter(function(n){ return n.status === 'UNREAD'; }).length;
                document.getElementById('notificationCount').textContent = unread;
            }
        } else {
            document.getElementById('notificationList').innerHTML = '<p>Error loading notifications.</p>';
        }
        document.getElementById('notificationsModal').style.display = 'flex';
    } catch (err) {
        console.error('Error loading notifications:', err);
        document.getElementById('notificationList').innerHTML = '<p>Error loading notifications.</p>';
    }
}

function closeNotificationsModal() {
    document.getElementById('notificationsModal').style.display = 'none';
}

// ── Sidebar Section ──────────────────────────────────────────
async function loadNotificationsView() {
    var container = document.getElementById('notificationContent');
    container.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div><p>Loading notifications...</p></div>';

    try {
        var studentId = localStorage.getItem('studentId');
        var res       = await authFetch(API_URL + '/user/notifications/' + studentId);
        var data      = await res.json();

        if (data.success) {
            if (data.notifications.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:40px;color:#6b7280;"><p>No notifications found.</p></div>';
                return;
            }
            data.notifications.sort(function(a,b){ return new Date(b.created_at||0) - new Date(a.created_at||0); });
            container.innerHTML = data.notifications.map(_buildNotifHtml).join('');

            var unread = data.notifications.filter(function(n){ return n.status === 'UNREAD'; }).length;
            document.getElementById('notificationCount').textContent = unread;
        } else {
            container.innerHTML = '<p style="text-align:center;color:#ef4444;">Failed to load notifications.</p>';
        }
    } catch (err) {
        console.error('Error loading notifications:', err);
        container.innerHTML = '<p style="text-align:center;color:#ef4444;">Error loading notifications.</p>';
    }
}

function markNotificationAsReadForSection(notificationId) {
    markNotificationAsRead(notificationId).then(function(){ loadNotificationsView(); });
}

// ── Shared notification HTML builder ────────────────────────
function _buildNotifHtml(n) {
    var date     = new Date(n.created_at).toLocaleString();
    var isUnread = n.status === 'UNREAD';
    var actionHtml = '';

    if (n.type === 'TEAM_REQUEST') {
        if (n.action_taken === 'ACCEPTED') {
            actionHtml = '<span style="font-size:12px;color:#10b981;font-weight:600;">✓ Invitation Accepted</span>';
        } else if (n.action_taken === 'DECLINED') {
            actionHtml = '<span style="font-size:12px;color:#ef4444;font-weight:600;">✕ Invitation Declined</span>';
        } else if (isUnread && !n.action_taken) {
            actionHtml = '<button class="notification-btn accept-btn" onclick="acceptTeamInvitation(' + n.id + ')">Accept</button>'
                       + '<button class="notification-btn decline-btn" onclick="declineTeamInvitation(' + n.id + ')">Decline</button>';
        } else {
            actionHtml = '<span style="font-size:12px;color:#6b7280;">Processed</span>';
        }
    } else if (isUnread) {
        actionHtml = '<button class="notification-btn mark-read-btn" onclick="markNotificationAsRead(' + n.id + ')">Mark as Read</button>';
    }

    return '<div class="notification-item ' + (isUnread ? 'unread' : '') + '" data-id="' + n.id + '">'
         + '<div class="notification-title">' + n.title + '</div>'
         + '<div class="notification-message">' + n.message + '</div>'
         + '<div class="notification-date">' + date + '</div>'
         + '<div class="notification-actions">' + actionHtml + '</div>'
         + '</div>';
}

// ── Mark as read ────────────────────────────────────────────
async function markNotificationAsRead(notificationId) {
    try {
        var res  = await authFetch(API_URL + '/user/notifications/' + notificationId + '/read', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        var data = await res.json();
        if (data.success) {
            var el = document.querySelector('[data-id="' + notificationId + '"]');
            if (el) {
                el.classList.remove('unread');
                var btn = el.querySelector('.mark-read-btn');
                if (btn) btn.remove();
                var countEl = document.getElementById('notificationCount');
                countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
            }
        }
    } catch (err) {
        console.error('Error marking notification as read:', err);
    }
}

// ── Helper: update action UI in both popup + section ────────
function updateNotificationActionUI(notificationId, actionHtml, isUnread) {
    ['notificationList', 'notificationContent'].forEach(function(cId) {
        var c = document.getElementById(cId);
        if (!c) return;
        var actionsEl = c.querySelector('[data-id="' + notificationId + '"] .notification-actions');
        if (actionsEl) actionsEl.innerHTML = actionHtml;
        if (isUnread) {
            var notifEl = c.querySelector('[data-id="' + notificationId + '"]');
            if (notifEl) notifEl.classList.remove('unread');
        }
    });
}

// ── Team invitation accept / decline ────────────────────────
async function acceptTeamInvitation(notificationId) {
    updateNotificationActionUI(notificationId, '<span style="font-size:12px;color:#6b7280;">Processing...</span>', false);
    try {
        var studentId = localStorage.getItem('studentId');
        var res  = await authFetch(API_URL + '/teams/invitations/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, notificationId: notificationId })
        });
        var data = await res.json();
        if (data.success || (data.message && data.message.toLowerCase().includes('already processed'))) {
            updateNotificationActionUI(notificationId, '<span style="font-size:12px;color:#10b981;font-weight:600;">✓ Invitation Accepted</span>', true);
            var countEl = document.getElementById('notificationCount');
            countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
        } else {
            alert('Error accepting invitation: ' + data.message);
            var restore = '<button class="notification-btn accept-btn" onclick="acceptTeamInvitation(' + notificationId + ')">Accept</button>'
                        + '<button class="notification-btn decline-btn" onclick="declineTeamInvitation(' + notificationId + ')">Decline</button>';
            updateNotificationActionUI(notificationId, restore, false);
        }
    } catch (err) {
        console.error('Error accepting invitation:', err);
        alert('Error accepting team invitation. Please try again.');
    }
}

async function declineTeamInvitation(notificationId) {
    if (!confirm('Are you sure you want to decline this team invitation?')) return;
    updateNotificationActionUI(notificationId, '<span style="font-size:12px;color:#6b7280;">Processing...</span>', false);
    try {
        var studentId = localStorage.getItem('studentId');
        var res  = await authFetch(API_URL + '/teams/invitations/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: studentId, notificationId: notificationId })
        });
        var data = await res.json();
        if (data.success || (data.message && data.message.toLowerCase().includes('already processed'))) {
            updateNotificationActionUI(notificationId, '<span style="font-size:12px;color:#ef4444;font-weight:600;">✕ Invitation Declined</span>', true);
            var countEl = document.getElementById('notificationCount');
            countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
        } else {
            alert('Error declining invitation: ' + data.message);
            var restore = '<button class="notification-btn accept-btn" onclick="acceptTeamInvitation(' + notificationId + ')">Accept</button>'
                        + '<button class="notification-btn decline-btn" onclick="declineTeamInvitation(' + notificationId + ')">Decline</button>';
            updateNotificationActionUI(notificationId, restore, false);
        }
    } catch (err) {
        console.error('Error declining invitation:', err);
        alert('Error declining team invitation. Please try again.');
    }
}
