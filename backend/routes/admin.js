const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const multer = require('multer');
const path = require('path');

const fs = require('fs');

// Configure multer for file uploads - temporary storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // For now, store in a temporary location since req.body isn't available yet
        // We'll move it later after getting the title
        const tempDir = 'uploads/temp/';
        console.log('Setting up temp directory:', tempDir);
        // Ensure directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
            console.log('Created temp directory:', tempDir);
        }
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename to prevent conflicts
        const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        console.log('Generated filename for upload:', filename);
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    // Add file validation
    fileFilter: (req, file, cb) => {
        console.log('Validating uploaded file:', file.originalname, 'Mimetype:', file.mimetype);
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            console.log('File accepted:', file.originalname);
            return cb(null, true);
        } else {
            console.log('File rejected - not an image:', file.originalname, 'Mimetype:', file.mimetype);
            return cb(new Error('Only image files are allowed!'), false);
        }
    },
    // Set file size limit (optional)
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Add error handling middleware for multer
function handleMulterError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        console.error('Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 5MB.'
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message
        });
    } else if (err) {
        // An unknown error occurred when uploading.
        console.error('Upload error:', err);
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    next();
}

// Middleware to check if user is admin
async function requireAdmin(req, res, next) {
    try {
        // Try to get user email from multiple sources
        // Check for various possible header names (headers are case-insensitive in HTTP/2 but may vary)
        let userEmail = req.body.email || req.query.email ||
                      req.headers['x-user-email'] ||
                      req.headers['X-User-Email'] ||
                      req.headers['X-USER-EMAIL'] ||
                      req.headers['x-useremail'] ||  // Alternative without hyphen
                      req.headers['X-UserEmail'];     // Alternative without hyphen

        // If not found in headers, try to get from session or other sources
        if (!userEmail) {
            // Check if we can get user info from the authentication token
            // For now, we'll check if there's a user in the session or request
            // This might come from a previous auth middleware
            if (req.session && req.session.userEmail) {
                userEmail = req.session.userEmail;
            } else if (req.user && req.user.email) {
                userEmail = req.user.email;
            }
        }

        console.log('Admin check - userEmail:', userEmail); // Debug logging
        console.log('Admin check - all headers:', req.headers); // Debug logging
        console.log('Admin check - request body:', req.body); // Debug logging

        if (!userEmail) {
            console.log('Admin check - No email provided');
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Use the PostgreSQL function to check admin status and role
        const { data, error } = await require('../config/supabase').supabase
            .rpc('check_is_admin', { user_email: userEmail });

        console.log('Admin check - Role check result:', { data, error }); // Debug logging

        if (error) {
            console.error('Admin check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Authentication error'
            });
        }

        if (!data || data.length === 0 || !data[0].is_admin || data[0].role_name === 'NOT_ADMIN') {
            console.log('Admin check - User is not an admin or has no role');
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        // Get full admin details for the request object
        const { data: admin, error: adminError } = await require('../config/supabase').supabase
            .from('admins')
            .select('id, admin_id, email, full_name, status')
            .eq('email', userEmail)
            .single();

        if (adminError || !admin || admin.status !== 'ACTIVE') {
            console.log('Admin check - Admin not found or inactive');
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        // Add user info and role to request for use in handlers
        req.user = {
            ...admin,
            role: data[0].role_name
        };

        console.log('Admin check - Access granted for role:', data[0].role_name);
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
}

// Check if user is admin
router.post('/check-admin', async (req, res) => {
    try {
        const { email } = req.body;

        console.log('=== ADMIN CHECK START ===');
        console.log('Checking email:', email);

        // Use the PostgreSQL function to check admin status and role
        const { data, error } = await supabase
            .rpc('check_is_admin', { user_email: email });

        console.log('Admin check - Role check result:', { data, error });

        if (error) {
            console.error('Check admin error:', error);
            res.status(500).json({ success: false, message: error.message });
            return;
        }

        if (!data || data.length === 0) {
            // No admin found
            res.json({ success: true, isAdmin: false, role: 'NOT_ADMIN' });
        } else if (data[0].is_admin && data[0].role_name !== 'NOT_ADMIN') {
            // Admin found with a valid role
            // Get full admin details
            const { data: adminDetails, error: adminError } = await supabase
                .from('admins')
                .select('id, admin_id, email, full_name, status')
                .eq('email', email)
                .single();

            if (adminError) {
                console.error('Error fetching admin details:', adminError);
                // If there's an error fetching admin details, just return the role info
                res.json({
                    success: true,
                    isAdmin: data[0].is_admin,
                    role: data[0].role_name
                });
            } else if (!adminDetails) {
                // Admin exists in the role mapping but not in the admins table - this shouldn't happen
                res.json({ success: true, isAdmin: false, role: 'NOT_ADMIN' });
            } else if (adminDetails.status !== 'ACTIVE') {
                // Admin exists but is not active
                res.json({ success: true, isAdmin: false, role: 'NOT_ADMIN' });
            } else {
                // Admin is valid and active
                res.json({
                    success: true,
                    isAdmin: true,
                    role: data[0].role_name,
                    admin: adminDetails
                });
            }
        } else {
            // User exists in admins table but has no role
            res.json({ success: true, isAdmin: false, role: 'NOT_ADMIN' });
        }

        console.log('=== ADMIN CHECK END ===');
    } catch (error) {
        console.error('Check admin error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Assign role to admin
router.post('/promote-user', requireAdmin, async (req, res) => {
    try {
        const { email, role_name } = req.body;

        // The requireAdmin middleware already validates that the user is an admin
        // So we can proceed with the role assignment

        // First, get the admin by email
        const { data: admin, error: adminError } = await supabase
            .from('admins')
            .select('id, email, full_name')
            .eq('email', email)
            .single();

        if (adminError || !admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        // Get the role ID
        const { data: role, error: roleError } = await supabase
            .from('admin_roles')
            .select('id')
            .eq('role_name', role_name)
            .single();

        if (roleError || !role) {
            return res.status(400).json({
                success: false,
                message: `Invalid role: ${role_name}. Valid roles are SUPER_ADMIN, ADMIN, MODERATOR.`
            });
        }

        // Check if this admin already has this role
        const { data: existingMapping, error: mappingError } = await supabase
            .from('admin_role_map')
            .select('id')
            .eq('admin_id', admin.id)
            .eq('role_id', role.id)
            .single();

        if (existingMapping) {
            return res.status(400).json({
                success: false,
                message: `Admin already has the ${role_name} role`
            });
        }

        // Create the role mapping
        const { data: newRoleMapping, error: mappingCreationError } = await supabase
            .from('admin_role_map')
            .insert([{
                admin_id: admin.id,
                role_id: role.id
            }])
            .select()
            .single();

        if (mappingCreationError) {
            console.error('Assign role error:', mappingCreationError);
            return res.status(500).json({
                success: false,
                message: 'Error assigning role to admin',
                error: mappingCreationError.message
            });
        }

        res.json({
            success: true,
            message: `Role ${role_name} assigned to admin successfully`,
            role_mapping: newRoleMapping
        });
    } catch (error) {
        console.error('Assign role error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Remove role from admin
router.delete('/demote-moderator/:userId', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // The requireAdmin middleware already validates that the user is an admin
        // So we can proceed with the role removal

        // Find the admin by ID
        const { data: admin, error: adminError } = await supabase
            .from('admins')
            .select('id, email, full_name')
            .eq('id', userId)
            .single();

        if (adminError || !admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        // Remove all role mappings for this admin
        const { error: deleteError } = await supabase
            .from('admin_role_map')
            .delete()
            .eq('admin_id', userId);

        if (deleteError) {
            console.error('Remove admin roles error:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error removing roles from admin',
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: 'Admin roles removed successfully'
        });
    } catch (error) {
        console.error('Remove admin roles error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all admins with their roles
router.get('/moderators', requireAdmin, async (req, res) => {
    try {
        // The requireAdmin middleware already validates that the user is an admin
        // So we can proceed to get the admins list with their roles

        const { data: admins, error } = await supabase
            .from('admins')
            .select(`
                id,
                admin_id,
                email,
                full_name,
                status,
                created_at
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Get admins error:', error);
            return res.status(500).json({ success: false, message: error.message });
        }

        // For each admin, get their roles
        const adminsWithRoles = [];
        for (const admin of admins) {
            // Get roles for this admin
            const { data: roleMappings, error: roleError } = await supabase
                .from('admin_role_map')
                .select(`
                    admin_roles(role_name)
                `)
                .eq('admin_id', admin.id);

            if (roleError) {
                console.error('Error getting roles for admin:', admin.id, roleError);
                continue;
            }

            // Extract role names
            const roleNames = roleMappings.map(mapping => mapping.admin_roles?.role_name).filter(Boolean);

            adminsWithRoles.push({
                id: admin.id,
                user_id: admin.id, // Using admin id as user_id for compatibility
                permissions: {
                    can_manage_tournaments: roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN') || roleNames.includes('MODERATOR'),
                    can_view_user_data: roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN'),
                    can_manage_registrations: roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN') || roleNames.includes('MODERATOR'),
                    can_send_announcements: roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN'),
                    can_generate_reports: roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN')
                },
                user_info: {
                    student_id: null, // Not available for admins
                    email: admin.email,
                    full_name: admin.full_name
                },
                roles: roleNames, // Include the actual roles
                created_at: admin.created_at,
                updated_at: admin.created_at // Same as created_at for compatibility
            });
        }

        res.json({ success: true, moderators: adminsWithRoles });
    } catch (error) {
        console.error('Get admins error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create tournament
router.post('/tournaments', requireAdmin, upload.single('photo'), handleMulterError, async (req, res) => {
    try {
        console.log('Create tournament request received');
        console.log('Req.body:', req.body);
        console.log('Req.file:', req.file);
        let { title, deadline, games, description } = req.body;
        let photoPath = null;

        // Parse games if it's a string (from FormData)
        if (typeof games === 'string') {
            try {
                games = JSON.parse(games);
            } catch (parseError) {
                console.error('Error parsing games JSON:', parseError);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid games data format'
                });
            }
        }

        // If there's a photo file, move it to the correct location and store its path
        if (req.file) {
            console.log('Processing uploaded file:', req.file); // Debug logging
            try {
                // Sanitize the title to be filesystem-safe
                let tournamentTitle = title || 'untitled';
                tournamentTitle = tournamentTitle.replace(/[^a-zA-Z0-9-_]/g, '_');
                console.log('Sanitized tournament title:', tournamentTitle);

                // Create the path: uploads/tournament_title/title_pic/
                const tournamentDir = path.join(__dirname, '../uploads', tournamentTitle);
                const titlePicDir = path.join(tournamentDir, 'title_pic');
                console.log('Creating directories:', tournamentDir, titlePicDir);

                // Create directories if they don't exist
                if (!fs.existsSync(tournamentDir)) {
                    fs.mkdirSync(tournamentDir, { recursive: true });
                    console.log('Created tournament directory:', tournamentDir);
                }
                if (!fs.existsSync(titlePicDir)) {
                    fs.mkdirSync(titlePicDir, { recursive: true });
                    console.log('Created title_pic directory:', titlePicDir);
                }

                // Create the new file path
                const newFileName = 'tournament_image' + path.extname(req.file.originalname);
                const newFilePath = path.join(titlePicDir, newFileName);
                const oldFilePath = req.file.path; // This is the temp location
                console.log('Moving file from:', oldFilePath, 'to:', newFilePath);

                // Move the file to new location
                fs.renameSync(oldFilePath, newFilePath);
                console.log('File moved successfully');

                photoPath = `/uploads/${tournamentTitle}/title_pic/${newFileName}`; // Store relative path
                console.log('Set photoPath to:', photoPath);
            } catch (fileError) {
                console.error('Error processing uploaded file:', fileError);
                // Clean up any created directories if file processing fails
                try {
                    const tempDir = path.dirname(req.file.path);
                    if (tempDir && tempDir.includes('uploads/temp')) {
                        fs.unlinkSync(req.file.path); // Remove the temp file
                    }
                } catch (cleanupError) {
                    console.error('Error during file cleanup:', cleanupError);
                }
                return res.status(500).json({
                    success: false,
                    message: 'Error processing uploaded file: ' + fileError.message
                });
            }
        } else {
            console.log('No file uploaded, photoPath remains:', photoPath);
        }

        // Format deadline for Supabase
        let formattedDeadline;
        if (deadline instanceof Date) {
            formattedDeadline = deadline.toISOString();
        } else {
            // Handle the case where the date string is in local time format (YYYY-MM-DDTHH:mm)
            // If it's in the format from datetime-local input, we need to treat it as local time
            let dateObj;
            if (deadline.includes('T') && !deadline.includes('Z') && !deadline.includes('+') && !deadline.includes('-')) {
                // This is likely a datetime-local format, treat as local time
                // Convert to local date to UTC for storage
                const [datePart, timePart] = deadline.split('T');
                const [year, month, day] = datePart.split('-').map(Number);
                const [hours, minutes] = timePart.split(':').map(Number);

                // Create a date object with the local time values
                dateObj = new Date(year, month - 1, day, hours, minutes); // month is 0-indexed
            } else {
                // Standard date string, let JS handle it
                dateObj = new Date(deadline);
            }

            if (isNaN(dateObj.getTime())) {
                throw new Error('Invalid date format');
            }
            formattedDeadline = dateObj.toISOString();
        }

        console.log('About to insert tournament with photoPath:', photoPath, 'for title:', title); // Debug logging

        // Insert tournament using Supabase
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .insert([{
                title: title,
                photo_url: photoPath,
                registration_deadline: formattedDeadline,
                created_by: 1, // Assuming a default admin user ID
                description: description || null
            }])
            .select()
            .single();

        if (tournamentError) {
            console.error('Error inserting tournament:', tournamentError);
            return res.status(500).json({
                success: false,
                message: 'Error creating tournament',
                error: tournamentError.message
            });
        }

        const tournamentId = tournament.id;
        console.log('Tournament inserted successfully with ID:', tournamentId);

        // Insert games if there are any
        if (games && games.length > 0) {
            for (const game of games) {
                try {
                    // Map game types to allowed database values
                    let dbGameType = game.type;
                    if (game.type === 'Duo (Mixed)') {
                        dbGameType = 'Custom'; // Map Duo (Mixed) to Custom since it's a custom format
                    } else if (game.type.includes('v')) {
                        // For team sizes like "5v5", "6v6", etc., store as 'Custom'
                        dbGameType = 'Custom';
                    } else if (!['Solo', 'Duo', 'Custom'].includes(game.type)) {
                        // For any other custom format, use 'Custom'
                        dbGameType = 'Custom';
                    }

                    const { error: gameError } = await supabase
                        .from('tournament_games')
                        .insert([{
                            tournament_id: tournamentId,
                            category: game.category,
                            game_name: game.name,
                            game_type: dbGameType,
                            fee_per_person: game.fee
                        }]);

                    if (gameError) {
                        console.error('Error inserting game:', game, 'Error:', gameError);
                        throw gameError;
                    }
                } catch (gameError) {
                    console.error('Error inserting game:', game, 'Error:', gameError);
                    throw gameError; // Re-throw to be caught by outer try-catch
                }
            }
        }

        res.json({ success: true, tournamentId });
    } catch (error) {
        console.error('Create tournament error:', error);
        // If there was an error and a photo was uploaded, make sure to clean it up
        if (req.file) {
            try {
                const tempDir = path.dirname(req.file.path);
                if (tempDir && tempDir.includes('uploads/temp')) {
                    fs.unlinkSync(req.file.path); // Remove the temp file
                }
            } catch (cleanupError) {
                console.error('Error during file cleanup:', cleanupError);
            }
        }
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all tournaments
router.get('/tournaments', async (req, res) => {
    try {
        const { data: tournaments, error } = await supabase
            .from('tournaments')
            .select('id, title, photo_url, registration_deadline, status, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Get tournaments error:', error);
            res.status(500).json({ success: false, message: error.message });
        } else {
            // Format dates to match expected format
            const formattedTournaments = tournaments.map(tournament => ({
                ...tournament,
                deadline: new Date(tournament.registration_deadline).toISOString().slice(0, 19).replace('T', ' '),
                created_date: new Date(tournament.created_at).toISOString().slice(0, 10)
            }));

            console.log('Raw tournament data from DB:', formattedTournaments); // Debug logging
            res.json({ success: true, tournaments: formattedTournaments });
        }
    } catch (error) {
        console.error('Get tournaments error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get tournament games
router.get('/tournaments/:id/games', async (req, res) => {
    try {
        const tournamentId = req.params.id;

        const { data: games, error } = await supabase
            .from('tournament_games')
            .select('id, category, game_name, game_type, fee_per_person')
            .eq('tournament_id', tournamentId)
            .order('category')
            .order('game_name');

        if (error) {
            console.error('Get games error:', error);
            res.status(500).json({ success: false, message: error.message });
        } else {
            res.json({ success: true, games: games });
        }
    } catch (error) {
        console.error('Get games error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update tournament
router.put('/tournaments/:id', requireAdmin, (req, res, next) => {
    // Check if the request contains multipart/form-data (file upload)
    if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
        // Use upload middleware for file uploads
        upload.single('photo')(req, res, (err) => {
            if (err) {
                return handleMulterError(err, req, res, next);
            }
            next();
        });
    } else {
        // For JSON requests, just continue
        next();
    }
}, async (req, res) => {
    try {
        console.log('Update tournament request received for ID:', req.params.id);
        console.log('Req.body:', req.body);
        console.log('Req.file:', req.file);
        const tournamentId = req.params.id;
        let { title, deadline, description, games } = req.body;
        let photoPath = null;

        // Parse games if it's a string (from FormData)
        if (typeof games === 'string') {
            try {
                games = JSON.parse(games);
            } catch (parseError) {
                console.error('Error parsing games JSON:', parseError);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid games data format'
                });
            }
        }

        // First check if tournament exists and get the current photo path
        const { data: currentTournament, error: checkError } = await supabase
            .from('tournaments')
            .select('id, title as tournament_title, photo_url')
            .eq('id', tournamentId)
            .single();

        if (checkError) {
            console.error('Database error when fetching tournament:', checkError);
            return res.status(500).json({
                success: false,
                message: 'Database error occurred while fetching tournament'
            });
        }

        if (!currentTournament) {
            console.log(`Tournament with ID ${tournamentId} does not exist in the database`);
            return res.status(404).json({
                success: false,
                message: `Tournament with ID ${tournamentId} does not exist`
            });
        }

        console.log('Current tournament data:', currentTournament);

        // If there's a photo file, handle the file upload
        if (req.file) {
            console.log('Processing uploaded file for update:', req.file);
            try {
                // Sanitize the title to be filesystem-safe
                let tournamentTitle = title || currentTournament.tournament_title || 'untitled';
                tournamentTitle = tournamentTitle.replace(/[^a-zA-Z0-9-_]/g, '_');

                // Create the path: uploads/tournament_title/title_pic/
                const tournamentDir = path.join(__dirname, '../uploads', tournamentTitle);
                const titlePicDir = path.join(tournamentDir, 'title_pic');

                // Create directories if they don't exist
                if (!fs.existsSync(tournamentDir)) {
                    fs.mkdirSync(tournamentDir, { recursive: true });
                }
                if (!fs.existsSync(titlePicDir)) {
                    fs.mkdirSync(titlePicDir, { recursive: true });
                }

                // Create the new file path
                const newFileName = 'tournament_image' + path.extname(req.file.originalname);
                const newFilePath = path.join(titlePicDir, newFileName);
                const oldFilePath = req.file.path; // This is the temp location

                // Move the file to new location
                fs.renameSync(oldFilePath, newFilePath);

                // If there was a previous photo, delete it from the filesystem
                if (currentTournament.photo_url) {
                    const oldStoredFilePath = path.join(__dirname, '..', currentTournament.photo_url);
                    if (fs.existsSync(oldStoredFilePath)) {
                        try {
                            fs.unlinkSync(oldStoredFilePath); // Delete old file
                            console.log('Deleted old photo file:', oldStoredFilePath);
                        } catch (err) {
                            console.error('Error deleting old photo:', err);
                            // Continue even if old file couldn't be deleted
                        }
                    }
                }

                photoPath = `/uploads/${tournamentTitle}/title_pic/${newFileName}`; // Store relative path
                console.log('Set new photoPath to:', photoPath);
            } catch (fileError) {
                console.error('Error processing uploaded file for update:', fileError);
                // Clean up any created directories if file processing fails
                try {
                    const tempDir = path.dirname(req.file.path);
                    if (tempDir && tempDir.includes('uploads/temp')) {
                        fs.unlinkSync(req.file.path); // Remove the temp file
                    }
                } catch (cleanupError) {
                    console.error('Error during file cleanup in update:', cleanupError);
                }
                return res.status(500).json({
                    success: false,
                    message: 'Error processing uploaded file: ' + fileError.message
                });
            }
        } else {
            console.log('No new file uploaded, photoPath remains:', photoPath);
        }

        // Format the deadline properly for Supabase
        let formattedDeadline;
        if (deadline instanceof Date) {
            formattedDeadline = deadline.toISOString();
        } else {
            // Handle the case where the date string is in local time format (YYYY-MM-DDTHH:mm)
            // If it's in the format from datetime-local input, we need to treat it as local time
            let dateObj;
            if (deadline.includes('T') && !deadline.includes('Z') && !deadline.includes('+') && !deadline.includes('-')) {
                // This is likely a datetime-local format, treat as local time
                // Convert to local date to UTC for storage
                const [datePart, timePart] = deadline.split('T');
                const [year, month, day] = datePart.split('-').map(Number);
                const [hours, minutes] = timePart.split(':').map(Number);

                // Create a date object with the local time values
                dateObj = new Date(year, month - 1, day, hours, minutes); // month is 0-indexed
            } else {
                // Standard date string, let JS handle it
                dateObj = new Date(deadline);
            }

            if (isNaN(dateObj.getTime())) {
                // If the date is invalid, throw an error
                throw new Error('Invalid date format');
            }
            formattedDeadline = dateObj.toISOString();
        }

        console.log('Updating tournament with photoPath:', photoPath, 'for tournament ID:', tournamentId); // Debug logging
        // Update tournament information
        let updateData = {
            title: title,
            registration_deadline: formattedDeadline
        };

        // Add description only if provided
        if (description !== undefined) {
            updateData.description = description;
        }

        // Add photoPath only if provided, otherwise preserve existing photo_url
        if (photoPath) {
            updateData.photo_url = photoPath;
            console.log('Including photo_url in update with value:', photoPath);
        } else {
            console.log('photoPath is falsy, preserving existing photo_url');
        }

        const { error: updateError } = await supabase
            .from('tournaments')
            .update(updateData)
            .eq('id', tournamentId);

        if (updateError) {
            console.error('Error updating tournament:', updateError);
            return res.status(500).json({
                success: false,
                message: 'Error updating tournament',
                error: updateError.message
            });
        }

        // Delete existing games for this tournament
        const { error: deleteError } = await supabase
            .from('tournament_games')
            .delete()
            .eq('tournament_id', tournamentId);

        if (deleteError) {
            console.error('Error deleting existing games:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error updating tournament',
                error: deleteError.message
            });
        }

        // Insert new games if provided
        if (games && games.length > 0) {
            for (const game of games) {
                // Map game types to allowed database values to comply with CHK_GAME_TYPE constraint
                let dbGameType = game.type;
                if (game.type === 'Duo (Mixed)') {
                    dbGameType = 'Custom'; // Map Duo (Mixed) to Custom since it's a custom format
                } else if (game.type.includes('v')) {
                    // For team sizes like "5v5", "6v6", etc., store as 'Custom'
                    dbGameType = 'Custom';
                } else if (!['Solo', 'Duo', 'Custom'].includes(game.type)) {
                    // For any other custom format, use 'Custom'
                    dbGameType = 'Custom';
                }

                const { error: gameError } = await supabase
                    .from('tournament_games')
                    .insert([{
                        tournament_id: tournamentId,
                        category: game.category,
                        game_name: game.name,
                        game_type: dbGameType, // Use mapped type that's allowed by the constraint
                        fee_per_person: game.fee
                    }]);

                if (gameError) {
                    console.error('Error inserting game:', game, 'Error:', gameError);
                    throw gameError;
                }
            }
        }

        res.json({
            success: true,
            message: 'Tournament updated successfully'
        });
    } catch (error) {
        console.error('Update tournament error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Delete tournament
router.delete('/tournaments/:id', requireAdmin, async (req, res) => {
    try {
        const tournamentId = req.params.id;

        // First check if tournament exists
        const { data: tournament, error: checkError } = await supabase
            .from('tournaments')
            .select('id')
            .eq('id', tournamentId)
            .single();

        if (checkError || !tournament) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
            });
        }

        // Delete associated games first (due to foreign key constraint)
        const { error: deleteGamesError } = await supabase
            .from('tournament_games')
            .delete()
            .eq('tournament_id', tournamentId);

        if (deleteGamesError) {
            console.error('Error deleting associated games:', deleteGamesError);
            return res.status(500).json({
                success: false,
                message: 'Error deleting tournament games',
                error: deleteGamesError.message
            });
        }

        // Then delete the tournament
        const { error: deleteTournamentError } = await supabase
            .from('tournaments')
            .delete()
            .eq('id', tournamentId);

        if (deleteTournamentError) {
            console.error('Error deleting tournament:', deleteTournamentError);
            return res.status(500).json({
                success: false,
                message: 'Error deleting tournament',
                error: deleteTournamentError.message
            });
        }

        res.json({
            success: true,
            message: 'Tournament deleted successfully'
        });
    } catch (error) {
        console.error('Delete tournament error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get all admin roles
router.get('/roles', requireAdmin, async (req, res) => {
    try {
        const { data: roles, error } = await supabase
            .from('admin_roles')
            .select('*')
            .order('role_name');

        if (error) {
            console.error('Get roles error:', error);
            return res.status(500).json({ success: false, message: error.message });
        }

        res.json({ success: true, roles });
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create a new admin (without role initially)
router.post('/create-admin', requireAdmin, async (req, res) => {
    try {
        const { email, full_name, admin_id } = req.body;

        // Check if admin already exists
        const { data: existingAdmin, error: existingError } = await supabase
            .from('admins')
            .select('id')
            .eq('email', email)
            .single();

        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'Admin with this email already exists'
            });
        }

        // Create admin entry
        const { data: newAdmin, error: adminError } = await supabase
            .from('admins')
            .insert([{
                admin_id: admin_id || null,
                email: email,
                full_name: full_name,
                status: 'ACTIVE'
            }])
            .select()
            .single();

        if (adminError) {
            console.error('Create admin error:', adminError);
            return res.status(500).json({
                success: false,
                message: 'Error creating admin',
                error: adminError.message
            });
        }

        res.json({
            success: true,
            message: 'Admin created successfully',
            admin: newAdmin
        });
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;