// Authentication & Profile Controller
// Handles user authentication, profile management, and admin checks

const { supabase } = require('../config/supabase');

// Email validation regex
const EMAIL_PATTERN = /^\d{2}-\d{5}-\d@student\.aiub\.edu$/;

// Validate AIUB email format
function validateEmail(email) {
    return EMAIL_PATTERN.test(email);
}

// Extract student ID from email
function extractStudentId(email) {
    return email.split('@')[0];
}

// Helper function to get user profile
const getUserProfile = async (studentId) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('student_id', studentId)
        .single();

    if (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }

    // Format dates to match expected format
    if (data) {
        data.created_at = data.created_at ? new Date(data.created_at).toISOString().slice(0, 19).replace('T', ' ') : null;
        data.updated_at = data.updated_at ? new Date(data.updated_at).toISOString().slice(0, 19).replace('T', ' ') : null;
        data.last_login = data.last_login ? new Date(data.last_login).toISOString().slice(0, 19).replace('T', ' ') : null;
    }

    return data || null;
};

// Login user (register if first time)
const login = async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format. Use XX-XXXXX-X@student.aiub.edu'
            });
        }

        const studentId = extractStudentId(email);

        // Validate student ID extraction
        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: 'Could not extract student ID from email'
            });
        }

        // Check if user exists in Supabase
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('student_id', studentId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means row not found
            console.error('Error fetching user:', fetchError);
            return res.status(500).json({
                success: false,
                message: 'Error checking user existence',
                error: fetchError.message
            });
        }

        let userExists = !!existingUser;

        if (!existingUser) {
            // Insert new user
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([{
                    student_id: studentId,
                    email: email,
                    is_first_login: true,
                    last_login: new Date().toISOString(),
                    profile_completed: false
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Error inserting new user:', insertError);

                // Check if it's a unique constraint violation
                if (insertError.code === '23505') {
                    return res.status(409).json({
                        success: false,
                        message: 'User already exists with this email or student ID'
                    });
                }

                return res.status(500).json({
                    success: false,
                    message: 'Error registering new user',
                    error: insertError.message
                });
            }
        } else {
            // Update last login
            const { error: updateError } = await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('student_id', studentId);

            if (updateError) {
                console.error('Error updating last login:', updateError);
                return res.status(500).json({
                    success: false,
                    message: 'Error updating login info',
                    error: updateError.message
                });
            }
        }

        // Get user profile
        const userProfile = await getUserProfile(studentId);

        if (!userProfile) {
            return res.status(500).json({
                success: false,
                message: 'Error retrieving user profile after login'
            });
        }

        // Check if user has admin roles - first check if they are in the users table as an admin
        let isAdmin = false;
        let adminPermissions = {};

        // First, check if the user ID from the users table has any roles in admin_role_map
        const { data: userRoleData, error: userRoleError } = await supabase
            .from('admin_role_map')
            .select(`
                admin_roles(role_name)
            `)
            .eq('admin_id', userProfile.id);

        if (userRoleData && userRoleData.length > 0) {
            isAdmin = true;
            // Get permissions for each role
            for (const roleMap of userRoleData) {
                const { data: permData, error: permError } = await supabase
                    .from('role_permissions')
                    .select(`
                        permissions(permission_name)
                    `)
                    .eq('role_id', roleMap.admin_roles.id);

                if (permData) {
                    permData.forEach(perm => {
                        // Convert permission name to camelCase for the response
                        const permName = perm.permissions.permission_name
                            .toLowerCase()
                            .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
                        adminPermissions[permName] = true;
                    });
                }
            }
        }

        // Also check if the user's email exists in the admins table and has roles
        const { data: adminRecord, error: adminError } = await supabase
            .from('admins')
            .select('id')
            .eq('email', userProfile.email)
            .single();

        if (adminRecord) {
            // Now check if this admin ID has any roles
            const { data: adminRoleData, error: adminRoleError } = await supabase
                .from('admin_role_map')
                .select(`
                    admin_roles(role_name)
                `)
                .eq('admin_id', adminRecord.id);

            if (adminRoleData && adminRoleData.length > 0) {
                isAdmin = true;
                // Get permissions for each role (add to existing permissions)
                for (const roleMap of adminRoleData) {
                    const { data: permData, error: permError } = await supabase
                        .from('role_permissions')
                        .select(`
                            permissions(permission_name)
                        `)
                        .eq('role_id', roleMap.admin_roles.id);

                    if (permData) {
                        permData.forEach(perm => {
                            // Convert permission name to camelCase for the response
                            const permName = perm.permissions.permission_name
                                .toLowerCase()
                                .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
                            adminPermissions[permName] = true;
                        });
                    }
                }
            }
        }

        // If not found as admin via admin table, check if user ID has roles directly
        if (!isAdmin) {
            const { data: userRoleData, error: userRoleError } = await supabase
                .from('admin_role_map')
                .select(`
                    admin_roles(role_name)
                `)
                .eq('admin_id', userProfile.id);

            if (userRoleData && userRoleData.length > 0) {
                isAdmin = true;
                // Get permissions for each role
                for (const roleMap of userRoleData) {
                    const { data: permData, error: permError } = await supabase
                        .from('role_permissions')
                        .select(`
                            permissions(permission_name)
                        `)
                        .eq('role_id', roleMap.admin_roles.id);

                    if (permData) {
                        permData.forEach(perm => {
                            // Convert permission name to camelCase for the response
                            const permName = perm.permissions.permission_name
                                .toLowerCase()
                                .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
                            adminPermissions[permName] = true;
                        });
                    }
                }
            }
        }

        return res.json({
            success: true,
            message: userExists ? 'User logged in' : 'New user registered',
            isNewUser: !userExists,
            user: userProfile,
            isAdmin: isAdmin,
            adminPermissions: isAdmin ? adminPermissions : null
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: error.message
        });
    }
};

