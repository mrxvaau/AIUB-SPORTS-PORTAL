// Notification Controller
// Handles user notifications

const { supabase } = require('../config/supabase');

// Get user notifications
const getNotifications = async (req, res) => {
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
            .select('*, action_taken')
            .eq('user_id', userId)
            .neq('status', 'ARCHIVED')
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
const markNotificationAsRead = async (req, res) => {
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

module.exports = {
    getNotifications,
    markNotificationAsRead
};
