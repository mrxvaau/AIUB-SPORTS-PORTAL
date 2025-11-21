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

        // Check if user exists using direct query instead of procedure
        const checkQuery = `SELECT COUNT(*) as user_count FROM users WHERE student_id = :student_id`;
        const checkResult = await db.executeQuery(checkQuery, [studentId]);
        const userExists = checkResult.rows[0].USER_COUNT > 0;

        if (!userExists) {
            // Insert new user directly
            const insertQuery = `
                INSERT INTO users (student_id, email, is_first_login, last_login)
                VALUES (:student_id, :email, 1, CURRENT_TIMESTAMP)
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
            name_edit_count,
            is_first_login,
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
exports.updateProfile = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { fullName, gender, isFirstTime } = req.body;

        // Validate inputs
        if (!fullName || !gender) {
            return res.status(400).json({
                success: false,
                message: 'Full name and gender are required'
            });
        }

        if (!['Male', 'Female', 'Other'].includes(gender)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid gender value'
            });
        }

        // Get current user data to check constraints
        const currentUser = await exports.getUserProfile(studentId);

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if gender is being changed (not allowed after first time)
        if (!isFirstTime && currentUser.GENDER && currentUser.GENDER !== gender) {
            return res.status(400).json({
                success: false,
                message: 'Gender cannot be changed after initial setup'
            });
        }

        // Check name edit limit
        if (currentUser.FULL_NAME && currentUser.FULL_NAME !== fullName) {
            if (currentUser.NAME_EDIT_COUNT >= 3) {
                return res.status(400).json({
                    success: false,
                    message: 'Name edit limit reached. You can only change your name 3 times.'
                });
            }
        }

        // Call update procedure
        const result = await db.callProcedure(
            'update_user_profile(:student_id, :full_name, :gender, :is_first_time, :status)',
            {
                student_id: studentId,
                full_name: fullName,
                gender: gender,
                is_first_time: isFirstTime ? 1 : 0,
                status: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: 100 }
            }
        );

        const status = result.outBinds.status;

        if (status === 'NAME_EDIT_LIMIT_REACHED') {
            return res.status(400).json({
                success: false,
                message: 'Name edit limit reached'
            });
        }

        if (status === 'USER_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get updated profile
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