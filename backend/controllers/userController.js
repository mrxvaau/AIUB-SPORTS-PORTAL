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
        if (!email || !validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format. Use XX-XXXXX-X@student.aiub.edu'
            });
        }

        const studentId = extractStudentId(email);

        // Check if user exists in Supabase
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('student_id', studentId)
            .single();

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

        return res.json({
            success: true,
            message: userExists ? 'User logged in' : 'New user registered',
            isNewUser: !userExists,
            user: userProfile
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

        // Validate inputs
        if (!fullName || !gender || !phoneNumber || !bloodGroup || !programLevel || !department) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (!['Male', 'Female', 'Other'].includes(gender)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid gender value'
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
                    full_name: fullName,
                    gender: gender,
                    phone_number: phoneNumber,
                    blood_group: bloodGroup,
                    program_level: programLevel,
                    department: department,
                    is_first_login: false,
                    profile_completed: true,
                    name_edit_count: 0,
                    last_login: new Date().toISOString()
                })
                .eq('student_id', studentId);

            if (updateError) {
                console.error('Error updating user profile:', updateError);
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
            phone_number: phoneNumber,
            blood_group: bloodGroup,
            last_login: new Date().toISOString()
        };

        // Check name changes
        if (currentUser.full_name && currentUser.full_name !== fullName) {
            if (currentUser.name_edit_count >= 3) {
                return res.status(400).json({
                    success: false,
                    message: 'Name edit limit reached'
                });
            }
            updateData.full_name = fullName;
            updateData.name_edit_count = currentUser.name_edit_count + 1;
        }

        const { error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('student_id', studentId);

        if (updateError) {
            console.error('Error updating user profile:', updateError);
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

// Get available tournaments for registration
exports.getAvailableTournaments = async (req, res) => {
    try {
        const now = new Date().toISOString();

        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('id, title, photo_url, registration_deadline, status, created_at')
            .eq('status', 'ACTIVE')
            .gt('registration_deadline', now)
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

        // First, get user ID from student ID
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

        // Check if user has already registered for this game
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
        res.status(500).json({ success: false, message: error.message });
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