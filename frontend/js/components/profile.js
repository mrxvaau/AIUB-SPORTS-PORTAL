/**
 * profile.js  — Home section: load & edit user profile
 * Depends on: API_URL, authFetch (globals from api-config.js / auth-fetch.js)
 */

var currentUser = null;
var originalData = null;
var isEditing = false;

// ── Load profile from API ─────────────────────────────────────
async function loadProfile() {
    try {
        var studentId = localStorage.getItem('studentId');
        var email     = localStorage.getItem('userEmail');

        if (!studentId || !email) {
            window.location.href = 'login.html';
            return;
        }

        // Admin check
        try {
            var adminRes  = await authFetch(API_URL + '/admin/check-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });
            var adminData = await adminRes.json();
            if (adminData.success && adminData.isAdmin === true) {
                document.getElementById('adminBtn').style.display = 'block';
                localStorage.setItem('isAdmin', 'true');
                localStorage.setItem('adminRole', adminData.role || 'ADMIN');
            } else {
                document.getElementById('adminBtn').style.display = 'none';
                localStorage.removeItem('isAdmin');
                localStorage.removeItem('adminRole');
            }
        } catch (e) {
            document.getElementById('adminBtn').style.display = 'none';
            localStorage.removeItem('isAdmin');
            localStorage.removeItem('adminRole');
        }

        var res  = await authFetch(API_URL + '/dashboard/profile/' + studentId);
        var data = await res.json();

        if (data.success && data.profile) {
            currentUser  = data.profile;
            originalData = Object.assign({}, data.profile);
            displayProfile(data.profile);
            updateUserPhotoUI(data.profile);
        }
    } catch (err) {
        console.error('Error loading profile:', err);
        showAlert('Error loading profile', 'error');
    }
}

// ── Render profile fields ────────────────────────────────────
function displayProfile(user) {
    document.getElementById('studentId').value    = user.student_id    || '';
    document.getElementById('email').value        = user.email         || '';
    document.getElementById('fullName').value     = user.full_name     || '';
    document.getElementById('gender').value       = user.gender        || '';
    document.getElementById('phoneNumber').value  = user.phone_number  || '';
    document.getElementById('bloodGroup').value   = user.blood_group   || '';
    document.getElementById('programLevel').value = user.program_level || '';
    document.getElementById('department').value   = user.department    || '';
    updateUserPhotoUI(user);
    updateNameBadge(user.name_edit_count || 0);
}

function updateNameBadge(editCount) {
    var badge     = document.getElementById('nameBadge');
    var remaining = 3 - editCount;
    if (editCount >= 3) {
        badge.className   = 'locked-badge';
        badge.textContent = 'LOCKED';
    } else if (editCount > 0) {
        badge.className   = 'editable-badge';
        badge.textContent = remaining + ' EDIT' + (remaining > 1 ? 'S' : '') + ' LEFT';
    } else {
        badge.className   = 'editable-badge';
        badge.textContent = 'EDITABLE';
    }
}

// ── Update avatar / sidebar card ────────────────────────────
function updateUserPhotoUI(user) {
    var FALLBACK = 'images/logo.svg';
    var photoUrl = user.profile_photo_url
        || localStorage.getItem('profilePhotoUrl')
        || FALLBACK;

    var navImg  = document.getElementById('navAvatarImg');
    var navName = document.getElementById('navAvatarName');
    if (navImg)  { navImg.src = photoUrl; navImg.onerror = function(){ navImg.src = FALLBACK; }; }
    if (navName) { navName.textContent = (user.full_name || user.student_id || 'User').split(' ')[0]; }

    var sideImg  = document.getElementById('sidebarUserPhoto');
    var sideName = document.getElementById('sidebarUserName');
    var sideRole = document.getElementById('sidebarUserRole');
    if (sideImg)  { sideImg.src = photoUrl; sideImg.onerror = function(){ sideImg.src = FALLBACK; }; }
    if (sideName) { sideName.textContent = user.full_name || user.student_id || 'User'; }
    if (sideRole) {
        var roleMap = { student: 'Student', faculty: 'Faculty', official: 'Official' };
        sideRole.textContent = roleMap[user.role] || (user.role || 'Member');
    }
}

// ── Edit / Save / Cancel ────────────────────────────────────
function enableEdit() {
    isEditing = true;
    document.querySelector('.player-info-grid').classList.add('editing');
    var nameEditCount = currentUser.name_edit_count || 0;
    if (nameEditCount < 3) {
        document.getElementById('fullName').disabled = false;
    } else {
        document.getElementById('nameWarning').textContent = '❌ Name edit limit reached!';
        document.getElementById('nameWarning').classList.remove('hidden');
    }
    document.getElementById('phoneNumber').disabled = false;
    document.getElementById('bloodGroup').disabled  = false;
    document.getElementById('editButtons').classList.add('hidden');
    document.getElementById('saveButtons').classList.remove('hidden');
}

function cancelEdit() {
    isEditing = false;
    displayProfile(originalData);
    document.querySelector('.player-info-grid').classList.remove('editing');
    document.getElementById('fullName').disabled    = true;
    document.getElementById('phoneNumber').disabled = true;
    document.getElementById('bloodGroup').disabled  = true;
    document.getElementById('editButtons').classList.remove('hidden');
    document.getElementById('saveButtons').classList.add('hidden');
    document.getElementById('nameWarning').classList.add('hidden');
}

async function saveProfile() {
    try {
        var studentId = localStorage.getItem('studentId');
        var formData  = {
            fullName:     document.getElementById('fullName').value.trim(),
            gender:       currentUser.gender,
            phoneNumber:  document.getElementById('phoneNumber').value.trim(),
            bloodGroup:   document.getElementById('bloodGroup').value,
            programLevel: currentUser.program_level,
            department:   currentUser.department,
            isFirstTime:  false
        };

        if (!formData.fullName || !formData.phoneNumber || !formData.bloodGroup) {
            showAlert('Please fill in all required fields', 'error');
            return;
        }

        var saveBtn      = document.querySelector('.save-btn');
        var originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
        saveBtn.disabled  = true;

        var res  = await authFetch(API_URL + '/user/profile/' + studentId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        var data = await res.json();

        if (data.success) {
            showAlert('Profile updated successfully!', 'success');
            currentUser  = data.user;
            originalData = Object.assign({}, data.user);
            displayProfile(data.user);
            cancelEdit();
        } else {
            showAlert(data.message || 'Failed to update profile', 'error');
        }
        saveBtn.innerHTML = originalText;
        saveBtn.disabled  = false;
    } catch (err) {
        console.error('Update error:', err);
        showAlert('Connection error. Please try again.', 'error');
    }
}

// ── Alert helper ────────────────────────────────────────────
function showAlert(message, type) {
    var alertBox = document.getElementById('alertBox');
    alertBox.className   = 'alert alert-' + type;
    alertBox.textContent = message;
    alertBox.classList.remove('hidden');
    setTimeout(function(){ alertBox.classList.add('hidden'); }, 5000);
}
