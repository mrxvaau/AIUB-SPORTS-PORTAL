// User Controller
// Version 1.0

const oracledb = require('oracledb');
const db = require('../config/database');

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

        // Check if user exists using direct query
        const checkQuery = `SELECT COUNT(*) as user_count FROM users WHERE student_id = :student_id`;
        const checkResult = await db.executeQuery(checkQuery, [studentId]);
        const userExists = checkResult.rows[0].USER_COUNT > 0;

        if (!userExists) {
            // Insert new user directly
            const insertQuery = `
                INSERT INTO users (student_id, email, is_first_login, last_login, profile_completed)
                VALUES (:student_id, :email, 1, CURRENT_TIMESTAMP, 0)
            `;
            await db.executeQuery(insertQuery, [studentId, email]);
        } else {
            // Update last login
            const updateQuery = `
                UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE student_id = :student_id
            `;
            await db.executeQuery(updateQuery, [studentId]);
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
    const query = `
        SELECT 
            id,
            student_id,
            email,
            full_name,
            gender,
            phone_number,
            blood_group,
            program_level,
            department,
            name_edit_count,
            is_first_login,
            profile_completed,
            TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
            TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at,
            TO_CHAR(last_login, 'YYYY-MM-DD HH24:MI:SS') as last_login
        FROM users
        WHERE student_id = :student_id
    `;

    const result = await db.executeQuery(query, [studentId]);

    return result.rows.length > 0 ? result.rows[0] : null;
};

