// User Controller - Supabase Version
// Version 1.0

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

// Login user (register if first time)
exports.login = async (req, res) => {
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
        const userProfile = await exports.getUserProfile(studentId);

        if (!userProfile) {
            return res.status(500).json({
                success: false,
                message: 'Error retrieving user profile after login'
            });
        }

        // Check if user is a moderator
        const { data: moderatorData, error: modError } = await supabase
            .from('moderators')
            .select('*')
            .eq('user_id', userProfile.id)
            .single();

        let isModerator = false;
        let moderatorPermissions = {};

        if (moderatorData && !modError) {
            isModerator = true;
            moderatorPermissions = {
                can_manage_tournaments: moderatorData.can_manage_tournaments,
                can_view_user_data: moderatorData.can_view_user_data,
                can_manage_registrations: moderatorData.can_manage_registrations,
                can_send_announcements: moderatorData.can_send_announcements,
                can_generate_reports: moderatorData.can_generate_reports
            };
        }

        return res.json({
            success: true,
            message: userExists ? 'User logged in' : 'New user registered',
            isNewUser: !userExists,
            user: userProfile,
            isModerator: isModerator,
            moderatorPermissions: isModerator ? moderatorPermissions : null
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
exports.getProfile = async (req, res) => {
    try {
        const { studentId } = req.params;

        const userProfile = await exports.getUserProfile(studentId);

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

// Helper function to get user profile
exports.getUserProfile = async (studentId) => {
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

// Update user profile
exports.updateProfile = async (req, res) => {
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
        const currentUser = await exports.getUserProfile(studentId);

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

            const updatedUser = await exports.getUserProfile(studentId);

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

        const updatedUser = await exports.getUserProfile(studentId);

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
exports.getNameEditCount = async (req, res) => {
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
exports.checkModeratorStatus = async (req, res) => {
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

// Get available tournaments for registration
exports.getAvailableTournaments = async (req, res) => {
    try {
        const now = new Date();
        const nowFormatted = now.toISOString();

        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('id, title, photo_url, registration_deadline, status, created_at')
            .eq('status', 'ACTIVE')
            .gt('registration_deadline', nowFormatted)
            .order('registration_deadline', { ascending: true });

        if (error) {
            console.error('Error fetching tournaments:', error);
            return res.status(500).json({ success: false, message: error.message });
        }

        // Format dates to match expected format
        const formattedTournaments = tournaments.map(tournament => ({
            ...tournament,
            deadline: new Date(tournament.registration_deadline).toISOString().slice(0, 19).replace('T', ' '),
            created_date: new Date(tournament.created_at).toISOString().slice(0, 10)
        }));

        res.json({ success: true, tournaments: formattedTournaments });
    } catch (error) {
        console.error('Get available tournaments error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get games for a specific tournament
exports.getTournamentGames = async (req, res) => {
    try {
        const tournamentId = req.params.id;

        const { data: games, error } = await supabase
            .from('tournament_games')
            .select('id, category, game_name, game_type, fee_per_person')
            .eq('tournament_id', tournamentId)
            .order('category')
            .order('game_name');

        if (error) {
            console.error('Error fetching tournament games:', error);
            res.status(500).json({ success: false, message: error.message });
        } else {
            res.json({ success: true, games: games });
        }
    } catch (error) {
        console.error('Get tournament games error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Register for a tournament game
exports.registerForGame = async (req, res) => {
    try {
        const { studentId, gameId } = req.body;

        // Validate inputs
        if (!studentId || typeof studentId !== 'string' || !EMAIL_PATTERN.test(studentId + '@student.aiub.edu')) {
            return res.status(400).json({
                success: false,
                message: 'Valid student ID is required'
            });
        }

        if (!gameId || isNaN(parseInt(gameId))) {
            return res.status(400).json({
                success: false,
                message: 'Valid game ID is required'
            });
        }

        // First, get user ID from student ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (userError) {
            if (userError.code === 'PGRST116') { // Row not found
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            console.error('Error fetching user:', userError);
            return res.status(500).json({
                success: false,
                message: 'Error checking user',
                error: userError.message
            });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userId = user.id;

        // Check if registration deadline has passed for this tournament
        const { data: gameData, error: gameError } = await supabase
            .from('tournament_games')
            .select(`
                id,
                tournament_id,
                tournaments(registration_deadline)
            `)
            .eq('id', gameId)
            .single();

        if (gameError) {
            if (gameError.code === 'PGRST116') { // Row not found
                return res.status(404).json({
                    success: false,
                    message: 'Game not found'
                });
            }

            console.error('Error fetching game:', gameError);
            return res.status(500).json({
                success: false,
                message: 'Error checking game',
                error: gameError.message
            });
        }

        if (!gameData) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        const deadline = new Date(gameData.tournaments.registration_deadline);
        const now = new Date();

        if (now > deadline) {
            return res.status(400).json({
                success: false,
                message: 'Registration deadline has passed for this tournament'
            });
        }

        // Check if user has already registered for this game
        const { data: existingRegistration, error: checkError } = await supabase
            .from('game_registrations')
            .select('id')
            .eq('user_id', userId)
            .eq('game_id', gameId)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means row not found (expected)
            console.error('Error checking existing registration:', checkError);
            return res.status(500).json({
                success: false,
                message: 'Error checking registration status',
                error: checkError.message
            });
        }

        if (existingRegistration) {
            return res.status(400).json({
                success: false,
                message: 'Already registered for this game'
            });
        }

        // Register user for the game
        const { data: registration, error: regError } = await supabase
            .from('game_registrations')
            .insert([{
                user_id: userId,
                game_id: gameId,
                payment_status: 'PENDING'
            }])
            .select()
            .single();

        if (regError) {
            console.error('Error registering for game:', regError);

            // Handle specific error codes
            if (regError.code === '23505') { // Unique violation
                return res.status(409).json({
                    success: false,
                    message: 'Already registered for this game'
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Error registering for game',
                error: regError.message
            });
        }

        res.json({
            success: true,
            message: 'Successfully registered for the game',
            registrationId: registration?.id || 'generated'
        });
    } catch (error) {
        console.error('Register for game error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error.message
        });
    }
};

// Get user's registrations
exports.getUserRegistrations = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get user ID from student ID
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

        const userId = user.id;

        // Get user registrations
        const { data: registrationData, error: regError } = await supabase
            .from('game_registrations')
            .select('id, game_id, payment_status, registration_date')
            .eq('user_id', userId)
            .order('registration_date', { ascending: false });

        if (regError) {
            console.error('Error fetching user registrations:', regError);
            return res.status(500).json({
                success: false,
                message: regError.message
            });
        }

        // For each registration, get the game and tournament details separately
        const registrationsWithDetails = [];

        for (const reg of registrationData) {
            // Get game details
            const { data: gameData, error: gameError } = await supabase
                .from('tournament_games')
                .select('game_name, category, game_type, fee_per_person, tournament_id')
                .eq('id', reg.game_id)
                .single();

            if (gameError || !gameData) {
                console.error('Error fetching game details:', gameError, 'Game ID:', reg.game_id);
                continue; // Skip this registration if we can't get game details
            }

            // Get tournament details
            const { data: tournamentData, error: tournamentError } = await supabase
                .from('tournaments')
                .select('title')
                .eq('id', gameData.tournament_id)
                .single();

            if (tournamentError || !tournamentData) {
                console.error('Error fetching tournament details:', tournamentError, 'Tournament ID:', gameData.tournament_id);
                continue; // Skip this registration if we can't get tournament details
            }

            // Combine all the data
            registrationsWithDetails.push({
                registration_id: reg.id,
                game_name: gameData.game_name,
                category: gameData.category,
                game_type: gameData.game_type,
                fee_per_person: gameData.fee_per_person,
                tournament_title: tournamentData.title,
                payment_status: reg.payment_status,
                registration_date: new Date(reg.registration_date).toISOString().slice(0, 19).replace('T', ' ')
            });
        }

        return res.json({ success: true, registrations: registrationsWithDetails });
    } catch (error) {
        console.error('Get user registrations error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Create a team for a tournament game
exports.createTeam = async (req, res) => {
    try {
        const { studentId, gameId, teamName } = req.body;

        // Get user ID from student ID
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

        const userId = user.id;

        // Check if registration deadline has passed for this tournament
        const { data: gameData, error: gameError } = await supabase
            .from('tournament_games')
            .select(`
                id,
                tournament_id,
                game_type,
                fee_per_person,
                tournaments(registration_deadline)
            `)
            .eq('id', gameId)
            .single();

        if (gameError || !gameData) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        const deadline = new Date(gameData.tournaments.registration_deadline);
        const now = new Date();

        if (now > deadline) {
            return res.status(400).json({
                success: false,
                message: 'Registration deadline has passed for this tournament'
            });
        }

        // Check if user has already registered for this game (either individually or as team leader)
        const { data: existingRegistration, error: checkError } = await supabase
            .from('game_registrations')
            .select('id')
            .eq('user_id', userId)
            .eq('game_id', gameId)
            .single();

        if (existingRegistration) {
            return res.status(400).json({
                success: false,
                message: 'Already registered for this game'
            });
        }

        // Check if user is already part of a team for this game
        const { data: existingTeamMember, error: teamMemberError } = await supabase
            .from('team_members')
            .select('id')
            .eq('user_id', userId)
            .eq('team.tournament_game_id', gameId)
            .single();

        if (existingTeamMember) {
            return res.status(400).json({
                success: false,
                message: 'Already part of a team for this game'
            });
        }

        // Create the team
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .insert([{
                tournament_game_id: gameId,
                team_name: teamName,
                leader_user_id: userId
            }])
            .select()
            .single();

        if (teamError) {
            console.error('Error creating team:', teamError);
            return res.status(500).json({
                success: false,
                message: 'Error creating team',
                error: teamError.message
            });
        }

        // Add the leader as the first team member
        const { data: teamMember, error: memberError } = await supabase
            .from('team_members')
            .insert([{
                team_id: team.id,
                user_id: userId,
                role: 'LEADER',
                status: 'CONFIRMED'
            }])
            .select()
            .single();

        if (memberError) {
            console.error('Error adding team leader:', memberError);
            // Rollback team creation if member addition fails
            await supabase.from('teams').delete().eq('id', team.id);
            return res.status(500).json({
                success: false,
                message: 'Error adding team leader',
                error: memberError.message
            });
        }

        // Register the team for the game (as a placeholder registration)
        const { data: registration, error: regError } = await supabase
            .from('game_registrations')
            .insert([{
                user_id: userId, // Leader's ID for tracking
                game_id: gameId,
                payment_status: 'PENDING'
            }])
            .select()
            .single();

        if (regError) {
            console.error('Error creating team registration:', regError);
            // Rollback if registration fails
            await supabase.from('team_members').delete().eq('id', teamMember.id);
            await supabase.from('teams').delete().eq('id', team.id);
            return res.status(500).json({
                success: false,
                message: 'Error registering team for game',
                error: regError.message
            });
        }

        res.json({
            success: true,
            message: 'Team created successfully',
            teamId: team.id,
            team: {
                id: team.id,
                name: team.team_name,
                leaderId: team.leader_user_id,
                status: team.status
            }
        });
    } catch (error) {
        console.error('Create team error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get team details by team ID
exports.getTeamDetails = async (req, res) => {
    try {
        const { teamId } = req.params;

        // Get team information
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select(`
                id,
                team_name,
                leader_user_id,
                status,
                tournament_game_id,
                created_at,
                updated_at,
                tournament_games(game_name, game_type, fee_per_person, category, tournament_id),
                tournaments(title)
            `)
            .eq('id', teamId)
            .single();

        if (teamError || !team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Get team members
        const { data: members, error: membersError } = await supabase
            .from('team_members')
            .select(`
                id,
                user_id,
                role,
                status,
                created_at,
                users(student_id, full_name, email)
            `)
            .eq('team_id', teamId)
            .order('role', { ascending: false }); // LEADER first

        if (membersError) {
            console.error('Error fetching team members:', membersError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching team members',
                error: membersError.message
            });
        }

        // Format the response
        const teamDetails = {
            id: team.id,
            name: team.team_name,
            leaderId: team.leader_user_id,
            status: team.status,
            game: {
                id: team.tournament_game_id,
                name: team.tournament_games.game_name,
                type: team.tournament_games.game_type,
                feePerPerson: team.tournament_games.fee_per_person,
                category: team.tournament_games.category,
                tournamentId: team.tournament_games.tournament_id,
                tournamentTitle: team.tournaments.title
            },
            members: members.map(member => ({
                id: member.id,
                userId: member.user_id,
                role: member.role,
                status: member.status,
                studentId: member.users?.student_id,
                fullName: member.users?.full_name,
                email: member.users?.email,
                createdAt: member.created_at
            })),
            createdAt: team.created_at,
            updatedAt: team.updated_at
        };

        res.json({
            success: true,
            team: teamDetails
        });
    } catch (error) {
        console.error('Get team details error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Add team member to a team
exports.addTeamMember = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { studentId } = req.body;

        // Get the team
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select(`
                id,
                leader_user_id,
                status,
                tournament_games(game_type, fee_per_person)
            `)
            .eq('id', teamId)
            .single();

        if (teamError || !team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Check if the current user is the team leader
        const currentUserId = req.user_id; // This would come from auth middleware
        if (team.leader_user_id !== currentUserId) {
            return res.status(403).json({
                success: false,
                message: 'Only team leader can add members'
            });
        }

        // Check if team is already confirmed
        if (team.status === 'CONFIRMED') {
            return res.status(400).json({
                success: false,
                message: 'Cannot add members to a confirmed team'
            });
        }

        // Get the user to add by student ID
        const { data: userToAdd, error: userError } = await supabase
            .from('users')
            .select('id, student_id, full_name, email')
            .eq('student_id', studentId)
            .single();

        let userIdToAdd;
        let isUserExisting = true;

        if (userError || !userToAdd) {
            // User doesn't exist yet, but we'll still create a pending notification
            // For now, we'll create a placeholder in team_members with a status that indicates pending
            // Actually, let's just create a notification for the student ID
            userIdToAdd = null; // We'll store the student ID in a different way
            isUserExisting = false;
        } else {
            userIdToAdd = userToAdd.id;
        }

        // Check if user is already in the team
        const { data: existingMember, error: existingError } = await supabase
            .from('team_members')
            .select('id')
            .eq('team_id', teamId)
            .eq('user_id', userIdToAdd)
            .single();

        if (existingMember) {
            return res.status(400).json({
                success: false,
                message: 'User is already a member of this team'
            });
        }

        // Check if the team is already full based on game type
        // For now, we'll just check if there are already members and add the new one
        // In a real implementation, we'd check the game type to determine max team size
        if (isUserExisting) {
            // Add the user as a team member with PENDING status
            const { data: teamMember, error: memberError } = await supabase
                .from('team_members')
                .insert([{
                    team_id: teamId,
                    user_id: userIdToAdd,
                    role: 'MEMBER',
                    status: 'PENDING'
                }])
                .select()
                .single();

            if (memberError) {
                console.error('Error adding team member:', memberError);
                return res.status(500).json({
                    success: false,
                    message: 'Error adding team member',
                    error: memberError.message
                });
            }

            // Create a notification for the user to join the team
            const { error: notificationError } = await supabase
                .from('notifications')
                .insert([{
                    user_id: userIdToAdd,
                    title: 'Team Invitation',
                    message: `You have been invited to join team "${team.team_name}" for game "${team.tournament_games.game_name}" in tournament "${team.tournament_games.tournament_title || 'Unknown'}".`,
                    type: 'TEAM_REQUEST',
                    related_id: teamId,
                    related_type: 'TEAM_REQUEST'
                }]);

            if (notificationError) {
                console.error('Error creating notification:', notificationError);
                // Don't fail the operation if notification creation fails
            }

            res.json({
                success: true,
                message: 'Team member added successfully',
                member: teamMember
            });
        } else {
            // Create a notification for a non-existent user
            // We'll store the student ID in the message and handle it when the user registers
            const { error: notificationError } = await supabase
                .from('notifications')
                .insert([{
                    user_id: null, // No user ID since user doesn't exist yet
                    title: 'Team Invitation',
                    message: `You have been invited to join team "${team.team_name}" for game "${team.tournament_games.game_name}" in tournament "${team.tournament_games.tournament_title || 'Unknown'}".`,
                    type: 'TEAM_REQUEST',
                    related_id: teamId,
                    related_type: 'TEAM_REQUEST',
                    // Store the student ID in a separate field or in the message
                }]);

            if (notificationError) {
                console.error('Error creating notification for non-existent user:', notificationError);
            }

            res.json({
                success: true,
                message: 'Team invitation sent. User will be notified when they register.'
            });
        }
    } catch (error) {
        console.error('Add team member error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Accept team invitation
exports.acceptTeamInvitation = async (req, res) => {
    try {
        const { studentId, notificationId } = req.body;

        // Get user ID from student ID
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

        const userId = user.id;

        // Get the notification
        const { data: notification, error: notificationError } = await supabase
            .from('notifications')
            .select('id, related_id, status')
            .eq('id', notificationId)
            .eq('user_id', userId)
            .eq('type', 'TEAM_REQUEST')
            .single();

        if (notificationError || !notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        if (notification.status === 'READ') {
            return res.status(400).json({
                success: false,
                message: 'Invitation already processed'
            });
        }

        const teamId = notification.related_id;

        // Get the team
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('id, status')
            .eq('id', teamId)
            .single();

        if (teamError || !team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Update the team member status to CONFIRMED
        const { error: memberUpdateError } = await supabase
            .from('team_members')
            .update({ status: 'CONFIRMED' })
            .eq('team_id', teamId)
            .eq('user_id', userId);

        if (memberUpdateError) {
            console.error('Error updating team member status:', memberUpdateError);
            return res.status(500).json({
                success: false,
                message: 'Error accepting team invitation',
                error: memberUpdateError.message
            });
        }

        // Mark the notification as read
        await supabase
            .from('notifications')
            .update({ status: 'READ' })
            .eq('id', notificationId);

        res.json({
            success: true,
            message: 'Team invitation accepted successfully'
        });
    } catch (error) {
        console.error('Accept team invitation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Confirm team registration
exports.confirmTeamRegistration = async (req, res) => {
    try {
        const { teamId } = req.params;

        // Get the team
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select(`
                id,
                leader_user_id,
                status,
                tournament_games(game_type, fee_per_person)
            `)
            .eq('id', teamId)
            .single();

        if (teamError || !team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Check if the current user is the team leader
        const currentUserId = req.user_id; // This would come from auth middleware
        if (team.leader_user_id !== currentUserId) {
            return res.status(403).json({
                success: false,
                message: 'Only team leader can confirm registration'
            });
        }

        // Check if team is already confirmed
        if (team.status === 'CONFIRMED') {
            return res.status(400).json({
                success: false,
                message: 'Team registration already confirmed'
            });
        }

        // Check if all required members have confirmed
        const { data: teamMembers, error: membersError } = await supabase
            .from('team_members')
            .select('status')
            .eq('team_id', teamId);

        if (membersError) {
            console.error('Error fetching team members:', membersError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching team members',
                error: membersError.message
            });
        }

        // For now, we'll just check if all members have confirmed status
        // In a real implementation, we'd check the game type to determine required team size
        const pendingMembers = teamMembers.filter(member => member.status !== 'CONFIRMED');
        if (pendingMembers.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'All team members must confirm before registration can be finalized'
            });
        }

        // Update team status to confirmed
        const { error: updateError } = await supabase
            .from('teams')
            .update({ status: 'CONFIRMED' })
            .eq('id', teamId);

        if (updateError) {
            console.error('Error confirming team registration:', updateError);
            return res.status(500).json({
                success: false,
                message: 'Error confirming team registration',
                error: updateError.message
            });
        }

        res.json({
            success: true,
            message: 'Team registration confirmed successfully'
        });
    } catch (error) {
        console.error('Confirm team registration error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get user notifications
exports.getNotifications = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get user ID from student ID
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

        const userId = user.id;

        // Get user notifications
        const { data: notifications, error: notifError } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (notifError) {
            console.error('Error fetching notifications:', notifError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching notifications',
                error: notifError.message
            });
        }

        res.json({
            success: true,
            notifications: notifications
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        // Update notification status to READ
        const { error: updateError } = await supabase
            .from('notifications')
            .update({ status: 'READ' })
            .eq('id', notificationId);

        if (updateError) {
            console.error('Error updating notification status:', updateError);
            return res.status(500).json({
                success: false,
                message: 'Error updating notification status',
                error: updateError.message
            });
        }

        res.json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all pending team invitations for a user
exports.getPendingTeamInvitations = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get user ID from student ID
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

        const userId = user.id;

        // Get pending team invitations for the user
        const { data: invitations, error: invError } = await supabase
            .from('notifications')
            .select(`
                id,
                title,
                message,
                created_at,
                related_id as team_id
            `)
            .eq('user_id', userId)
            .eq('type', 'TEAM_REQUEST')
            .eq('status', 'UNREAD');

        if (invError) {
            console.error('Error fetching pending invitations:', invError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching pending invitations',
                error: invError.message
            });
        }

        res.json({
            success: true,
            invitations: invitations
        });
    } catch (error) {
        console.error('Get pending team invitations error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Add item to cart
exports.addToCart = async (req, res) => {
    try {
        const { studentId, item_type, item_id, tournament_game_id } = req.body;

        // Get user ID from student ID
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

        const userId = user.id;

        // Check if item already exists in cart
        const { data: existingItem, error: existingError } = await supabase
            .from('cart')
            .select('id')
            .eq('user_id', userId)
            .eq('tournament_game_id', tournament_game_id)
            .single();

        if (existingItem) {
            return res.status(400).json({
                success: false,
                message: 'Item already exists in cart'
            });
        }

        // Add item to cart
        const { data: cartItem, error: cartError } = await supabase
            .from('cart')
            .insert([{
                user_id: userId,
                item_type: item_type,
                item_id: item_id,
                tournament_game_id: tournament_game_id
            }])
            .select(`
                id,
                item_type,
                item_id,
                tournament_game_id,
                created_at,
                tournament_games(game_name, game_type, fee_per_person, category, tournament_id),
                tournaments(title)
            `)
            .single();

        if (cartError) {
            console.error('Error adding to cart:', cartError);
            return res.status(500).json({
                success: false,
                message: 'Error adding item to cart',
                error: cartError.message
            });
        }

        res.json({
            success: true,
            message: 'Item added to cart successfully',
            cartItem: {
                id: cartItem.id,
                item_type: cartItem.item_type,
                item_id: cartItem.item_id,
                tournament_game_id: cartItem.tournament_game_id,
                game: {
                    id: cartItem.tournament_games.id,
                    name: cartItem.tournament_games.game_name,
                    type: cartItem.tournament_games.game_type,
                    feePerPerson: cartItem.tournament_games.fee_per_person,
                    category: cartItem.tournament_games.category,
                    tournamentId: cartItem.tournament_games.tournament_id,
                    tournamentTitle: cartItem.tournaments.title
                },
                createdAt: cartItem.created_at
            }
        });
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get user's cart
exports.getCart = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get user ID from student ID
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

        const userId = user.id;

        // Get user's cart items
        const { data: cartItems, error: cartError } = await supabase
            .from('cart')
            .select(`
                id,
                item_type,
                item_id,
                tournament_game_id,
                created_at,
                tournament_games(game_name, game_type, fee_per_person, category, tournament_id),
                tournaments(title)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (cartError) {
            console.error('Error fetching cart:', cartError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching cart',
                error: cartError.message
            });
        }

        // Calculate total amount
        let totalAmount = 0;
        const formattedCartItems = cartItems.map(item => {
            // For team registration, we need to multiply by number of team members
            let multiplier = 1; // Default for individual registration

            if (item.item_type === 'TEAM_REGISTRATION') {
                // Get team member count
                // For now, we'll just use a default multiplier
                // In a real implementation, we'd fetch the team and count members
                multiplier = 2; // Assuming 2 members for demo purposes
            }

            const itemTotal = item.tournament_games.fee_per_person * multiplier;
            totalAmount += itemTotal;

            return {
                id: item.id,
                item_type: item.item_type,
                item_id: item.item_id,
                tournament_game_id: item.tournament_game_id,
                game: {
                    id: item.tournament_games.id,
                    name: item.tournament_games.game_name,
                    type: item.tournament_games.game_type,
                    feePerPerson: item.tournament_games.fee_per_person,
                    category: item.tournament_games.category,
                    tournamentId: item.tournament_games.tournament_id,
                    tournamentTitle: item.tournaments.title
                },
                multiplier: multiplier,
                itemTotal: itemTotal,
                createdAt: item.created_at
            };
        });

        res.json({
            success: true,
            cartItems: formattedCartItems,
            totalAmount: totalAmount
        });
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Remove item from cart
exports.removeFromCart = async (req, res) => {
    try {
        const { cartItemId } = req.params;

        // Remove item from cart
        const { error: deleteError } = await supabase
            .from('cart')
            .delete()
            .eq('id', cartItemId);

        if (deleteError) {
            console.error('Error removing from cart:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error removing item from cart',
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: 'Item removed from cart successfully'
        });
    } catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Clear user's cart
exports.clearCart = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get user ID from student ID
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

        const userId = user.id;

        // Remove all items from user's cart
        const { error: deleteError } = await supabase
            .from('cart')
            .delete()
            .eq('user_id', userId);

        if (deleteError) {
            console.error('Error clearing cart:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error clearing cart',
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: 'Cart cleared successfully'
        });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Cancel game registration
exports.cancelGameRegistration = async (req, res) => {
    try {
        const { gameId, studentId } = req.params;

        // Get user ID from student ID
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

        const userId = user.id;

        // Check if the game exists and get tournament deadline
        const { data: gameData, error: gameError } = await supabase
            .from('tournament_games')
            .select(`
                id,
                tournament_id,
                tournaments(registration_deadline)
            `)
            .eq('id', gameId)
            .single();

        if (gameError || !gameData) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        // Check if registration deadline has passed
        const deadline = new Date(gameData.tournaments.registration_deadline);
        const now = new Date();

        if (now > deadline) {
            return res.status(400).json({
                success: false,
                message: 'Registration deadline has passed. Cannot cancel registration.'
            });
        }

        // Check if user has registered for this game
        const { data: existingRegistration, error: checkError } = await supabase
            .from('game_registrations')
            .select('id')
            .eq('user_id', userId)
            .eq('game_id', gameId)
            .single();

        if (!existingRegistration) {
            return res.status(400).json({
                success: false,
                message: 'No registration found for this game'
            });
        }

        // Delete the registration
        const { error: deleteError } = await supabase
            .from('game_registrations')
            .delete()
            .eq('id', existingRegistration.id);

        if (deleteError) {
            console.error('Error canceling registration:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error canceling registration',
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: 'Registration canceled successfully'
        });
    } catch (error) {
        console.error('Cancel game registration error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};