// Get user profile
const getProfile = async (req, res) => {
    try {
        const { studentId } = req.params;

        const userProfile = await getUserProfile(studentId);

        if (!userProfile) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.json({
            success: true,
            user: userProfile
        });

    } catch (error) {
        console.error('Get profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Debug admin check endpoint
const debugAdminCheck = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Check if user exists in admins table
        const { data: adminData, error: adminError } = await supabase
            .from('admins')
            .select('id, email, full_name, status')
            .eq('email', email)
            .single();

        // Check if user exists in users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, email, full_name')
            .eq('email', email)
            .single();

        // Check if admin has roles
        let adminRoles = [];
        if (adminData) {
            const { data: adminRoleData, error: adminRoleError } = await supabase
                .from('admin_role_map')
                .select(`
                    admin_roles(role_name)
                `)
                .eq('admin_id', adminData.id);

            if (adminRoleData) {
                adminRoles = adminRoleData.map(role => role.admin_roles);
            }
        }

        // Check if user has roles
        let userRoles = [];
        if (userData) {
            const { data: userRoleData, error: userRoleError } = await supabase
                .from('admin_role_map')
                .select(`
                    admin_roles(role_name)
                `)
                .eq('admin_id', userData.id);

            if (userRoleData) {
                userRoles = userRoleData.map(role => role.admin_roles);
            }
        }

        // Check all roles in the system
        const { data: allRoles, error: allRolesError } = await supabase
            .from('admin_roles')
            .select('*');

        // Check all role mappings
        const { data: allMappings, error: allMappingsError } = await supabase
            .from('admin_role_map')
            .select(`
                id,
                admin_id,
                role_id,
                admin_roles(role_name)
            `)
            .eq('admin_id', adminData ? adminData.id : userData ? userData.id : -1);

        return res.json({
            success: true,
            email: email,
            admin_record: adminData,
            user_record: userData,
            admin_roles: adminRoles,
            user_roles: userRoles,
            all_roles: allRoles,
            role_mappings_for_user: allMappings,
            isAdmin: (adminRoles.length > 0) || (userRoles.length > 0)
        });

    } catch (error) {
        console.error('Debug admin check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Update user profile
const updateProfile = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { fullName, gender, phoneNumber, bloodGroup, programLevel, department, isFirstTime } = req.body;

        // Validate studentId format
        if (!studentId || typeof studentId !== 'string' || !EMAIL_PATTERN.test(studentId + '@student.aiub.edu')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid student ID format'
            });
        }

        // Validate inputs
        if (!fullName || !gender || !phoneNumber || !bloodGroup || !programLevel || !department) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Additional validation for each field
        if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Full name must be between 2 and 100 characters'
            });
        }

        if (!['Male', 'Female', 'Other'].includes(gender)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid gender value'
            });
        }

        // Validate phone number format (basic validation)
        if (typeof phoneNumber !== 'string' || !/^[0-9+\-\s()]{10,15}$/.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number format'
            });
        }

        if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodGroup)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid blood group'
            });
        }

        if (!['Undergraduate', 'Postgraduate'].includes(programLevel)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid program level'
            });
        }

        if (typeof department !== 'string' || department.trim().length < 2 || department.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Department must be between 2 and 100 characters'
            });
        }

        // Get current user data
        const currentUser = await getUserProfile(studentId);

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check locked fields
        if (!isFirstTime && currentUser.gender && currentUser.gender !== gender) {
            return res.status(400).json({
                success: false,
                message: 'Gender cannot be changed after initial setup'
            });
        }

        if (!isFirstTime && currentUser.program_level && currentUser.program_level !== programLevel) {
            return res.status(400).json({
                success: false,
                message: 'Program level cannot be changed'
            });
        }

        if (!isFirstTime && currentUser.department && currentUser.department !== department) {
            return res.status(400).json({
                success: false,
                message: 'Department cannot be changed'
            });
        }

        // First time profile completion
        if (isFirstTime || currentUser.is_first_login || !currentUser.profile_completed) {
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    full_name: fullName.trim(),
                    gender: gender,
                    phone_number: phoneNumber.trim(),
                    blood_group: bloodGroup,
                    program_level: programLevel,
                    department: department.trim(),
                    is_first_login: false,
                    profile_completed: true,
                    name_edit_count: 0,
                    last_login: new Date().toISOString()
                })
                .eq('student_id', studentId);

            if (updateError) {
                console.error('Error updating user profile:', updateError);

                // Handle specific error codes
                if (updateError.code === '23505') { // Unique violation
                    return res.status(409).json({
                        success: false,
                        message: 'Profile update failed due to conflict'
                    });
                }

                return res.status(500).json({
                    success: false,
                    message: 'Error updating profile',
                    error: updateError.message
                });
            }

            const updatedUser = await getUserProfile(studentId);

            return res.json({
                success: true,
                message: 'Profile completed successfully! Welcome aboard!',
                user: updatedUser
            });
        }

        // Subsequent updates
        let updateData = {
            phone_number: phoneNumber.trim(),
            blood_group: bloodGroup,
            last_login: new Date().toISOString()
        };

        // Check name changes
        if (currentUser.full_name && currentUser.full_name !== fullName) {
            if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Full name must be between 2 and 100 characters'
                });
            }

            if (currentUser.name_edit_count >= 3) {
                return res.status(400).json({
                    success: false,
                    message: 'Name edit limit reached'
                });
            }
            updateData.full_name = fullName.trim();
            updateData.name_edit_count = currentUser.name_edit_count + 1;
        }

        const { error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('student_id', studentId);

        if (updateError) {
            console.error('Error updating user profile:', updateError);

            // Handle specific error codes
            if (updateError.code === '23505') { // Unique violation
                return res.status(409).json({
                    success: false,
                    message: 'Profile update failed due to conflict'
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Error updating profile',
                error: updateError.message
            });
        }

        const updatedUser = await getUserProfile(studentId);

        return res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser
        });

    } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during profile update',
            error: error.message
        });
    }
};