// Update user profile
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
        if (!isFirstTime && currentUser.GENDER && currentUser.GENDER !== gender) {
            return res.status(400).json({
                success: false,
                message: 'Gender cannot be changed after initial setup'
            });
        }

        if (!isFirstTime && currentUser.PROGRAM_LEVEL && currentUser.PROGRAM_LEVEL !== programLevel) {
            return res.status(400).json({
                success: false,
                message: 'Program level cannot be changed'
            });
        }

        if (!isFirstTime && currentUser.DEPARTMENT && currentUser.DEPARTMENT !== department) {
            return res.status(400).json({
                success: false,
                message: 'Department cannot be changed'
            });
        }

        // First time profile completion
        if (isFirstTime || currentUser.IS_FIRST_LOGIN === 1 || !currentUser.PROFILE_COMPLETED) {
            const updateQuery = `
                UPDATE users
                SET full_name = :full_name,
                    gender = :gender,
                    phone_number = :phone_number,
                    blood_group = :blood_group,
                    program_level = :program_level,
                    department = :department,
                    is_first_login = 0,
                    profile_completed = 1,
                    name_edit_count = 0,
                    last_login = CURRENT_TIMESTAMP
                WHERE student_id = :student_id
            `;
            
            await db.executeQuery(updateQuery, {
                full_name: fullName,
                gender: gender,
                phone_number: phoneNumber,
                blood_group: bloodGroup,
                program_level: programLevel,
                department: department,
                student_id: studentId
            });

            const updatedUser = await exports.getUserProfile(studentId);

            return res.json({
                success: true,
                message: 'Profile completed successfully! Welcome aboard!',
                user: updatedUser
            });
        }

        // Subsequent updates
        let updateFields = [];
        let updateParams = { student_id: studentId };

        // Check name changes
        if (currentUser.FULL_NAME && currentUser.FULL_NAME !== fullName) {
            if (currentUser.NAME_EDIT_COUNT >= 3) {
                return res.status(400).json({
                    success: false,
                    message: 'Name edit limit reached'
                });
            }
            updateFields.push('full_name = :full_name');
            updateFields.push('name_edit_count = name_edit_count + 1');
            updateParams.full_name = fullName;
        }

        // Always allow phone and blood group updates
        updateFields.push('phone_number = :phone_number');
        updateFields.push('blood_group = :blood_group');
        updateFields.push('last_login = CURRENT_TIMESTAMP');
        updateParams.phone_number = phoneNumber;
        updateParams.blood_group = bloodGroup;

        const updateQuery = `
            UPDATE users
            SET ${updateFields.join(', ')}
            WHERE student_id = :student_id
        `;
        
        await db.executeQuery(updateQuery, updateParams);

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

        const query = `
            SELECT name_edit_count, full_name
            FROM users
            WHERE student_id = :student_id
        `;

        const result = await db.executeQuery(query, [studentId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = result.rows[0];

        return res.json({
            success: true,
            nameEditCount: user.NAME_EDIT_COUNT,
            remainingEdits: 3 - user.NAME_EDIT_COUNT,
            canEdit: user.NAME_EDIT_COUNT < 3
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
        const query = `
            SELECT id, title, photo_url,
                   TO_CHAR(registration_deadline, 'YYYY-MM-DD HH24:MI:SS') as deadline,
                   status, TO_CHAR(created_at, 'YYYY-MM-DD') as created_date
            FROM tournaments
            WHERE status = 'ACTIVE'
              AND registration_deadline > CURRENT_TIMESTAMP
            ORDER BY registration_deadline ASC
        `;

        const result = await db.executeQuery(query);
        res.json({ success: true, tournaments: result.rows });
    } catch (error) {
        console.error('Get available tournaments error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get games for a specific tournament
exports.getTournamentGames = async (req, res) => {
    try {
        const tournamentId = req.params.id;

        const query = `
            SELECT id, category, game_name, game_type, fee_per_person
            FROM tournament_games
            WHERE tournament_id = :tournament_id
            ORDER BY category, game_name
        `;

        const result = await db.executeQuery(query, [tournamentId]);
        res.json({ success: true, games: result.rows });
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
        const userQuery = `
            SELECT id FROM users WHERE student_id = :student_id
        `;
        const userResult = await db.executeQuery(userQuery, [studentId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userId = userResult.rows[0].ID;

        // Check if registration deadline has passed for this tournament
        const deadlineQuery = `
            SELECT t.registration_deadline
            FROM tournament_games tg
            JOIN tournaments t ON tg.tournament_id = t.id
            WHERE tg.id = :game_id
        `;
        const deadlineResult = await db.executeQuery(deadlineQuery, [gameId]);

        if (deadlineResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        const deadline = new Date(deadlineResult.rows[0].REGISTRATION_DEADLINE);
        const now = new Date();

        if (now > deadline) {
            return res.status(400).json({
                success: false,
                message: 'Registration deadline has passed for this tournament'
            });
        }

        // Check if user has already registered for this game
        const checkQuery = `
            SELECT id FROM game_registrations
            WHERE user_id = :user_id AND game_id = :game_id
        `;
        const checkResult = await db.executeQuery(checkQuery, [userId, gameId]);

        if (checkResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Already registered for this game'
            });
        }

        // Register user for the game
        const registerQuery = `
            INSERT INTO game_registrations (user_id, game_id, payment_status)
            VALUES (:user_id, :game_id, 'PENDING')
        `;
        await db.executeQuery(registerQuery, [userId, gameId]);

        res.json({
            success: true,
            message: 'Successfully registered for the game',
            registrationId: 'generated'
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
        const userQuery = `
            SELECT id FROM users WHERE student_id = :student_id
        `;
        const userResult = await db.executeQuery(userQuery, [studentId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userId = userResult.rows[0].ID;

        const query = `
            SELECT
                gr.id as registration_id,
                tg.game_name,
                tg.category,
                tg.game_type,
                tg.fee_per_person,
                t.title as tournament_title,
                gr.payment_status,
                TO_CHAR(gr.registration_date, 'YYYY-MM-DD HH24:MI:SS') as registration_date
            FROM game_registrations gr
            JOIN tournament_games tg ON gr.game_id = tg.id
            JOIN tournaments t ON tg.tournament_id = t.id
            WHERE gr.user_id = :user_id
            ORDER BY gr.registration_date DESC
        `;

        const result = await db.executeQuery(query, [userId]);
        res.json({ success: true, registrations: result.rows });
    } catch (error) {
        console.error('Get user registrations error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};