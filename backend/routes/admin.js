const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const multer = require('multer');
const path = require('path');
const registrationController = require('../controllers/registrationController');
const teamController = require('../controllers/teamController');

// fs not needed — file uploads go directly to Supabase Storage

// REMOVED: /run-migration endpoint — allowed unauthenticated SQL execution (CRITICAL SECURITY FIX)
// Use backend/run-migration.js CLI script instead if migrations are needed.

// Configure multer — memory storage; buffer is uploaded directly to Supabase Storage
// This avoids writing to local disk entirely, making the app stateless and safe for
// multi-server / containerised deployments where servers do not share a filesystem.
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        console.log('Validating uploaded file:', file.originalname, 'Mimetype:', file.mimetype);
        if (file.mimetype.startsWith('image/')) {
            console.log('File accepted:', file.originalname);
            return cb(null, true);
        } else {
            console.log('File rejected - not an image:', file.originalname);
            return cb(new Error('Only image files are allowed!'), false);
        }
    },
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

/**
 * Extract the Supabase Storage object key from a public URL.
 * e.g. "https://xxx.supabase.co/storage/v1/object/public/tournament-photos/tournaments/foo.jpg"
 *   -> "tournaments/foo.jpg"
 */
function extractStorageKey(publicUrl, bucketName) {
    if (!publicUrl) return null;
    const marker = `/storage/v1/object/public/${bucketName}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

// Import JWT-based admin authentication middleware
const { requireAdmin, requireAuth } = require('../middleware/auth');

// Check if user is admin - JWT VERSION
// This endpoint is used by frontend to check admin status after login
// Protected with requireAuth — anyone authenticated can check their admin status
router.post('/check-admin', requireAuth, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Extract student ID from email
        const studentId = email.split('@')[0];

        // Check if user exists in users table and has admin roles
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, student_id, email, full_name')
            .eq('student_id', studentId)
            .single();

        let roles = [];
        let isAdmin = false;

        if (user) {
            // Check roles by user ID
            const { data: userRoleData } = await supabase
                .from('admin_role_map')
                .select('admin_roles(role_name)')
                .eq('admin_id', user.id);

            if (userRoleData && userRoleData.length > 0) {
                roles = userRoleData.map(r => r.admin_roles.role_name);
                isAdmin = true;
            }
        }

        // Also check admins table by email
        if (!isAdmin) {
            const { data: adminRecord } = await supabase
                .from('admins')
                .select('id, email, full_name, status')
                .eq('email', email)
                .single();

            if (adminRecord && (adminRecord.status === 'ACTIVE' || !adminRecord.status)) {
                const { data: adminRoleData } = await supabase
                    .from('admin_role_map')
                    .select('admin_roles(role_name)')
                    .eq('admin_id', adminRecord.id);

                if (adminRoleData && adminRoleData.length > 0) {
                    roles = adminRoleData.map(r => r.admin_roles.role_name);
                    isAdmin = true;
                }
            }
        }

        res.json({
            success: true,
            isAdmin: isAdmin,
            roles: roles,
            role: roles[0] || 'ADMIN',
            admin: user || null
        });
    } catch (error) {
        console.error('Check admin error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
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

        // For each admin, get their roles and permissions
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

            // Get permissions for each role
            let permissions = {};
            for (const roleMapping of roleMappings) {
                const { data: permData, error: permError } = await supabase
                    .from('role_permissions')
                    .select(`
                        permissions(permission_name)
                    `)
                    .eq('role_id', roleMapping.admin_roles.id);

                if (permData) {
                    permData.forEach(perm => {
                        // Convert permission name to camelCase for the response
                        const permName = perm.permissions.permission_name
                            .toLowerCase()
                            .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
                        permissions[permName] = true;
                    });
                }
            }

            adminsWithRoles.push({
                id: admin.id,
                user_id: admin.id, // Using admin id as user_id for compatibility
                permissions: permissions,
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

        // If there's a photo file, upload it to Supabase Storage
        if (req.file) {
            console.log('Uploading photo to Supabase Storage:', req.file.originalname);
            try {
                const sanitizedTitle = (title || 'untitled').replace(/[^a-zA-Z0-9-_]/g, '_');
                const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
                // Unique key: tournaments/<title>_<timestamp>.<ext>
                const storageKey = `tournaments/${sanitizedTitle}_${Date.now()}${ext}`;

                const { error: uploadError } = await supabase.storage
                    .from('tournament-photos')
                    .upload(storageKey, req.file.buffer, {
                        contentType: req.file.mimetype,
                        upsert: false
                    });

                if (uploadError) throw new Error('Supabase Storage upload failed: ' + uploadError.message);

                const { data: urlData } = supabase.storage
                    .from('tournament-photos')
                    .getPublicUrl(storageKey);

                photoPath = urlData.publicUrl;
                console.log('Photo uploaded to Supabase Storage:', photoPath);
            } catch (fileError) {
                console.error('Error uploading photo to Supabase Storage:', fileError);
                return res.status(500).json({
                    success: false,
                    message: 'Error uploading photo: ' + fileError.message
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
                    let teamSize = game.team_size || 1; // Default to 1 (solo)

                    if (game.type === 'Duo (Mixed)') {
                        dbGameType = 'Custom'; // Map Duo (Mixed) to Custom since it's a custom format
                        teamSize = 2;
                    } else if (game.type === 'Duo') {
                        teamSize = 2;
                    } else if (game.type.includes('v')) {
                        // For team sizes like "5v5", "6v6", etc., store as 'Custom'
                        dbGameType = 'Custom';
                        // Extract team size from format like "5v5"
                        const match = game.type.match(/(\d+)v\d+/);
                        if (match) {
                            teamSize = parseInt(match[1], 10);
                        }
                    } else if (!['Solo', 'Duo', 'Custom'].includes(game.type)) {
                        // For any other custom format, use 'Custom'
                        dbGameType = 'Custom';
                    }

                    // Mix category games are duo by default if not specified
                    if (game.category === 'Mix' && !game.team_size) {
                        teamSize = 2;
                    }

                    const { error: gameError } = await supabase
                        .from('tournament_games')
                        .insert([{
                            tournament_id: tournamentId,
                            category: game.category,
                            game_name: game.name,
                            game_type: dbGameType,
                            fee_per_person: game.fee,
                            team_size: teamSize,
                            participant_roles: game.participant_roles || 'student',
                            allow_cross_roles: game.allow_cross_roles || false
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
        // No local temp file to clean up — uploads go directly to Supabase Storage
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all tournaments
router.get('/tournaments', requireAdmin, async (req, res) => {
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
router.get('/tournaments/:id/games', requireAdmin, async (req, res) => {
    try {
        const tournamentId = req.params.id;

        const { data: games, error } = await supabase
            .from('tournament_games')
            .select('id, category, game_name, game_type, fee_per_person, team_size, participant_roles, allow_cross_roles')
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
            .select('id, title, photo_url')
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

        // If there's a photo file, upload it to Supabase Storage
        if (req.file) {
            console.log('Uploading new photo to Supabase Storage:', req.file.originalname);
            try {
                // Delete the old photo from Supabase Storage (if it's a Supabase URL)
                if (currentTournament.photo_url) {
                    const oldKey = extractStorageKey(currentTournament.photo_url, 'tournament-photos');
                    if (oldKey) {
                        const { error: removeError } = await supabase.storage
                            .from('tournament-photos')
                            .remove([oldKey]);
                        if (removeError) {
                            console.warn('Could not delete old photo from Supabase Storage:', removeError.message);
                        } else {
                            console.log('Deleted old photo from Supabase Storage:', oldKey);
                        }
                    }
                    // If it was a local /uploads path (legacy), we leave it — backward compat
                }

                const sanitizedTitle = (title || currentTournament.title || 'untitled').replace(/[^a-zA-Z0-9-_]/g, '_');
                const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
                const storageKey = `tournaments/${sanitizedTitle}_${Date.now()}${ext}`;

                const { error: uploadError } = await supabase.storage
                    .from('tournament-photos')
                    .upload(storageKey, req.file.buffer, {
                        contentType: req.file.mimetype,
                        upsert: false
                    });

                if (uploadError) throw new Error('Supabase Storage upload failed: ' + uploadError.message);

                const { data: urlData } = supabase.storage
                    .from('tournament-photos')
                    .getPublicUrl(storageKey);

                photoPath = urlData.publicUrl;
                console.log('New photo uploaded to Supabase Storage:', photoPath);
            } catch (fileError) {
                console.error('Error uploading photo to Supabase Storage (update):', fileError);
                return res.status(500).json({
                    success: false,
                    message: 'Error uploading photo: ' + fileError.message
                });
            }
        } else {
            console.log('No new file uploaded, photoPath remains:', photoPath);
        }

        // Format the deadline properly for Supabase
        let formattedDeadline;
        if (!deadline) {
            return res.status(400).json({
                success: false,
                message: 'Deadline is required'
            });
        }

        if (deadline instanceof Date) {
            formattedDeadline = deadline.toISOString();
        } else {
            // Handle the case where the date string is in local time format (YYYY-MM-DDTHH:mm)
            // datetime-local inputs give us format like "2024-02-05T14:30" without timezone
            let dateObj;
            // Check if it's a datetime-local format (has T separator, no Z or + timezone indicator)
            const isDatetimeLocal = deadline.includes('T') && !deadline.includes('Z') && !deadline.includes('+') && deadline.split('T')[1] && !deadline.split('T')[1].includes('-');

            if (isDatetimeLocal) {
                // This is likely a datetime-local format, treat as local time
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
                // If the date is invalid, return error
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format for deadline'
                });
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

        // Handle games update - PRESERVE existing game IDs to maintain registration links!
        // Don't delete all games - only update/add/remove as needed

        // First, get existing games for this tournament
        const { data: existingGames, error: fetchGamesError } = await supabase
            .from('tournament_games')
            .select('id, category, game_name, game_type, fee_per_person')
            .eq('tournament_id', tournamentId);

        if (fetchGamesError) {
            console.error('Error fetching existing games:', fetchGamesError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching existing games',
                error: fetchGamesError.message
            });
        }

        // Create a map of existing games by category+name+type for quick lookup
        const existingGamesMap = new Map();
        (existingGames || []).forEach(game => {
            const key = `${game.category}|${game.game_name}|${game.game_type}`;
            existingGamesMap.set(key, game);
        });

        // Track which existing game IDs we're keeping
        const keptGameIds = new Set();

        // Process incoming games
        if (games && games.length > 0) {
            for (const game of games) {
                // Map game types to allowed database values
                let dbGameType = game.type;
                if (game.type === 'Duo (Mixed)') {
                    dbGameType = 'Custom';
                } else if (game.type.includes('v')) {
                    dbGameType = 'Custom';
                } else if (!['Solo', 'Duo', 'Custom'].includes(game.type)) {
                    dbGameType = 'Custom';
                }

                // Check if this game already exists
                const key = `${game.category}|${game.name}|${dbGameType}`;
                const existingGame = existingGamesMap.get(key);

                if (existingGame) {
                    // Game exists - mark as kept (preserve the ID!)
                    keptGameIds.add(existingGame.id);

                    // Update fee if changed
                    if (Number(existingGame.fee_per_person) !== Number(game.fee)) {
                        const { error: updateGameError } = await supabase
                            .from('tournament_games')
                            .update({ fee_per_person: game.fee })
                            .eq('id', existingGame.id);

                        if (updateGameError) {
                            console.error('Error updating game fee:', updateGameError);
                        }
                    }
                } else {
                    // New game - insert it
                    const { error: gameError } = await supabase
                        .from('tournament_games')
                        .insert([{
                            tournament_id: tournamentId,
                            category: game.category,
                            game_name: game.name,
                            game_type: dbGameType,
                            fee_per_person: game.fee,
                            participant_roles: game.participant_roles || 'student',
                            allow_cross_roles: game.allow_cross_roles || false
                        }]);

                    if (gameError) {
                        console.error('Error inserting game:', game, 'Error:', gameError);
                        throw gameError;
                    }
                }
            }
        }

        // Delete games that are no longer in the list BUT check for registrations first!
        const gamesToDelete = (existingGames || []).filter(g => !keptGameIds.has(g.id));

        for (const gameToDelete of gamesToDelete) {
            // Check if there are any registrations for this game
            const { data: registrations, error: regCheckError } = await supabase
                .from('game_registrations')
                .select('id')
                .eq('game_id', gameToDelete.id)
                .limit(1);

            if (regCheckError) {
                console.error('Error checking registrations for game:', gameToDelete.id, regCheckError);
                continue; // Skip this game, don't delete
            }

            if (registrations && registrations.length > 0) {
                // Game has registrations - DON'T delete, just log warning
                console.warn(`Cannot delete game ${gameToDelete.id} (${gameToDelete.game_name}) - has active registrations`);
                // Optionally, you could mark the game as inactive instead of deleting
            } else {
                // No registrations - safe to delete
                const { error: deleteGameError } = await supabase
                    .from('tournament_games')
                    .delete()
                    .eq('id', gameToDelete.id);

                if (deleteGameError) {
                    console.error('Error deleting game:', gameToDelete.id, deleteGameError);
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

        // Get game IDs first to delete registrations
        const { data: games, error: gamesError } = await supabase
            .from('tournament_games')
            .select('id')
            .eq('tournament_id', tournamentId);

        if (gamesError) {
            console.error('Error fetching games for deletion:', gamesError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching games',
                error: gamesError.message
            });
        }

        const gameIds = games.map(g => g.id);

        if (gameIds.length > 0) {
            // Delete registrations for these games
            const { error: deleteRegistrationsError } = await supabase
                .from('game_registrations')
                .delete()
                .in('game_id', gameIds);

            if (deleteRegistrationsError) {
                console.error('Error deleting game registrations:', deleteRegistrationsError);
                return res.status(500).json({
                    success: false,
                    message: 'Error deleting game registrations',
                    error: deleteRegistrationsError.message
                });
            }
        }

        // Delete associated games
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

// REMOVED: Duplicate router.post('/create-admin') — identical to the one above (line ~1079)

// REMOVED: Duplicate router.get('/roles') — identical to the one above (line ~1059)

// Assign role to admin
router.post('/assign-role', requireAdmin, async (req, res) => {
    try {
        const { admin_id, role_name } = req.body;

        // The requireAdmin middleware already validates that the user is an admin
        // So we can proceed with the role assignment

        // First, get the admin by ID
        const { data: admin, error: adminError } = await supabase
            .from('admins')
            .select('id, email, full_name')
            .eq('id', admin_id)
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
                message: `Invalid role: ${role_name}.`
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
router.delete('/remove-role/:adminId/:roleId', requireAdmin, async (req, res) => {
    try {
        const { adminId, roleId } = req.params;

        // The requireAdmin middleware already validates that the user is an admin
        // So we can proceed with the role removal

        // Find the admin by ID
        const { data: admin, error: adminError } = await supabase
            .from('admins')
            .select('id, email, full_name')
            .eq('id', adminId)
            .single();

        if (adminError || !admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        // Remove the specific role mapping
        const { error: deleteError } = await supabase
            .from('admin_role_map')
            .delete()
            .eq('admin_id', adminId)
            .eq('role_id', roleId);

        if (deleteError) {
            console.error('Remove admin role error:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error removing role from admin',
                error: deleteError.message
            });
        }

        res.json({
            success: true,
            message: 'Admin role removed successfully'
        });
    } catch (error) {
        console.error('Remove admin role error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all permissions
router.get('/permissions', requireAdmin, async (req, res) => {
    try {
        const { data: permissions, error } = await supabase
            .from('permissions')
            .select('*')
            .order('permission_name');

        if (error) {
            console.error('Get permissions error:', error);
            return res.status(500).json({ success: false, message: error.message });
        }

        res.json({ success: true, permissions });
    } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Assign permission to role
router.post('/assign-permission', requireAdmin, async (req, res) => {
    try {
        const { role_id, permission_id } = req.body;

        // Check if role and permission exist
        const { data: role, error: roleError } = await supabase
            .from('admin_roles')
            .select('id')
            .eq('id', role_id)
            .single();

        if (roleError || !role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        const { data: permission, error: permError } = await supabase
            .from('permissions')
            .select('id')
            .eq('id', permission_id)
            .single();

        if (permError || !permission) {
            return res.status(404).json({
                success: false,
                message: 'Permission not found'
            });
        }

        // Check if this role already has this permission
        const { data: existingMapping, error: mappingError } = await supabase
            .from('role_permissions')
            .select('id')
            .eq('role_id', role_id)
            .eq('permission_id', permission_id)
            .single();

        if (existingMapping) {
            return res.status(400).json({
                success: false,
                message: 'Role already has this permission'
            });
        }

        // Create the permission mapping
        const { data: newPermMapping, error: mappingCreationError } = await supabase
            .from('role_permissions')
            .insert([{
                role_id: role_id,
                permission_id: permission_id
            }])
            .select()
            .single();

        if (mappingCreationError) {
            console.error('Assign permission error:', mappingCreationError);
            return res.status(500).json({
                success: false,
                message: 'Error assigning permission to role',
                error: mappingCreationError.message
            });
        }

        res.json({
            success: true,
            message: 'Permission assigned to role successfully',
            permission_mapping: newPermMapping
        });
    } catch (error) {
        console.error('Assign permission error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get admin audit logs
router.get('/audit-logs', requireAdmin, async (req, res) => {
    try {
        const { data: logs, error } = await supabase
            .from('admin_audit_logs')
            .select(`
                id,
                admin_id,
                action,
                target_type,
                target_id,
                action_time,
                admins(full_name, email)
            `)
            .order('action_time', { ascending: false })
            .limit(100); // Limit to last 100 logs

        if (error) {
            console.error('Get audit logs error:', error);
            return res.status(500).json({ success: false, message: error.message });
        }

        // Format the logs
        const formattedLogs = logs.map(log => ({
            id: log.id,
            admin: log.admins ? {
                id: log.admins.id,
                full_name: log.admins.full_name,
                email: log.admins.email
            } : null,
            action: log.action,
            target: {
                type: log.target_type,
                id: log.target_id
            },
            timestamp: log.action_time
        }));

        res.json({ success: true, logs: formattedLogs });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get tournament requests
router.get('/tournament-requests', requireAdmin, async (req, res) => {
    try {
        const { data: requests, error } = await supabase
            .from('tournament_requests')
            .select(`
                id,
                requested_by,
                title,
                description,
                registration_deadline,
                status,
                reviewed_by,
                reviewed_at,
                created_at,
                admins(full_name, email)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Get tournament requests error:', error);
            return res.status(500).json({ success: false, message: error.message });
        }

        // Format the requests
        const formattedRequests = requests.map(request => ({
            id: request.id,
            requested_by: {
                id: request.requested_by,
                full_name: request.admins?.full_name || 'Unknown',
                email: request.admins?.email || 'unknown@example.com'
            },
            title: request.title,
            description: request.description,
            registration_deadline: request.registration_deadline,
            status: request.status,
            reviewed_by: request.reviewed_by,
            reviewed_at: request.reviewed_at,
            created_at: request.created_at
        }));

        res.json({ success: true, requests: formattedRequests });
    } catch (error) {
        console.error('Get tournament requests error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get game requests
router.get('/game-requests', requireAdmin, async (req, res) => {
    try {
        const { data: requests, error } = await supabase
            .from('game_requests')
            .select(`
                id,
                tournament_id,
                requested_by,
                game_name,
                category,
                game_type,
                status,
                approved_by,
                approved_at,
                admins(full_name, email)
            `)
            .order('approved_at', { ascending: false });

        if (error) {
            console.error('Get game requests error:', error);
            return res.status(500).json({ success: false, message: error.message });
        }

        // Format the requests
        const formattedRequests = requests.map(request => ({
            id: request.id,
            tournament_id: request.tournament_id,
            requested_by: {
                id: request.requested_by,
                full_name: request.admins?.full_name || 'Unknown',
                email: request.admins?.email || 'unknown@example.com'
            },
            game_name: request.game_name,
            category: request.category,
            game_type: request.game_type,
            status: request.status,
            approved_by: request.approved_by,
            approved_at: request.approved_at
        }));

        res.json({ success: true, requests: formattedRequests });
    } catch (error) {
        console.error('Get game requests error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// TUNNEL MANAGEMENT ROUTES
// ==========================================
const tunnelController = require('../controllers/tunnelController');

// Start port forwarding tunnels
router.post('/tunnel/start', requireAdmin, tunnelController.startTunnels);

// Stop port forwarding tunnels
router.post('/tunnel/stop', requireAdmin, tunnelController.stopTunnels);

// Get tunnel status
router.get('/tunnel/status', requireAdmin, tunnelController.getTunnelStatus);


// Update team member payment status (robust)
router.put('/team-members/:memberId/payment', requireAdmin, registrationController.updateTeamMemberPayment);

// Registration overview
router.get('/registrations/overview', requireAdmin, registrationController.getRegistrationOverview);

// Get registrations for a specific game (with optional search)
router.get('/games/:gameId/registrations', requireAdmin, registrationController.getGameRegistrations);

// Update payment status for a registration
router.put('/registrations/:registrationId/payment', requireAdmin, registrationController.updatePaymentStatus);

// Update team member status (admin override)
router.put('/team-members/:memberId/status', requireAdmin, teamController.updateTeamMemberStatus);

// Confirm registration (Cash Payment Override)
router.post('/registrations/confirm/:registrationId', requireAdmin, registrationController.confirmRegistration);

// Remove team member (admin override)
router.delete('/team-members/:memberId', requireAdmin, teamController.adminRemoveTeamMember);

// ============================================================
// SCHEDULING ENGINE ROUTES
// ============================================================
const schedulingController = require('../controllers/schedulingController');

// Game configs
router.get('/scheduling/configs/:tournamentId', requireAdmin, schedulingController.getGameConfigs);
router.post('/scheduling/configs/game/:gameId', requireAdmin, schedulingController.saveGameConfig);

// Schedule config (global time window)
router.post('/scheduling/config/:tournamentId', requireAdmin, schedulingController.saveScheduleConfig);

// Run scheduling algorithm
router.post('/scheduling/run/:tournamentId', requireAdmin, schedulingController.shuffleAndSchedule);

// Preview schedule (dry run - no DB writes)
router.post('/scheduling/preview/:tournamentId', requireAdmin, schedulingController.previewSchedule);

// Suggest optimal date ranges
router.post('/scheduling/suggest-dates/:tournamentId', requireAdmin, schedulingController.suggestDates);

// Results & reports
router.get('/scheduling/results/:tournamentId', requireAdmin, schedulingController.getScheduleResults);
router.get('/scheduling/report/:tournamentId', requireAdmin, schedulingController.getScheduleReport);
router.get('/scheduling/reports/all', requireAdmin, schedulingController.getAllReports);

// Match actions
router.post('/scheduling/match/:matchId/status', requireAdmin, schedulingController.updateMatchStatus);
router.post('/scheduling/match/:matchId/reschedule', requireAdmin, schedulingController.rescheduleMatch);

// Bracket
router.get('/scheduling/bracket/:tournamentId/:gameId', requireAdmin, schedulingController.getBracketData);

module.exports = router;