// Get name edit count
const getNameEditCount = async (req, res) => {
    try {
        const { studentId } = req.params;

        const { data: user, error } = await supabase
            .from('users')
            .select('name_edit_count, full_name')
            .eq('student_id', studentId)
            .single();

        if (error || !user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.json({
            success: true,
            nameEditCount: user.name_edit_count,
            remainingEdits: 3 - user.name_edit_count,
            canEdit: user.name_edit_count < 3
        });

    } catch (error) {
        console.error('Get name edit count error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Check if user is a moderator
const checkModeratorStatus = async (req, res) => {
    try {
        const { email } = req.body;

        // Get user ID from email
        const studentId = email.split('@')[0];
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const { data: moderatorData, error: modError } = await supabase
            .from('moderators')
            .select('*, users(full_name)')
            .eq('user_id', user.id)
            .single();

        if (modError || !moderatorData) {
            return res.json({
                success: true,
                isModerator: false
            });
        }

        return res.json({
            success: true,
            isModerator: true,
            permissions: {
                can_manage_tournaments: moderatorData.can_manage_tournaments,
                can_view_user_data: moderatorData.can_view_user_data,
                can_manage_registrations: moderatorData.can_manage_registrations,
                can_send_announcements: moderatorData.can_send_announcements,
                can_generate_reports: moderatorData.can_generate_reports
            }
        });
    } catch (error) {
        console.error('Check moderator status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    // Helpers (exported for use by other controllers)
    validateEmail,
    extractStudentId,
    getUserProfile,
    EMAIL_PATTERN,
    
    // Route handlers
    login,
    getProfile,
    updateProfile,
    getNameEditCount,
    checkModeratorStatus,
    debugAdminCheck
};
