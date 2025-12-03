const express = require('express');
const router = express.Router();
const db = require('../config/database');

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
router.post('/tournaments', async (req, res) => {
    try {
        const { title, photoUrl, deadline, games, description } = req.body;

        // Get the next sequence value
        const seqResult = await db.executeQuery('SELECT tournament_id_seq.NEXTVAL FROM DUAL');
        const tournamentId = seqResult.rows[0]['NEXTVAL'];

        // Insert tournament using the retrieved ID - properly format the date
        const formattedDeadline = new Date(deadline).toISOString().slice(0, 19).replace('T', ' ');
        await db.executeQuery(
            `INSERT INTO tournaments (id, title, photo_url, registration_deadline, created_by)
            VALUES (:1, :2, :3, TO_DATE(:4, 'YYYY-MM-DD HH24:MI:SS'), 1)`,
            [tournamentId, title, photoUrl, formattedDeadline]
        );

        // Insert games if there are any
        if (games && games.length > 0) {
            for (const game of games) {
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
            }
        }

        res.json({ success: true, tournamentId });
    } catch (error) {
        console.error('Create tournament error:', error);
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
router.put('/tournaments/:id', async (req, res) => {
    try {
        const tournamentId = req.params.id;
        const { title, photoUrl, deadline, description, games } = req.body;

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

        // Format the deadline properly for Oracle
        const formattedDeadline = new Date(deadline).toISOString().slice(0, 19).replace('T', ' ');

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

        // Add photoUrl only if provided
        if (photoUrl) {
            updateQuery += `, photo_url = :photo_url`;
            updateParams.push(photoUrl);
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