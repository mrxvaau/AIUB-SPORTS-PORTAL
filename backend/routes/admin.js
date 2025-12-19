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

// Check if user is admin
router.post('/check-admin', async (req, res) => {
    try {
        const { email } = req.body;

        console.log('=== ADMIN CHECK START ===');
        console.log('Checking email:', email);

        const { data: admin, error } = await supabase
            .from('admins')
            .select('id, admin_id, email, full_name')
            .eq('email', email)
            .single();

        console.log('Admin found:', !!admin);
        console.log('=== ADMIN CHECK END ===');

        if (error) {
            if (error.code === 'PGRST116' || error.message.includes('Row not found')) {
                // No admin found, which is valid
                res.json({ success: true, isAdmin: false });
            } else {
                // Actual error occurred
                console.error('Check admin error:', error);
                res.status(500).json({ success: false, message: error.message });
            }
        } else if (admin) {
            res.json({ success: true, isAdmin: true, admin: admin });
        } else {
            res.json({ success: true, isAdmin: false });
        }
    } catch (error) {
        console.error('Check admin error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create tournament
router.post('/tournaments', upload.single('photo'), handleMulterError, async (req, res) => {
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
            const dateObj = new Date(deadline);
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
router.put('/tournaments/:id', upload.single('photo'), handleMulterError, async (req, res) => {
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

        if (checkError || !currentTournament) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
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
            // Try to create a date object from the string
            const dateObj = new Date(deadline);
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
router.delete('/tournaments/:id', async (req, res) => {
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

module.exports = router;