/**
 * messaging.js  — Message & Bug Report forms + submissions list
 * Depends on: API_URL, authFetch
 */

// ── Shared file validator ────────────────────────────────────
function validateFile(input, infoElId) {
    var infoEl = document.getElementById(infoElId);
    if (!input.files || !input.files[0]) { infoEl.textContent = ''; return; }
    var file = input.files[0];
    if (file.size > 10 * 1024 * 1024) {
        infoEl.textContent = '❌ File exceeds 10 MB limit.';
        input.value = '';
        return;
    }
    infoEl.textContent = '✓ ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)';
}

// ── Toast helper ─────────────────────────────────────────────
function _showToast(elId, message, success) {
    var el = document.getElementById(elId);
    el.textContent    = message;
    el.style.background  = success ? '#ecfdf5' : '#fef2f2';
    el.style.color       = success ? '#065f46' : '#dc2626';
    el.style.border      = '1px solid ' + (success ? '#6ee7b7' : '#fca5a5');
    el.style.display     = 'block';
    setTimeout(function(){ el.style.display = 'none'; }, 5000);
}

// ──────────────────────────────────────────────────────────────
// MESSAGE SECTION
// ──────────────────────────────────────────────────────────────
async function submitMessage(e) {
    e.preventDefault();
    var submitBtn   = document.getElementById('msg-submit-btn');
    var origText    = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled    = true;

    try {
        var formData = new FormData();
        formData.append('name',    document.getElementById('msg-name').value.trim());
        formData.append('email',   document.getElementById('msg-email').value.trim());
        formData.append('subject', document.getElementById('msg-subject').value.trim());
        formData.append('body',    document.getElementById('msg-body').value.trim());
        var fileInput = document.getElementById('msg-file');
        if (fileInput.files[0]) formData.append('attachment', fileInput.files[0]);

        var res  = await authFetch(API_URL + '/messages', { method: 'POST', body: formData });
        var data = await res.json();
        if (data.success) {
            _showToast('msg-toast', '✓ Message sent successfully!', true);
            document.getElementById('msgForm').reset();
            document.getElementById('msg-file-info').textContent = '';
            loadMyMessages();
        } else {
            _showToast('msg-toast', '❌ ' + (data.message || 'Failed to send message.'), false);
        }
    } catch (err) {
        console.error('Submit message error:', err);
        _showToast('msg-toast', '❌ Error sending message. Please try again.', false);
    } finally {
        submitBtn.textContent = origText;
        submitBtn.disabled    = false;
    }
}

async function loadMyMessages() {
    var listEl    = document.getElementById('my-messages-list');
    var studentId = localStorage.getItem('studentId');
    var email     = localStorage.getItem('userEmail');
    if (!listEl) return;
    listEl.innerHTML = '<p style="color:#9ca3af;font-size:13px;">Loading...</p>';

    try {
        var res  = await authFetch(API_URL + '/messages/my?email=' + encodeURIComponent(email || ''));
        var data = await res.json();
        if (data.success && data.messages && data.messages.length > 0) {
            listEl.innerHTML = data.messages.map(function(m) {
                return '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">'
                     + '<div style="font-size:13px;font-weight:600;color:#111;">' + (m.subject || 'No Subject') + '</div>'
                     + '<div style="font-size:12px;color:#6b7280;margin-top:4px;">' + new Date(m.created_at).toLocaleString() + '</div>'
                     + '<div style="font-size:13px;color:#374151;margin-top:8px;">' + (m.body || '') + '</div>'
                     + '</div>';
            }).join('');
        } else {
            listEl.innerHTML = '<p style="color:#9ca3af;font-size:13px;">No messages yet.</p>';
        }
    } catch (err) {
        console.error('Load messages error:', err);
        listEl.innerHTML = '<p style="color:#ef4444;font-size:13px;">Error loading messages.</p>';
    }
}

// ──────────────────────────────────────────────────────────────
// BUG REPORT SECTION
// ──────────────────────────────────────────────────────────────
async function submitBugReport(e) {
    e.preventDefault();
    var submitBtn   = document.getElementById('bug-submit-btn');
    var origText    = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled    = true;

    try {
        var formData = new FormData();
        formData.append('name',        document.getElementById('bug-name').value.trim());
        formData.append('email',       document.getElementById('bug-email').value.trim());
        formData.append('category',    document.getElementById('bug-category').value);
        formData.append('severity',    document.getElementById('bug-severity').value);
        formData.append('title',       document.getElementById('bug-title').value.trim());
        formData.append('description', document.getElementById('bug-desc').value.trim());
        formData.append('steps',       document.getElementById('bug-steps').value.trim());
        var fileInput = document.getElementById('bug-file');
        if (fileInput.files[0]) formData.append('attachment', fileInput.files[0]);

        var res  = await authFetch(API_URL + '/bug-reports', { method: 'POST', body: formData });
        var data = await res.json();
        if (data.success) {
            _showToast('bug-toast', '✓ Bug report submitted! Thank you.', true);
            document.getElementById('bugForm').reset();
            document.getElementById('bug-file-info').textContent = '';
            loadMyBugReports();
        } else {
            _showToast('bug-toast', '❌ ' + (data.message || 'Failed to submit report.'), false);
        }
    } catch (err) {
        console.error('Submit bug error:', err);
        _showToast('bug-toast', '❌ Error submitting report. Please try again.', false);
    } finally {
        submitBtn.textContent = origText;
        submitBtn.disabled    = false;
    }
}

async function loadMyBugReports() {
    var listEl = document.getElementById('my-bugs-list');
    var email  = localStorage.getItem('userEmail');
    if (!listEl) return;
    listEl.innerHTML = '<p style="color:#9ca3af;font-size:13px;">Loading...</p>';

    try {
        var res  = await authFetch(API_URL + '/bug-reports/my?email=' + encodeURIComponent(email || ''));
        var data = await res.json();
        if (data.success && data.reports && data.reports.length > 0) {
            var severityColors = { low: '#10b981', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
            listEl.innerHTML = data.reports.map(function(r) {
                var color = severityColors[r.severity] || '#6b7280';
                return '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">'
                     + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
                     + '<span style="font-size:13px;font-weight:600;color:#111;">' + (r.title || 'Bug Report') + '</span>'
                     + '<span style="font-size:11px;padding:2px 8px;border-radius:9999px;background:' + color + '20;color:' + color + ';font-weight:600;">' + (r.severity || '').toUpperCase() + '</span>'
                     + '</div>'
                     + '<div style="font-size:12px;color:#6b7280;">' + new Date(r.created_at).toLocaleString() + '</div>'
                     + '<div style="font-size:13px;color:#374151;margin-top:8px;">' + (r.description || '') + '</div>'
                     + '</div>';
            }).join('');
        } else {
            listEl.innerHTML = '<p style="color:#9ca3af;font-size:13px;">No bug reports submitted yet.</p>';
        }
    } catch (err) {
        console.error('Load bug reports error:', err);
        listEl.innerHTML = '<p style="color:#ef4444;font-size:13px;">Error loading bug reports.</p>';
    }
}
