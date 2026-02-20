const { supabase } = require('../config/supabase');

const debugSchema = async (req, res) => {
    try {
        // Query 1: Check columns via selecting * (limit 0) usually gives structure or just assume if select fails
        let columns = 'Skipped RPC';
        try {
            // Just try to select the column to see if it errors
            const { data, error } = await supabase
                .from('notifications')
                .select('action_taken')
                .limit(1);

            if (error) throw error;
            columns = 'Column action_taken exists';
        } catch (e) {
            columns = 'Column action_taken MISSING or Error: ' + e.message;
        }

        // Query 2: Get recent notifications
        const { data: notifications, error: notifError } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        // Query 3: Check if action_taken column exists by trying to select it specifically
        const { data: actionCheck, error: actionError } = await supabase
            .from('notifications')
            .select('id, action_taken')
            .limit(1);

        res.json({
            success: true,
            columns: columns,
            notifications: notifications,
            actionColumnCheck: {
                data: actionCheck,
                error: actionError ? actionError.message : 'Column exists'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { debugSchema };
