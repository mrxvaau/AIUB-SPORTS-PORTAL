/**
 * AIUB Sports Portal - Admin Management Module
 * Handles admin/moderator roles, permissions, and audit logs
 */

/**
 * Load admin management interface
 */
async function loadAdminManagement() {
    await loadUsersForPromotion();
    await loadAvailableRoles();
    await loadAvailablePermissions();
    await loadAdmins();
    await loadAuditLogs();
    await loadTournamentRequests();
    await loadGameRequests();
}

/**
 * Load users for admin promotion dropdown
 */
async function loadUsersForPromotion() {
    try {
        const response = await fetch(`${API_URL}/users/all`);
        const data = await response.json();

        const selectUser = document.getElementById('selectUser');

        if (data.success && data.users) {
            selectUser.innerHTML = '<option value="">Select a user</option>';
            data.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.full_name || user.student_id} (${user.email})`;
                selectUser.appendChild(option);
            });
        } else {
            selectUser.innerHTML = '<option value="">No users found</option>';
        }
    } catch (error) {
        console.error('Load users error:', error);
        document.getElementById('selectUser').innerHTML = '<option value="">Error loading users</option>';
    }
}

/**
 * Load all available roles
 */
async function loadAvailableRoles() {
    try {
        const response = await fetch(`${API_URL}/admin/roles`, {
            headers: {
                'x-user-email': localStorage.getItem('userEmail') || ''
            }
        });
        const data = await response.json();

        const selectRole = document.getElementById('selectRole');
        const selectRoleForPermission = document.getElementById('selectRoleForPermission');

        if (data.success && data.roles) {
            selectRole.innerHTML = '<option value="">Select a role</option>';
            if (selectRoleForPermission) {
                selectRoleForPermission.innerHTML = '<option value="">Select a role</option>';
            }

            data.roles.forEach(role => {
                const option = document.createElement('option');
                option.value = role.id;
                option.textContent = role.role_name;
                selectRole.appendChild(option);

                if (selectRoleForPermission) {
                    const option2 = document.createElement('option');
                    option2.value = role.id;
                    option2.textContent = role.role_name;
                    selectRoleForPermission.appendChild(option2);
                }
            });
        } else {
            selectRole.innerHTML = '<option value="">No roles found</option>';
        }
    } catch (error) {
        console.error('Load roles error:', error);
        document.getElementById('selectRole').innerHTML = '<option value="">Error loading roles</option>';
    }
}

/**
 * Load all available permissions
 */
async function loadAvailablePermissions() {
    try {
        const response = await fetch(`${API_URL}/admin/permissions`, {
            headers: {
                'x-user-email': localStorage.getItem('userEmail') || ''
            }
        });
        const data = await response.json();

        const selectPermission = document.getElementById('selectPermission');

        if (data.success && data.permissions) {
            selectPermission.innerHTML = '<option value="">Select a permission</option>';
            data.permissions.forEach(permission => {
                const option = document.createElement('option');
                option.value = permission.id;
                option.textContent = permission.permission_name;
                selectPermission.appendChild(option);
            });
        } else {
            selectPermission.innerHTML = '<option value="">No permissions found</option>';
        }
    } catch (error) {
        console.error('Load permissions error:', error);
        document.getElementById('selectPermission').innerHTML = '<option value="">Error loading permissions</option>';
    }
}

/**
 * Load all moderators
 */
async function loadModerators() {
    try {
        const response = await fetch(`${API_URL}/admin/moderators`, {
            headers: {
                'x-user-email': localStorage.getItem('userEmail') || ''
            }
        });
        const data = await response.json();

        const moderatorsList = document.getElementById('moderatorsList');

        if (data.success && data.moderators) {
            if (data.moderators.length === 0) {
                moderatorsList.innerHTML = '<p>No moderators found.</p>';
                return;
            }

            let html = '';
            data.moderators.forEach(moderator => {
                html += `
                    <div class="moderator-item">
                        <div>
                            <strong>${moderator.user_info?.full_name || moderator.user_info?.student_id || 'N/A'}</strong>
                            <br>
                            <small>${moderator.user_info?.email || 'N/A'}</small>
                            <br>
                            <small>Permissions: ${Object.entries(moderator.permissions)
                        .filter(([key, value]) => value)
                        .map(([key]) => key.replace(/([A-Z])/g, ' $1').trim())
                        .join(', ') || 'None'
                    }</small>
                        </div>
                        <div class="moderator-actions">
                            <button class="demote-btn" onclick="demoteModerator(${moderator.user_id})">
                                Demote
                            </button>
                        </div>
                    </div>
                `;
            });

            moderatorsList.innerHTML = html;
        } else {
            moderatorsList.innerHTML = '<p>Error loading moderators.</p>';
        }
    } catch (error) {
        console.error('Load moderators error:', error);
        document.getElementById('moderatorsList').innerHTML = '<p>Error loading moderators.</p>';
    }
}

/**
 * Load all admins
 */
async function loadAdmins() {
    try {
        const response = await fetch(`${API_URL}/admin/moderators`, {
            headers: {
                'x-user-email': localStorage.getItem('userEmail') || ''
            }
        });
        const data = await response.json();

        const adminsList = document.getElementById('moderatorsList');

        if (data.success && data.moderators) {
            if (data.moderators.length === 0) {
                adminsList.innerHTML = '<p>No admins found.</p>';
                return;
            }

            let html = '';
            data.moderators.forEach(admin => {
                html += `
                    <div class="moderator-item">
                        <div>
                            <strong>${admin.user_info?.full_name || admin.user_info?.student_id || 'N/A'}</strong>
                            <br>
                            <small>${admin.user_info?.email || 'N/A'}</small>
                            <br>
                            <small>Roles: ${admin.roles?.join(', ') || 'None'}</small>
                            <br>
                            <small>Permissions: ${Object.entries(admin.permissions)
                        .filter(([key, value]) => value)
                        .map(([key]) => key.replace(/([A-Z])/g, ' $1').trim())
                        .join(', ') || 'None'
                    }</small>
                        </div>
                        <div class="moderator-actions">
                            <button class="demote-btn" onclick="demoteAdmin(${admin.user_id})">
                                Remove Role
                            </button>
                        </div>
                    </div>
                `;
            });

            adminsList.innerHTML = html;
        } else {
            adminsList.innerHTML = '<p>Error loading admins.</p>';
        }
    } catch (error) {
        console.error('Load admins error:', error);
        document.getElementById('moderatorsList').innerHTML = '<p>Error loading admins.</p>';
    }
}

/**
 * Load audit logs
 */
async function loadAuditLogs() {
    try {
        const response = await fetch(`${API_URL}/admin/audit-logs`, {
            headers: {
                'x-user-email': localStorage.getItem('userEmail') || ''
            }
        });
        const data = await response.json();

        const logsList = document.getElementById('auditLogsList');

        if (data.success && data.logs) {
            if (data.logs.length === 0) {
                logsList.innerHTML = '<p>No audit logs found.</p>';
                return;
            }

            let html = '';
            data.logs.forEach(log => {
                html += `
                    <div class="moderator-item">
                        <div>
                            <strong>${log.admin?.full_name || 'Unknown Admin'}</strong>
                            <br>
                            <small>Action: ${log.action}</small>
                            <br>
                            <small>Target: ${log.target.type} #${log.target.id}</small>
                            <br>
                            <small>Time: ${new Date(log.timestamp).toLocaleString()}</small>
                        </div>
                    </div>
                `;
            });

            logsList.innerHTML = html;
        } else {
            logsList.innerHTML = '<p>Error loading audit logs.</p>';
        }
    } catch (error) {
        console.error('Load audit logs error:', error);
        document.getElementById('auditLogsList').innerHTML = '<p>Error loading audit logs.</p>';
    }
}

/**
 * Load tournament requests
 */
async function loadTournamentRequests() {
    try {
        const response = await fetch(`${API_URL}/admin/tournament-requests`, {
            headers: {
                'x-user-email': localStorage.getItem('userEmail') || ''
            }
        });
        const data = await response.json();

        const requestsList = document.getElementById('tournamentRequestsList');

        if (data.success && data.requests) {
            if (data.requests.length === 0) {
                requestsList.innerHTML = '<p>No tournament requests found.</p>';
                return;
            }

            let html = '';
            data.requests.forEach(request => {
                html += `
                    <div class="moderator-item">
                        <div>
                            <strong>${request.title}</strong>
                            <br>
                            <small>Requested by: ${request.requested_by.full_name}</small>
                            <br>
                            <small>Status: ${request.status}</small>
                            <br>
                            <small>Deadline: ${new Date(request.registration_deadline).toLocaleString()}</small>
                            ${request.description ? `<small>Description: ${request.description}</small>` : ''}
                        </div>
                    </div>
                `;
            });

            requestsList.innerHTML = html;
        } else {
            requestsList.innerHTML = '<p>Error loading tournament requests.</p>';
        }
    } catch (error) {
        console.error('Load tournament requests error:', error);
        document.getElementById('tournamentRequestsList').innerHTML = '<p>Error loading tournament requests.</p>';
    }
}

/**
 * Load game requests
 */
async function loadGameRequests() {
    try {
        const response = await fetch(`${API_URL}/admin/game-requests`, {
            headers: {
                'x-user-email': localStorage.getItem('userEmail') || ''
            }
        });
        const data = await response.json();

        const requestsList = document.getElementById('gameRequestsList');

        if (data.success && data.requests) {
            if (data.requests.length === 0) {
                requestsList.innerHTML = '<p>No game requests found.</p>';
                return;
            }

            let html = '';
            data.requests.forEach(request => {
                html += `
                    <div class="moderator-item">
                        <div>
                            <strong>${request.game_name}</strong>
                            <br>
                            <small>Tournament: ${request.tournament_id}</small>
                            <br>
                            <small>Category: ${request.category}</small>
                            <br>
                            <small>Type: ${request.game_type}</small>
                            <br>
                            <small>Status: ${request.status}</small>
                        </div>
                    </div>
                `;
            });

            requestsList.innerHTML = html;
        } else {
            requestsList.innerHTML = '<p>Error loading game requests.</p>';
        }
    } catch (error) {
        console.error('Load game requests error:', error);
        document.getElementById('gameRequestsList').innerHTML = '<p>Error loading game requests.</p>';
    }
}

/**
 * Assign role to admin
 */
async function assignRoleToAdmin() {
    try {
        const userId = document.getElementById('selectUser').value;
        const roleId = document.getElementById('selectRole').value;

        if (!userId) {
            alert('Please select a user to assign a role.');
            return;
        }

        if (!roleId) {
            alert('Please select a role to assign.');
            return;
        }

        const response = await fetch(`${API_URL}/admin/assign-role`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-email': localStorage.getItem('userEmail') || ''
            },
            body: JSON.stringify({
                admin_id: parseInt(userId),
                role_name: roleId
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('Role assigned to admin successfully!');
            loadAdminManagement();
            document.getElementById('selectUser').value = '';
            document.getElementById('selectRole').value = '';
        } else {
            alert(`Error assigning role: ${result.message}`);
        }
    } catch (error) {
        console.error('Assign role error:', error);
        alert('Error assigning role. Please try again.');
    }
}

/**
 * Assign permission to role
 */
async function assignPermissionToRole() {
    try {
        const roleId = document.getElementById('selectRoleForPermission').value;
        const permissionId = document.getElementById('selectPermission').value;

        if (!roleId) {
            alert('Please select a role to assign a permission.');
            return;
        }

        if (!permissionId) {
            alert('Please select a permission to assign.');
            return;
        }

        const response = await fetch(`${API_URL}/admin/assign-permission`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-email': localStorage.getItem('userEmail') || ''
            },
            body: JSON.stringify({
                role_id: parseInt(roleId),
                permission_id: parseInt(permissionId)
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('Permission assigned to role successfully!');
            document.getElementById('selectRoleForPermission').value = '';
            document.getElementById('selectPermission').value = '';
        } else {
            alert(`Error assigning permission: ${result.message}`);
        }
    } catch (error) {
        console.error('Assign permission error:', error);
        alert('Error assigning permission. Please try again.');
    }
}

/**
 * Demote admin (remove role)
 * @param {number} userId - User ID
 */
async function demoteAdmin(userId) {
    if (!confirm('Are you sure you want to remove this user from admin role?')) {
        return;
    }

    try {
        const userEmail = localStorage.getItem('userEmail');
        const roleId = prompt('Enter the role ID to remove:');
        if (!roleId) {
            return;
        }

        const response = await fetch(`${API_URL}/admin/remove-role/${userId}/${roleId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-user-email': userEmail || '',
                'X-User-Email': userEmail || ''
            }
        });

        const result = await response.json();

        if (result.success) {
            alert('Admin role removed successfully!');
            loadAdminManagement();
        } else {
            alert(`Error removing admin role: ${result.message}`);
        }
    } catch (error) {
        console.error('Demote admin error:', error);
        alert('Error removing admin role. Please try again.');
    }
}

/**
 * Demote moderator
 * @param {number} userId - User ID
 */
async function demoteModerator(userId) {
    if (!confirm('Are you sure you want to demote this user from moderator?')) {
        return;
    }

    try {
        const userEmail = localStorage.getItem('userEmail');

        const response = await fetch(`${API_URL}/admin/demote-moderator/${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-user-email': userEmail || '',
                'X-User-Email': userEmail || ''
            }
        });

        const result = await response.json();

        if (result.success) {
            alert('User demoted successfully!');
            loadAdminManagement();
        } else {
            alert(`Error demoting user: ${result.message}`);
        }
    } catch (error) {
        console.error('Demote user error:', error);
        alert('Error demoting user. Please try again.');
    }
}
