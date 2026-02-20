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
                team_size,
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

        // Register the team for the game (link to team)
        const { data: registration, error: regError } = await supabase
            .from('game_registrations')
            .insert([{
                user_id: userId, // Leader's ID for tracking
                game_id: gameId,
                team_id: team.id, // Link to team
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

// Get team by game ID and student ID (for users who are members)
const getTeamByGame = async (req, res) => {
    try {
        const { gameId, studentId } = req.params;

        console.log(`getTeamByGame called: gameId=${gameId}, studentId=${studentId}`);

        // First, get the user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (userError || !user) {
            console.log('User not found:', studentId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('Found user:', user.id);

        // Find all teams where user is a member
        const { data: teamMembers, error: memberError } = await supabase
            .from('team_members')
            .select(`
                team_id,
                teams(
                    id,
                    team_name,
                    leader_user_id,
                    status,
                    tournament_game_id,
                    created_at,
                    tournament_games(game_name, game_type, fee_per_person, category, team_size, tournament_id)
                )
            `)
            .eq('user_id', user.id);

        if (memberError) {
            console.error('Error finding team members:', memberError);
            return res.status(500).json({
                success: false,
                message: 'Error searching for teams'
            });
        }

        console.log('Found team memberships:', teamMembers?.length || 0);

        // Filter to find ALL teams for this specific game, then get the most recent
        const matchingTeams = teamMembers?.filter(tm =>
            tm.teams && String(tm.teams.tournament_game_id) === String(gameId)
        ) || [];

        console.log('Matching teams for gameId', gameId, ':', matchingTeams.length);

        if (matchingTeams.length === 0) {
            console.log('No team found for gameId:', gameId);
            return res.status(404).json({
                success: false,
                message: 'No team found for this game'
            });
        }

        // Sort by created_at DESC to get the most recent team
        matchingTeams.sort((a, b) =>
            new Date(b.teams.created_at) - new Date(a.teams.created_at)
        );

        const teamMember = matchingTeams[0]; // Most recent team
        console.log('Selected team ID:', teamMember.teams.id, 'created at:', teamMember.teams.created_at);

        const team = teamMember.teams;

        // Get all team members
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
            .eq('team_id', team.id)
            .order('role', { ascending: false }); // LEADER first

        if (membersError) {
            console.error('Error fetching team members:', membersError);
            return res.status(500).json({
                success: false,
                message: 'Error fetching team members'
            });
        }

        // Format the response (same format as getTeamDetails)
        const teamDetails = {
            id: team.id,
            team_name: team.team_name,
            leaderId: team.leader_user_id,
            status: team.status,
            game: {
                id: team.tournament_game_id,
                name: team.tournament_games.game_name,
                type: team.tournament_games.game_type,
                feePerPerson: team.tournament_games.fee_per_person,
                category: team.tournament_games.category,
                teamSize: team.tournament_games.team_size,
                tournamentId: team.tournament_games.tournament_id,
                tournamentTitle: team.tournaments?.title
            },
            members: members.map(member => ({
                id: member.id,
                userId: member.user_id,
                role: member.role,
                status: member.status,
                user: {
                    student_id: member.users?.student_id,
                    name: member.users?.full_name,
                    email: member.users?.email
                },
                createdAt: member.created_at
            })),
            createdAt: team.created_at
        };

        res.json({
            success: true,
            team: teamDetails
        });
    } catch (error) {
        console.error('Get team by game error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Add team member to a team
const addTeamMember = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { studentId, leaderStudentId, memberStudentId } = req.body;

        // Support both old format (studentId only) and new format (leaderStudentId + memberStudentId)
        const leaderSid = leaderStudentId; // Leader's student ID for authorization
        const memberSid = memberStudentId || studentId; // member to add

        console.log(`addTeamMember called: teamId=${teamId}, leaderStudentId=${leaderSid}, memberStudentId=${memberSid}`);

        if (!memberSid) {
            return res.status(400).json({
                success: false,
                message: 'Member student ID is required'
            });
        }

        // Get the team
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select(`
                id,
                team_name,
                leader_user_id,
                status,
                tournament_games(game_name, game_type, fee_per_person, category)
            `)
            .eq('id', teamId)
            .single();

        if (teamError || !team) {
            console.error('Team not found:', teamId);
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Skip leader check if leaderStudentId not provided (backward compatibility)
        // In production, you'd want proper auth middleware
        if (leaderSid) {
            const { data: leader, error: leaderError } = await supabase
                .from('users')
                .select('id')
                .eq('student_id', leaderSid)
                .single();

            if (leaderError || !leader || team.leader_user_id !== leader.id) {
                console.log('Leader check failed - not the team leader');
                return res.status(403).json({
                    success: false,
                    message: 'Only team leader can add members'
                });
            }
        }

        // Check if team is already confirmed
        if (team.status === 'CONFIRMED') {
            return res.status(400).json({
                success: false,
                message: 'Cannot add members to a confirmed team'
            });
        }

        // Get the user to add by student ID
        console.log(`Looking up user with student_id: ${memberSid}`);
        const { data: userToAdd, error: userError } = await supabase
            .from('users')
            .select('id, student_id, full_name, email, gender')
            .eq('student_id', memberSid)
            .single();

        let userIdToAdd;
        let isUserExisting = true;

        if (userError || !userToAdd) {
            userIdToAdd = null;
            isUserExisting = false;
        } else {
            userIdToAdd = userToAdd.id;

            // Gender validation based on game category
            const gameCategory = team.tournament_games?.category;
            const memberGender = userToAdd.gender;

            console.log(`Gender check: Category=${gameCategory}, Member gender=${memberGender}`);

            if (gameCategory && memberGender) {
                // Male category - only allow male members
                if (gameCategory === 'Male' && memberGender.toLowerCase() !== 'male') {
                    return res.status(400).json({
                        success: false,
                        message: `This is a Male category game. ${userToAdd.full_name} is ${memberGender} and cannot be added to this team.`
                    });
                }

                // Female category - only allow female members
                if (gameCategory === 'Female' && memberGender.toLowerCase() !== 'female') {
                    return res.status(400).json({
                        success: false,
                        message: `This is a Female category game. ${userToAdd.full_name} is ${memberGender} and cannot be added to this team.`
                    });
                }

                // Mix category - must have opposite genders
                if (gameCategory === 'Mix') {
                    // Get leader's gender
                    const { data: leaderData, error: leaderError } = await supabase
                        .from('users')
                        .select('gender')
                        .eq('id', team.leader_user_id)
                        .single();

                    if (leaderData && leaderData.gender) {
                        const leaderGender = leaderData.gender.toLowerCase();
                        const newMemberGender = memberGender.toLowerCase();

                        if (leaderGender === newMemberGender) {
                            const requiredGender = leaderGender === 'male' ? 'Female' : 'Male';
                            return res.status(400).json({
                                success: false,
                                message: `This is a Mixed category game. Leader is ${leaderData.gender}, so team member must be ${requiredGender}. ${userToAdd.full_name} is ${memberGender}.`
                            });
                        }
                        console.log(`Mix category validated: Leader is ${leaderGender}, Member is ${newMemberGender} ✓`);
                    }
                }
            }

            // NEW: Check if user is already CONFIRMED on another team for the same game
            // Get the tournament_game_id from the current team
            const { data: currentTeamGame, error: gameError } = await supabase
                .from('teams')
                .select('tournament_game_id')
                .eq('id', teamId)
                .single();

            if (!gameError && currentTeamGame) {
                const currentGameId = currentTeamGame.tournament_game_id;

                // Check if user is CONFIRMED on any other team for this game
                const { data: confirmedMemberships, error: membershipError } = await supabase
                    .from('team_members')
                    .select(`
                        id,
                        team_id,
                        teams!inner(tournament_game_id)
                    `)
                    .eq('user_id', userIdToAdd)
                    .eq('status', 'CONFIRMED')
                    .eq('teams.tournament_game_id', currentGameId);

                if (!membershipError && confirmedMemberships && confirmedMemberships.length > 0) {
                    console.log(`❌ User ${userToAdd.student_id} is already CONFIRMED on another team for this game`);
                    return res.status(400).json({
                        success: false,
                        message: `This user is already on a team for this game. Please choose a new member.`,
                        alreadyOnTeam: true
                    });
                }
            }

            // Check if user is already in the team
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

            // Log successful member addition with details
            console.log('✅ MEMBER ADDED SUCCESSFULLY:');
            console.log(`   Team ID: ${teamId}`);
            console.log(`   Team Name: ${team.team_name}`);
            console.log(`   Member Student ID: ${userToAdd.student_id}`);
            console.log(`   Member Name: ${userToAdd.full_name}`);
            console.log(`   Member DB ID: ${teamMember.id}`);
            console.log(`   Status: PENDING`);

            res.json({
                success: true,
                message: `Team member ${userToAdd.full_name} (${userToAdd.student_id}) added successfully!`,
                member: teamMember
            });
        } else {
            // User doesn't exist in the system - return error
            console.log(`User with student ID ${memberSid} not found in database`);
            return res.status(404).json({
                success: false,
                message: `Student ${memberSid} is not registered in the system. They must create an account first.`
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
        const { studentId } = req.body;
        const notificationId = parseInt(req.body.notificationId, 10);

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
            .select('id, related_id, status, action_taken')
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

        // Only block if it's read AND has an action recorded
        if (notification.status === 'READ' && notification.action_taken) {
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

        // NEW: Remove user from all other PENDING teams for the same game
        let removedTeamsCount = 0;

        try {
            // Get the tournament_game_id from the accepted team
            const { data: acceptedTeam, error: acceptedTeamError } = await supabase
                .from('teams')
                .select('tournament_game_id')
                .eq('id', teamId)
                .single();

            if (!acceptedTeamError && acceptedTeam) {
                const currentGameId = acceptedTeam.tournament_game_id;

                // Find all OTHER teams for the same game where user is PENDING
                const { data: otherPendingMemberships, error: pendingError } = await supabase
                    .from('team_members')
                    .select(`
                        id,
                        team_id,
                        teams!inner(tournament_game_id)
                    `)
                    .eq('user_id', userId)
                    .eq('status', 'PENDING')
                    .eq('teams.tournament_game_id', currentGameId)
                    .neq('team_id', teamId); // Exclude the team they just accepted

                if (!pendingError && otherPendingMemberships && otherPendingMemberships.length > 0) {
                    console.log(`🧹 Removing user from ${otherPendingMemberships.length} other pending team(s)`);

                    const teamIdsToRemove = otherPendingMemberships.map(m => m.team_id);
                    removedTeamsCount = otherPendingMemberships.length;

                    // Delete the pending memberships
                    const { error: deleteError } = await supabase
                        .from('team_members')
                        .delete()
                        .in('id', otherPendingMemberships.map(m => m.id));

                    if (deleteError) {
                        console.error('Error removing other team memberships:', deleteError);
                    } else {
                        console.log(`✅ Successfully removed user from ${removedTeamsCount} pending team(s)`);

                        // Archive related notifications for those teams
                        const { error: archiveError } = await supabase
                            .from('notifications')
                            .update({ status: 'ARCHIVED' })
                            .eq('user_id', userId)
                            .eq('type', 'TEAM_REQUEST')
                            .in('related_id', teamIdsToRemove);

                        if (archiveError) {
                            console.error('Error archiving notifications:', archiveError);
                        } else {
                            console.log(`✅ Archived ${removedTeamsCount} team invitation notification(s)`);
                        }
                    }
                }
            }
        } catch (cleanupError) {
            console.error('Error during cleanup of other teams:', cleanupError);
            // Don't fail the whole operation if cleanup fails
        }

        // Mark the notification as read and record action
        const { error: notifUpdateError } = await supabase
            .from('notifications')
            .update({
                status: 'READ',
                action_taken: 'ACCEPTED'
            })
            .eq('id', notificationId);

        if (notifUpdateError) {
            console.error('❌ CRITICAL: Failed to set action_taken on notification:', notifUpdateError);
            // Still return success since team member was confirmed, but log the error
        } else {
            console.log(`✅ Notification ${notificationId} marked READ with action_taken=ACCEPTED`);
        }

        res.json({
            success: true,
            message: removedTeamsCount > 0
                ? `Team invitation accepted successfully! You were removed from ${removedTeamsCount} other pending team(s).`
                : 'Team invitation accepted successfully',
            removedTeamsCount: removedTeamsCount
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

// Remove a team member (only team leader can do this)
const removeTeamMember = async (req, res) => {
    try {
        const { teamId, memberId } = req.params;
        const { studentId } = req.body; // Leader's student ID

        // Get leader's user ID
        const { data: leader, error: leaderError } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (leaderError || !leader) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get the team and verify leader
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select(`
                id,
                leader_user_id,
                tournament_game_id,
                tournament_games(
                    tournaments(registration_deadline)
                )
            `)
            .eq('id', teamId)
            .single();

        if (teamError || !team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Verify requester is the leader
        if (team.leader_user_id !== leader.id) {
            return res.status(403).json({
                success: false,
                message: 'Only team leader can remove members'
            });
        }

        // Check if registration is paid (locked)
        const { data: registration, error: regError } = await supabase
            .from('game_registrations')
            .select('payment_status')
            .eq('team_id', teamId)
            .single();

        if (registration && registration.payment_status === 'PAID') {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify team after payment is complete'
            });
        }

        // Check deadline
        const deadline = new Date(team.tournament_games.tournaments.registration_deadline);
        if (new Date() > deadline) {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify team after registration deadline'
            });
        }

        // Get the member to remove
        const { data: member, error: memberError } = await supabase
            .from('team_members')
            .select('id, user_id, role')
            .eq('id', memberId)
            .eq('team_id', teamId)
            .single();

        if (memberError || !member) {
            return res.status(404).json({
                success: false,
                message: 'Team member not found'
            });
        }

        // Cannot remove the leader
        if (member.role === 'LEADER') {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove team leader'
            });
        }

        // Remove the member
        const { error: deleteError } = await supabase
            .from('team_members')
            .delete()
            .eq('id', memberId);

        if (deleteError) {
            console.error('Error removing team member:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error removing team member',
                error: deleteError.message
            });
        }

        // Also remove any pending notifications for this member
        if (member.user_id) {
            await supabase
                .from('notifications')
                .delete()
                .eq('user_id', member.user_id)
                .eq('related_id', teamId)
                .eq('type', 'TEAM_REQUEST');
        }

        res.json({
            success: true,
            message: 'Team member removed successfully'
        });
    } catch (error) {
        console.error('Remove team member error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Replace a team member with a new person (only team leader can do this)
const replaceMember = async (req, res) => {
    try {
        const { teamId, memberId } = req.params;
        const { studentId, newMemberStudentId } = req.body;

        console.log('replaceMember called with:', { teamId, memberId, studentId, newMemberStudentId });

        if (!newMemberStudentId) {
            return res.status(400).json({
                success: false,
                message: 'New member student ID is required'
            });
        }

        // Validate student ID format
        if (!newMemberStudentId.match(/^\d{2}-\d{5}-\d$/)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid student ID format. Use: XX-XXXXX-X'
            });
        }

        // Get leader's user ID
        const { data: leader, error: leaderError } = await supabase
            .from('users')
            .select('id')
            .eq('student_id', studentId)
            .single();

        if (leaderError || !leader) {
            console.error('Leader lookup failed:', leaderError, 'for studentId:', studentId);
            return res.status(404).json({
                success: false,
                message: 'Leader user not found. Make sure you are logged in correctly.'
            });
        }

        // Get the team and verify leader
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select(`
                id,
                team_name,
                leader_user_id,
                tournament_game_id,
                tournament_games(
                    game_name,
                    fee_per_person,
                    category,
                    tournaments(registration_deadline)
                )
            `)
            .eq('id', teamId)
            .single();

        if (teamError || !team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        // Verify the requester is the team leader
        if (team.leader_user_id !== leader.id) {
            return res.status(403).json({
                success: false,
                message: 'Only the team leader can replace members'
            });
        }

        // Check if deadline has passed
        const deadline = new Date(team.tournament_games.tournaments.registration_deadline);
        if (new Date() > deadline) {
            return res.status(400).json({
                success: false,
                message: 'Cannot replace members after registration deadline'
            });
        }

        // Check payment status
        const { data: registration, error: regError } = await supabase
            .from('game_registrations')
            .select('payment_status')
            .eq('team_id', teamId)
            .single();

        if (registration && registration.payment_status === 'PAID') {
            return res.status(400).json({
                success: false,
                message: 'Cannot replace members after payment is complete'
            });
        }

        // Get the member to be replaced
        const { data: oldMember, error: memberError } = await supabase
            .from('team_members')
            .select('id, user_id, role')
            .eq('id', memberId)
            .eq('team_id', teamId)
            .single();

        if (memberError || !oldMember) {
            return res.status(404).json({
                success: false,
                message: 'Team member not found'
            });
        }

        // Cannot replace the leader
        if (oldMember.role === 'LEADER') {
            return res.status(400).json({
                success: false,
                message: 'Cannot replace team leader'
            });
        }

        // Get the new member's user ID
        const { data: newUser, error: newUserError } = await supabase
            .from('users')
            .select('id, full_name, email, gender')
            .eq('student_id', newMemberStudentId)
            .single();

        if (newUserError || !newUser) {
            return res.status(404).json({
                success: false,
                message: `User with student ID ${newMemberStudentId} not found in the system`
            });
        }

        // Gender validation based on game category
        const gameCategory = team.tournament_games?.category;
        const memberGender = newUser.gender;

        console.log(`Replace member - Gender check: Category=${gameCategory}, New member gender=${memberGender}`);

        if (gameCategory && memberGender) {
            // Male category - only allow male members
            if (gameCategory === 'Male' && memberGender.toLowerCase() !== 'male') {
                return res.status(400).json({
                    success: false,
                    message: `This is a Male category game. ${newUser.full_name} is ${memberGender} and cannot be added to this team.`
                });
            }

            // Female category - only allow female members
            if (gameCategory === 'Female' && memberGender.toLowerCase() !== 'female') {
                return res.status(400).json({
                    success: false,
                    message: `This is a Female category game. ${newUser.full_name} is ${memberGender} and cannot be added to this team.`
                });
            }

            // Mix category - must have opposite genders
            if (gameCategory === 'Mix') {
                // Get leader's gender
                const { data: leaderData, error: leaderGenderError } = await supabase
                    .from('users')
                    .select('gender')
                    .eq('id', team.leader_user_id)
                    .single();

                if (leaderData && leaderData.gender) {
                    const leaderGender = leaderData.gender.toLowerCase();
                    const newMemberGender = memberGender.toLowerCase();

                    if (leaderGender === newMemberGender) {
                        const requiredGender = leaderGender === 'male' ? 'Female' : 'Male';
                        return res.status(400).json({
                            success: false,
                            message: `This is a Mixed category game. Leader is ${leaderData.gender}, so team member must be ${requiredGender}. ${newUser.full_name} is ${memberGender}.`
                        });
                    }
                    console.log(`Mix category validated: Leader is ${leaderGender}, Member is ${newMemberGender} ✓`);
                }
            }
        }

        // Cannot add yourself as a member
        if (newUser.id === leader.id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot add yourself as a team member'
            });
        }

        // Check if new member is already in the team
        const { data: existingMember, error: existingError } = await supabase
            .from('team_members')
            .select('id')
            .eq('team_id', teamId)
            .eq('user_id', newUser.id)
            .single();

        if (existingMember) {
            return res.status(400).json({
                success: false,
                message: 'This user is already a member of the team'
            });
        }

        // Remove the old member
        const { error: deleteError } = await supabase
            .from('team_members')
            .delete()
            .eq('id', memberId);

        if (deleteError) {
            console.error('Error removing old member:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error removing old member'
            });
        }

        // Delete old notifications for the replaced member
        if (oldMember.user_id) {
            await supabase
                .from('notifications')
                .delete()
                .eq('user_id', oldMember.user_id)
                .eq('related_id', teamId)
                .eq('type', 'TEAM_REQUEST');
        }

        // Add the new member
        const { data: newMember, error: addError } = await supabase
            .from('team_members')
            .insert({
                team_id: Number(teamId),
                user_id: newUser.id,
                role: 'MEMBER',
                status: 'PENDING'
            })
            .select()
            .single();

        if (addError) {
            console.error('Error adding new member:', addError);
            return res.status(500).json({
                success: false,
                message: 'Error adding new member'
            });
        }

        // Send notification to new member
        await supabase
            .from('notifications')
            .insert({
                user_id: newUser.id,
                type: 'TEAM_REQUEST',
                title: 'Team Invitation',
                message: `You have been invited to join team "${team.team_name}" for ${team.tournament_games.game_name}`,
                related_id: Number(teamId),
                status: 'UNREAD'
            });

        res.json({
            success: true,
            message: `Member replaced successfully. ${newMemberStudentId} has been sent an invitation.`,
            newMember: {
                id: newMember.id,
                userId: newUser.id,
                studentId: newMemberStudentId,
                name: newUser.full_name,
                status: 'PENDING'
            }
        });

        // Mark the notification as read and record action
        await supabase
            .from('notifications')
            .update({
                status: 'READ',
                action_taken: 'ACCEPTED'
            })
            .eq('id', notificationId);

    } catch (error) {
        console.error('Replace team member error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Reject team invitation (for invited members)
const rejectTeamInvitation = async (req, res) => {
    try {
        const { studentId } = req.body;
        const notificationId = parseInt(req.body.notificationId, 10);

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
            .select('id, related_id, status, action_taken')
            .eq('id', notificationId)
            .eq('user_id', userId)
            .eq('type', 'TEAM_REQUEST')
            .single();

        if (notificationError || !notification) {
            return res.status(404).json({
                success: false,
                message: 'Invitation not found'
            });
        }

        if (notification.status === 'READ' && notification.action_taken) {
            return res.status(400).json({
                success: false,
                message: 'Invitation already processed'
            });
        }

        const teamId = notification.related_id;

        // Update the team member status to REJECTED
        const { error: memberUpdateError } = await supabase
            .from('team_members')
            .update({ status: 'REJECTED' })
            .eq('team_id', teamId)
            .eq('user_id', userId);

        if (memberUpdateError) {
            console.error('Error updating team member status:', memberUpdateError);
            return res.status(500).json({
                success: false,
                message: 'Error rejecting team invitation',
                error: memberUpdateError.message
            });
        }

        // Mark the notification as read and record action
        const { error: notifUpdateError } = await supabase
            .from('notifications')
            .update({
                status: 'READ',
                action_taken: 'DECLINED'
            })
            .eq('id', notificationId);

        if (notifUpdateError) {
            console.error('❌ CRITICAL: Failed to set action_taken on notification:', notifUpdateError);
        } else {
            console.log(`✅ Notification ${notificationId} marked READ with action_taken=DECLINED`);
        }

        res.json({
            success: true,
            message: 'Team invitation rejected'
        });
    } catch (error) {
        console.error('Reject team invitation error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Validate a member before adding to team (check gender compatibility)
const validateMember = async (req, res) => {
    try {
        const { memberStudentId, gameId, leaderStudentId } = req.body;

        if (!memberStudentId || !gameId) {
            return res.status(400).json({
                success: false,
                message: 'Member student ID and game ID are required'
            });
        }

        // Get the game details including category
        const { data: game, error: gameError } = await supabase
            .from('tournament_games')
            .select('id, game_name, category')
            .eq('id', gameId)
            .single();

        if (gameError || !game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        // Get the member's details
        const { data: member, error: memberError } = await supabase
            .from('users')
            .select('id, student_id, full_name, gender')
            .eq('student_id', memberStudentId)
            .single();

        if (memberError || !member) {
            return res.status(404).json({
                success: false,
                message: `Student ${memberStudentId} is not registered in the system. They must create an account first.`,
                errorType: 'user_not_found'
            });
        }

        const memberGender = member.gender?.toLowerCase();
        const gameCategory = game.category;

        // Validate based on category
        if (gameCategory === 'Male' && memberGender !== 'male') {
            return res.status(400).json({
                success: false,
                message: `This is a Male category game. ${member.full_name} is ${member.gender || 'unknown gender'} and cannot be added.`,
                errorType: 'gender_mismatch',
                memberName: member.full_name,
                memberGender: member.gender,
                requiredGender: 'Male'
            });
        }

        if (gameCategory === 'Female' && memberGender !== 'female') {
            return res.status(400).json({
                success: false,
                message: `This is a Female category game. ${member.full_name} is ${member.gender || 'unknown gender'} and cannot be added.`,
                errorType: 'gender_mismatch',
                memberName: member.full_name,
                memberGender: member.gender,
                requiredGender: 'Female'
            });
        }

        if (gameCategory === 'Mix' && leaderStudentId) {
            // Get leader's gender
            const { data: leader, error: leaderError } = await supabase
                .from('users')
                .select('gender')
                .eq('student_id', leaderStudentId)
                .single();

            if (leader && leader.gender) {
                const leaderGender = leader.gender.toLowerCase();
                if (leaderGender === memberGender) {
                    const requiredGender = leaderGender === 'male' ? 'Female' : 'Male';
                    return res.status(400).json({
                        success: false,
                        message: `This is a Mixed category game. You are ${leader.gender}, so team member must be ${requiredGender}. ${member.full_name} is ${member.gender}.`,
                        errorType: 'gender_mismatch',
                        memberName: member.full_name,
                        memberGender: member.gender,
                        requiredGender: requiredGender
                    });
                }
            }
        }

        // All validations passed
        res.json({
            success: true,
            message: 'Member is valid for this team',
            member: {
                id: member.id,
                studentId: member.student_id,
                name: member.full_name,
                gender: member.gender
            }
        });

    } catch (error) {
        console.error('Validate member error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update team member status (Admin only)
 * Allows admin to manually confirm or reject team members
 */
const updateTeamMemberStatus = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['PENDING', 'CONFIRMED', 'REJECTED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be PENDING, CONFIRMED, or REJECTED'
            });
        }

        // Update the team member status
        const { data, error } = await supabase
            .from('team_members')
            .update({ status })
            .eq('id', memberId)
            .select(`
                id,
                status,
                user_id,
                team_id,
                users(student_id, full_name)
            `)
            .single();

        if (error) {
            console.error('Error updating team member status:', error);
            return res.status(500).json({
                success: false,
                message: 'Error updating member status'
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Team member not found'
            });
        }

        res.json({
            success: true,
            message: `Member status updated to ${status}`,
            member: data
        });

    } catch (error) {
        console.error('Update team member status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update member status: ' + error.message
        });
    }
};

/**
 * Remove team member (Admin only)
 * Allows admin to remove a member from a team
 */
const adminRemoveTeamMember = async (req, res) => {
    try {
        const { memberId } = req.params;

        // Get member details before deletion
        const { data: member, error: fetchError } = await supabase
            .from('team_members')
            .select(`
                id,
                user_id,
                team_id,
                role,
                users(student_id, full_name)
            `)
            .eq('id', memberId)
            .single();

        if (fetchError || !member) {
            return res.status(404).json({
                success: false,
                message: 'Team member not found'
            });
        }

        // Prevent removing team leader
        if (member.role === 'LEADER') {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove team leader. Delete the entire team instead.'
            });
        }

        // Delete the team member
        const { error: deleteError } = await supabase
            .from('team_members')
            .delete()
            .eq('id', memberId);

        if (deleteError) {
            console.error('Error removing team member:', deleteError);
            return res.status(500).json({
                success: false,
                message: 'Error removing team member'
            });
        }

        // Also delete any related notifications
        await supabase
            .from('notifications')
            .delete()
            .eq('user_id', member.user_id)
            .eq('related_id', member.team_id)
            .eq('type', 'TEAM_REQUEST');

        res.json({
            success: true,
            message: `Member ${member.users.full_name} removed from team`
        });

    } catch (error) {
        console.error('Admin remove team member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove team member: ' + error.message
        });
    }
}

module.exports = {
    createTeam,
    getTeamDetails,
    getTeamByGame,
    addTeamMember,
    removeTeamMember,
    replaceMember,
    acceptTeamInvitation,
    rejectTeamInvitation,
    confirmTeamRegistration,
    getPendingTeamInvitations,
    validateMember,
    updateTeamMemberStatus,
    adminRemoveTeamMember
};
