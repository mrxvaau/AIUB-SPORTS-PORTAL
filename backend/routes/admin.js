const express = require('express');
const router = express.Router();
const db = require('../config/database');
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
    let connection;
    try {
        const { email } = req.body;
        
        console.log('=== ADMIN CHECK START ===');
        console.log('Checking email:', email);

        connection = await db.getConnection();
        
        const result = await connection.execute(
            `SELECT id, admin_id, email, full_name FROM admins WHERE email = :1`,
            [email],
            { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
        );

        console.log('Rows found:', result.rows.length);
        console.log('Result:', JSON.stringify(result.rows));
        console.log('=== ADMIN CHECK END ===');

        if (result.rows && result.rows.length > 0) {
            res.json({ success: true, isAdmin: true, admin: result.rows[0] });
        } else {
            res.json({ success: true, isAdmin: false });
        }
    } catch (error) {
        console.error('Check admin error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
});

// Create tournament
router.post('/tournaments', upload.single('photo'), handleMulterError, async (req, res) => {
    let tournamentId; // Declare at function scope to ensure it's always accessible

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

        let tournamentId;

        // Get the next sequence value
        const seqResult = await db.executeQuery('SELECT tournament_id_seq.NEXTVAL FROM DUAL');
        tournamentId = seqResult.rows[0]['NEXTVAL'];
        console.log('Generated tournament ID:', tournamentId);

        // Insert tournament using the retrieved ID - properly format the date
        let formattedDeadline;
        if (deadline instanceof Date) {
            formattedDeadline = deadline.toISOString().slice(0, 19).replace('T', ' ');
        } else {
            // Try to create a date object from the string
            const dateObj = new Date(deadline);
            if (isNaN(dateObj.getTime())) {
                // If the date is invalid, throw an error
                throw new Error('Invalid date format');
            }
            formattedDeadline = dateObj.toISOString().slice(0, 19).replace('T', ' ');
        }
        console.log('About to insert tournament with photoPath:', photoPath, 'for title:', title); // Debug logging
        await db.executeQuery(
            `INSERT INTO tournaments (id, title, photo_url, registration_deadline, created_by)
            VALUES (:1, :2, :3, TO_DATE(:4, 'YYYY-MM-DD HH24:MI:SS'), 1)`,
            [tournamentId, title, photoPath, formattedDeadline]
        );
        console.log('Tournament inserted successfully with ID:', tournamentId);

        // Insert games if there are any
        if (games && games.length > 0) {
            for (const game of games) {
                try {
                    const gameQuery = `
                        INSERT INTO tournament_games (tournament_id, category, game_name, game_type, fee_per_person)
                        VALUES (:1, :2, :3, :4, :5)
                    `;

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

                    await db.executeQuery(gameQuery, [
                        tournamentId,
                        game.category,
                        game.name,
                        dbGameType, // Use mapped type that's allowed by the constraint
                        game.fee
                    ]);
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
        const query = `
            SELECT id, title, photo_url,
                   TO_CHAR(registration_deadline, 'YYYY-MM-DD HH24:MI:SS') as deadline,
                   status, TO_CHAR(created_at, 'YYYY-MM-DD') as created_date
            FROM tournaments
            ORDER BY created_at DESC
        `;

        const result = await db.executeQuery(query);
        console.log('Raw tournament data from DB:', result.rows); // Debug logging
        res.json({ success: true, tournaments: result.rows });
    } catch (error) {
        console.error('Get tournaments error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get tournament games
router.get('/tournaments/:id/games', async (req, res) => {
    try {
        const query = `
            SELECT id, category, game_name, game_type, fee_per_person
            FROM tournament_games
            WHERE tournament_id = :id
            ORDER BY category, game_name
        `;

        const result = await db.executeQuery(query, [req.params.id]);
        res.json({ success: true, games: result.rows });
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
        let currentTournament;
        try {
            const checkQuery = `
                SELECT id, title as tournament_title, photo_url FROM tournaments WHERE id = :id
            `;
            const checkResult = await db.executeQuery(checkQuery, [tournamentId]);

            if (checkResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Tournament not found'
                });
            }

            currentTournament = checkResult.rows[0];
            console.log('Current tournament data:', currentTournament);
        } catch (checkError) {
            console.error('Error checking tournament existence:', checkError);
            return res.status(500).json({
                success: false,
                message: 'Error checking tournament: ' + checkError.message
            });
        }

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

        // Format the deadline properly for Oracle
        let formattedDeadline;
        if (deadline instanceof Date) {
            formattedDeadline = deadline.toISOString().slice(0, 19).replace('T', ' ');
        } else {
            // Try to create a date object from the string
            const dateObj = new Date(deadline);
            if (isNaN(dateObj.getTime())) {
                // If the date is invalid, throw an error
                throw new Error('Invalid date format');
            }
            formattedDeadline = dateObj.toISOString().slice(0, 19).replace('T', ' ');
        }

        console.log('Updating tournament with photoPath:', photoPath, 'for tournament ID:', tournamentId); // Debug logging
        // Update tournament information
        let updateQuery = `
            UPDATE tournaments
            SET title = :title, registration_deadline = TO_DATE(:deadline, 'YYYY-MM-DD HH24:MI:SS')
        `;
        let updateParams = [title, formattedDeadline];

        // Add description only if provided
        if (description !== undefined) {
            updateQuery += `, description = :description`;
            updateParams.push(description);
        }

        // Add photoPath only if provided, otherwise preserve existing photo_url
        if (photoPath) {
            updateQuery += `, photo_url = :photo_url`;
            updateParams.push(photoPath);
            console.log('Including photo_url in update with value:', photoPath);
        } else {
            console.log('photoPath is falsy, preserving existing photo_url');
            // If no new photo is provided, don't update the photo_url field by removing it from the query
            // This ensures the existing value is preserved
        }

        updateQuery += ` WHERE id = :tournament_id`;
        updateParams.push(tournamentId);

        await db.executeQuery(updateQuery, updateParams);

        // Delete existing games for this tournament
        const deleteGamesQuery = `
            DELETE FROM tournament_games WHERE tournament_id = :tournament_id
        `;
        await db.executeQuery(deleteGamesQuery, [tournamentId]);

        // Insert new games if provided
        if (games && games.length > 0) {
            for (const game of games) {
                const gameQuery = `
                    INSERT INTO tournament_games (tournament_id, category, game_name, game_type, fee_per_person)
                    VALUES (:tournament_id, :category, :game_name, :game_type, :fee)
                `;

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

                await db.executeQuery(gameQuery, [
                    tournamentId,
                    game.category,
                    game.name,
                    dbGameType, // Use mapped type that's allowed by the constraint
                    game.fee
                ]);
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
        const checkQuery = `
            SELECT id FROM tournaments WHERE id = :id
        `;
        const checkResult = await db.executeQuery(checkQuery, [tournamentId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
            });
        }

        // Delete associated games first (due to foreign key constraint)
        const deleteGamesQuery = `
            DELETE FROM tournament_games WHERE tournament_id = :tournament_id
        `;
        await db.executeQuery(deleteGamesQuery, [tournamentId]);

        // Then delete the tournament
        const deleteTournamentQuery = `
            DELETE FROM tournaments WHERE id = :tournament_id
        `;
        await db.executeQuery(deleteTournamentQuery, [tournamentId]);

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