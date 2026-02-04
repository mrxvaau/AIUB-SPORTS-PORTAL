// Team Controller
// Handles team creation, management, and invitations

const { supabase } = require('../config/supabase');

// Create a team for a tournament game
const createTeam = async (req, res) => {
    try {
        const { studentId, gameId, teamName } = req.body;

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

        // Check if registration deadline has passed for this tournament
        const { data: gameData, error: gameError } = await supabase
            .from('tournament_games')
            .select(`
                id,
                tournament_id,
                game_type,
                fee_per_person,
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

        // Check if user has already registered for this game (either individually or as team leader)
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

        // Check if user is already part of a team for this game
        const { data: existingTeamMember, error: teamMemberError } = await supabase
            .from('team_members')
            .select('id')
            .eq('user_id', userId)
            .eq('team.tournament_game_id', gameId)
            .single();

        if (existingTeamMember) {
            return res.status(400).json({
                success: false,
                message: 'Already part of a team for this game'
            });
        }

        // Create the team
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .insert([{
                tournament_game_id: gameId,
                team_name: teamName,
                leader_user_id: userId
            }])
            .select()
            .single();

        if (teamError) {
            console.error('Error creating team:', teamError);
            return res.status(500).json({
                success: false,
                message: 'Error creating team',
                error: teamError.message
            });
        }

        // Add the leader as the first team member
        const { data: teamMember, error: memberError } = await supabase
            .from('team_members')
            .insert([{
                team_id: team.id,
                user_id: userId,
                role: 'LEADER',
                status: 'CONFIRMED'
            }])
            .select()
            .single();

        if (memberError) {
            console.error('Error adding team leader:', memberError);
            // Rollback team creation if member addition fails
            await supabase.from('teams').delete().eq('id', team.id);
            return res.status(500).json({
                success: false,
                message: 'Error adding team leader',
                error: memberError.message
            });
        }

        // Register the team for the game (as a placeholder registration)
        const { data: registration, error: regError } = await supabase
            .from('game_registrations')
            .insert([{
                user_id: userId, // Leader's ID for tracking
                game_id: gameId,
                payment_status: 'PENDING'
            }])
            .select()
            .single();

        if (regError) {
            console.error('Error creating team registration:', regError);
            // Rollback if registration fails
            await supabase.from('team_members').delete().eq('id', teamMember.id);
            await supabase.from('teams').delete().eq('id', team.id);
            return res.status(500).json({
                success: false,
                message: 'Error registering team for game',
                error: regError.message
            });
        }

        res.json({
            success: true,
            message: 'Team created successfully',
            teamId: team.id,
            team: {
                id: team.id,
                name: team.team_name,
                leaderId: team.leader_user_id,
                status: team.status
            }
        });
    } catch (error) {
        console.error('Create team error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get team details by team ID
const getTeamDetails = async (req, res) => {
    try {
        const { teamId } = req.params;

        // Get team information
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select(`
                id,
                team_name,
                leader_user_id,
                status,
                tournament_game_id,
                created_at,
                updated_at,
                tournament_games(game_name, game_type, fee_per_person, category, tournament_id),
                tournaments(title)
            `)
            .eq('id', teamId)
            .single();

        if (teamError || !team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Get team members
        const { data: members, error: membersError } = await supabase
            .from('team_members')
            .select(`
                id,
                user_id,
                role,
                status,
                created_at,
                users(student_id, full_name, email)
            `)
            .eq('team_id', teamId)
            .order('role', { ascending: false }); // LEADER first

        if (membersError) {
            console.error('Error fetching team members:', membersError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching team members',
                error: membersError.message
            });
        }

        // Format the response
        const teamDetails = {
            id: team.id,
            name: team.team_name,
            leaderId: team.leader_user_id,
            status: team.status,
            game: {
                id: team.tournament_game_id,
                name: team.tournament_games.game_name,
                type: team.tournament_games.game_type,
                feePerPerson: team.tournament_games.fee_per_person,
                category: team.tournament_games.category,
                tournamentId: team.tournament_games.tournament_id,
                tournamentTitle: team.tournaments.title
            },
            members: members.map(member => ({
                id: member.id,
                userId: member.user_id,
                role: member.role,
                status: member.status,
                studentId: member.users?.student_id,
                fullName: member.users?.full_name,
                email: member.users?.email,
                createdAt: member.created_at
            })),
            createdAt: team.created_at,
            updatedAt: team.updated_at
        };

        res.json({
            success: true,
            team: teamDetails
        });
    } catch (error) {
        console.error('Get team details error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Add team member to a team
const addTeamMember = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { studentId } = req.body;

        // Get the team
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select(`
                id,
                team_name,
                leader_user_id,
                status,
                tournament_games(game_name, game_type, fee_per_person)
            `)
            .eq('id', teamId)
            .single();

        if (teamError || !team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Check if the current user is the team leader
        const currentUserId = req.user_id; // This would come from auth middleware
        if (team.leader_user_id !== currentUserId) {
            return res.status(403).json({
                success: false,
                message: 'Only team leader can add members'
            });
        }

        // Check if team is already confirmed
        if (team.status === 'CONFIRMED') {
            return res.status(400).json({
                success: false,
                message: 'Cannot add members to a confirmed team'
            });
        }

        // Get the user to add by student ID
        const { data: userToAdd, error: userError } = await supabase
            .from('users')
            .select('id, student_id, full_name, email')
            .eq('student_id', studentId)
            .single();

        let userIdToAdd;
        let isUserExisting = true;

        if (userError || !userToAdd) {
            userIdToAdd = null;
            isUserExisting = false;
        } else {
            userIdToAdd = userToAdd.id;
        }

        // Check if user is already in the team
        if (isUserExisting) {
            const { data: existingMember, error: existingError } = await supabase
                .from('team_members')
                .select('id')
                .eq('team_id', teamId)
                .eq('user_id', userIdToAdd)
                .single();

            if (existingMember) {
                return res.status(400).json({
                    success: false,
                    message: 'User is already a member of this team'
                });
            }
        }

        if (isUserExisting) {
            // Add the user as a team member with PENDING status
            const { data: teamMember, error: memberError } = await supabase
                .from('team_members')
                .insert([{
                    team_id: teamId,
                    user_id: userIdToAdd,
                    role: 'MEMBER',
                    status: 'PENDING'
                }])
                .select()
                .single();

            if (memberError) {
                console.error('Error adding team member:', memberError);
                return res.status(500).json({
                    success: false,
                    message: 'Error adding team member',
                    error: memberError.message
                });
            }

            // Create a notification for the user to join the team
            const { error: notificationError } = await supabase
                .from('notifications')
                .insert([{
                    user_id: userIdToAdd,
                    title: 'Team Invitation',
                    message: `You have been invited to join team "${team.team_name}" for game "${team.tournament_games.game_name}".`,
                    type: 'TEAM_REQUEST',
                    related_id: teamId,
                    related_type: 'TEAM_REQUEST'
                }]);

            if (notificationError) {
                console.error('Error creating notification:', notificationError);
            }

            res.json({
                success: true,
                message: 'Team member added successfully',
                member: teamMember
            });
        } else {
            res.json({
                success: true,
                message: 'Team invitation sent. User will be notified when they register.'
            });
        }
    } catch (error) {
        console.error('Add team member error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Accept team invitation
const acceptTeamInvitation = async (req, res) => {
    try {
        const { studentId, notificationId } = req.body;

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

        // Get the notification
        const { data: notification, error: notificationError } = await supabase
            .from('notifications')
            .select('id, related_id, status')
            .eq('id', notificationId)
            .eq('user_id', userId)
            .eq('type', 'TEAM_REQUEST')
            .single();

        if (notificationError || !notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        if (notification.status === 'READ') {
            return res.status(400).json({
                success: false,
                message: 'Invitation already processed'
            });
        }

        const teamId = notification.related_id;

        // Get the team
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('id, status')
            .eq('id', teamId)
            .single();

        if (teamError || !team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Update the team member status to CONFIRMED
        const { error: memberUpdateError } = await supabase
            .from('team_members')
            .update({ status: 'CONFIRMED' })
            .eq('team_id', teamId)
            .eq('user_id', userId);

        if (memberUpdateError) {
            console.error('Error updating team member status:', memberUpdateError);
            return res.status(500).json({
                success: false,
                message: 'Error accepting team invitation',
                error: memberUpdateError.message
            });
        }

        // Mark the notification as read
        await supabase
            .from('notifications')
            .update({ status: 'READ' })
            .eq('id', notificationId);

        res.json({
            success: true,
            message: 'Team invitation accepted successfully'
        });
    } catch (error) {
        console.error('Accept team invitation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Confirm team registration
const confirmTeamRegistration = async (req, res) => {
    try {
        const { teamId } = req.params;

        // Get the team
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select(`
                id,
                leader_user_id,
                status,
                tournament_games(game_type, fee_per_person)
            `)
            .eq('id', teamId)
            .single();

        if (teamError || !team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Check if the current user is the team leader
        const currentUserId = req.user_id; // This would come from auth middleware
        if (team.leader_user_id !== currentUserId) {
            return res.status(403).json({
                success: false,
                message: 'Only team leader can confirm registration'
            });
        }

        // Check if team is already confirmed
        if (team.status === 'CONFIRMED') {
            return res.status(400).json({
                success: false,
                message: 'Team registration already confirmed'
            });
        }

        // Check if all required members have confirmed
        const { data: teamMembers, error: membersError } = await supabase
            .from('team_members')
            .select('status')
            .eq('team_id', teamId);

        if (membersError) {
            console.error('Error fetching team members:', membersError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching team members',
                error: membersError.message
            });
        }

        const pendingMembers = teamMembers.filter(member => member.status !== 'CONFIRMED');
        if (pendingMembers.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'All team members must confirm before registration can be finalized'
            });
        }

        // Update team status to confirmed
        const { error: updateError } = await supabase
            .from('teams')
            .update({ status: 'CONFIRMED' })
            .eq('id', teamId);

        if (updateError) {
            console.error('Error confirming team registration:', updateError);
            return res.status(500).json({
                success: false,
                message: 'Error confirming team registration',
                error: updateError.message
            });
        }

        res.json({
            success: true,
            message: 'Team registration confirmed successfully'
        });
    } catch (error) {
        console.error('Confirm team registration error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all pending team invitations for a user
const getPendingTeamInvitations = async (req, res) => {
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

        // Get pending team invitations for the user
        const { data: invitations, error: invError } = await supabase
            .from('notifications')
            .select(`
                id,
                title,
                message,
                created_at,
                related_id as team_id
            `)
            .eq('user_id', userId)
            .eq('type', 'TEAM_REQUEST')
            .eq('status', 'UNREAD');

        if (invError) {
            console.error('Error fetching pending invitations:', invError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching pending invitations',
                error: invError.message
            });
        }

        res.json({
            success: true,
            invitations: invitations
        });
    } catch (error) {
        console.error('Get pending team invitations error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createTeam,
    getTeamDetails,
    addTeamMember,
    acceptTeamInvitation,
    confirmTeamRegistration,
    getPendingTeamInvitations
};
