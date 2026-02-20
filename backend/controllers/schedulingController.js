const { supabase } = require('../config/supabase');

// ============================================================
// GAME CONFIG MANAGEMENT
// ============================================================

// Get all game configs for a tournament
const getGameConfigs = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // Get all games for this tournament with their configs
        const { data: games, error: gamesError } = await supabase
            .from('tournament_games')
            .select('id, category, game_name, game_type, team_size, fee_per_person')
            .eq('tournament_id', tournamentId)
            .order('game_name');

        if (gamesError) throw gamesError;

        // Get configs for each game
        const gameIds = games.map(g => g.id);
        const { data: configs, error: configsError } = await supabase
            .from('game_configs')
            .select('*')
            .in('game_id', gameIds);

        if (configsError) throw configsError;

        // Get registration counts per game
        const { data: regCounts, error: regError } = await supabase
            .from('game_registrations')
            .select('game_id')
            .in('game_id', gameIds);

        if (regError) throw regError;

        // Count registrations per game
        const regCountMap = {};
        if (regCounts) {
            regCounts.forEach(r => {
                regCountMap[r.game_id] = (regCountMap[r.game_id] || 0) + 1;
            });
        }

        // Get team counts per game
        const { data: teamCounts, error: teamError } = await supabase
            .from('teams')
            .select('tournament_game_id, status')
            .in('tournament_game_id', gameIds)
            .in('status', ['CONFIRMED', 'PENDING']);

        const teamCountMap = {};
        if (teamCounts) {
            teamCounts.forEach(t => {
                teamCountMap[t.tournament_game_id] = (teamCountMap[t.tournament_game_id] || 0) + 1;
            });
        }

        // Merge configs with games
        const configMap = {};
        if (configs) {
            configs.forEach(c => { configMap[c.game_id] = c; });
        }

        const result = games.map(game => ({
            ...game,
            registration_count: regCountMap[game.id] || 0,
            team_count: teamCountMap[game.id] || 0,
            config: configMap[game.id] || null
        }));

        // Get global schedule config
        const { data: schedConfig, error: schedError } = await supabase
            .from('tournament_schedule_config')
            .select('*')
            .eq('tournament_id', tournamentId)
            .single();

        // Get tournament info
        const { data: tournament, error: tErr } = await supabase
            .from('tournaments')
            .select('id, title, status, registration_deadline')
            .eq('id', tournamentId)
            .single();

        res.json({
            success: true,
            tournament: tournament || null,
            scheduleConfig: schedConfig || null,
            games: result
        });
    } catch (error) {
        console.error('getGameConfigs error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Save game config
const saveGameConfig = async (req, res) => {
    try {
        const { gameId } = req.params;
        const { match_duration, break_duration, parallel_matches, venue_names } = req.body;

        const configData = {
            game_id: parseInt(gameId),
            match_duration: parseInt(match_duration) || 30,
            break_duration: parseInt(break_duration) || 10,
            parallel_matches: parseInt(parallel_matches) || 1,
            venue_names: venue_names || [],
            updated_at: new Date().toISOString()
        };

        // Upsert config
        const { data, error } = await supabase
            .from('game_configs')
            .upsert(configData, { onConflict: 'game_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, config: data });
    } catch (error) {
        console.error('saveGameConfig error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Save global schedule config
const saveScheduleConfig = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { start_date, end_date, daily_start_time, daily_end_time } = req.body;

        const configData = {
            tournament_id: parseInt(tournamentId),
            start_date,
            end_date,
            daily_start_time: daily_start_time || '09:00',
            daily_end_time: daily_end_time || '18:00',
            status: 'DRAFT',
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('tournament_schedule_config')
            .upsert(configData, { onConflict: 'tournament_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, config: data });
    } catch (error) {
        console.error('saveScheduleConfig error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// CORE SCHEDULING ALGORITHM
// ============================================================

const shuffleAndSchedule = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // 1. Load schedule config
        const { data: schedConfig, error: scErr } = await supabase
            .from('tournament_schedule_config')
            .select('*')
            .eq('tournament_id', tournamentId)
            .single();

        if (scErr || !schedConfig) {
            return res.status(400).json({ success: false, message: 'Please configure the tournament schedule first (dates & times).' });
        }

        // 2. Load all games with configs
        const { data: games, error: gErr } = await supabase
            .from('tournament_games')
            .select('id, category, game_name, game_type, team_size')
            .eq('tournament_id', tournamentId);

        if (gErr) throw gErr;
        if (!games || games.length === 0) {
            return res.status(400).json({ success: false, message: 'No games found for this tournament.' });
        }

        // Load configs for each game
        const gameIds = games.map(g => g.id);
        const { data: configs, error: cfgErr } = await supabase
            .from('game_configs')
            .select('*')
            .in('game_id', gameIds);

        if (cfgErr) throw cfgErr;

        const configMap = {};
        if (configs) configs.forEach(c => { configMap[c.game_id] = c; });

        // Check all games have configs
        const unconfigured = games.filter(g => !configMap[g.id]);
        if (unconfigured.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Please configure all games first. Missing: ${unconfigured.map(g => g.game_name).join(', ')}`
            });
        }

        // 3. Clear previous schedule for this tournament
        await supabase.from('scheduled_matches').delete().eq('tournament_id', tournamentId);
        await supabase.from('schedule_slots').delete().eq('tournament_id', tournamentId);
        await supabase.from('schedule_reports').delete().eq('tournament_id', tournamentId);

        // 4. Generate time slots for each game
        const allSlots = {};
        for (const game of games) {
            const cfg = configMap[game.id];
            const slots = generateTimeSlots(schedConfig, cfg, game.id, tournamentId);

            if (slots.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough time to schedule ${game.game_name}. Adjust tournament dates or match duration.`
                });
            }

            // Insert slots into DB
            const { data: insertedSlots, error: slotErr } = await supabase
                .from('schedule_slots')
                .insert(slots)
                .select();

            if (slotErr) throw slotErr;
            allSlots[game.id] = insertedSlots;
        }

        // 5. Generate match pools for each game
        const allMatches = {};
        for (const game of games) {
            const matches = await generateMatchPool(game, tournamentId);
            allMatches[game.id] = matches;
        }

        // 6. Guided random scheduling
        const scheduledMatches = [];
        const globalPlayerTimeline = {}; // userId -> [{start, end, matchId, gameId}]

        // Sort games by number of matches (descending) - schedule busiest first
        const sortedGames = [...games].sort((a, b) => {
            return (allMatches[b.id]?.length || 0) - (allMatches[a.id]?.length || 0);
        });

        for (const game of sortedGames) {
            const matches = allMatches[game.id] || [];
            const slots = allSlots[game.id] || [];

            if (matches.length === 0 || slots.length === 0) continue;

            // Shuffle matches with weighted randomness
            shuffleMatchesWeighted(matches, globalPlayerTimeline);

            // Determine bracket rounds
            const totalMatches = matches.length;
            const roundInfo = calculateBracketRounds(totalMatches);

            let matchIndex = 0;
            for (let round = 0; round < roundInfo.length && matchIndex < matches.length; round++) {
                const matchesInRound = roundInfo[round].count;
                const roundLabel = roundInfo[round].label;

                for (let i = 0; i < matchesInRound && matchIndex < matches.length; i++) {
                    const match = matches[matchIndex];
                    matchIndex++;

                    // Try N random candidate slots, pick minimum conflict
                    const bestSlot = findBestSlot(slots, match, globalPlayerTimeline, 5);

                    if (!bestSlot) {
                        // No slot available - still schedule but mark
                        continue;
                    }

                    // Calculate conflict
                    const conflict = calculateConflict(bestSlot, match, globalPlayerTimeline);

                    const scheduledMatch = {
                        tournament_id: parseInt(tournamentId),
                        game_id: game.id,
                        slot_id: bestSlot.id,
                        participant_a_user_id: match.a_user_id || null,
                        participant_a_team_id: match.a_team_id || null,
                        participant_b_user_id: match.b_user_id || null,
                        participant_b_team_id: match.b_team_id || null,
                        participant_a_label: match.a_label,
                        participant_b_label: match.b_label,
                        scheduled_start: bestSlot.slot_start,
                        scheduled_end: bestSlot.slot_end,
                        venue_name: bestSlot.venue_name,
                        round_number: round + 1,
                        round_label: roundLabel,
                        match_order: i,
                        status: conflict.weight > 0 ? 'SCHEDULED_OVERLAP' : 'SCHEDULED',
                        conflict_type: conflict.type || null,
                        conflict_player_ids: conflict.playerIds || null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };

                    scheduledMatches.push(scheduledMatch);

                    // Update slot usage
                    bestSlot.used = (bestSlot.used || 0) + 1;

                    // Update global timeline
                    const playerIds = getPlayerIds(match);
                    playerIds.forEach(pid => {
                        if (!globalPlayerTimeline[pid]) globalPlayerTimeline[pid] = [];
                        globalPlayerTimeline[pid].push({
                            start: new Date(bestSlot.slot_start),
                            end: new Date(bestSlot.slot_end),
                            gameId: game.id,
                            matchIndex: scheduledMatches.length - 1
                        });
                    });
                }
            }
        }

        // 7. Insert all scheduled matches
        let insertedMatches = [];
        if (scheduledMatches.length > 0) {
            // Insert in batches of 50
            for (let i = 0; i < scheduledMatches.length; i += 50) {
                const batch = scheduledMatches.slice(i, i + 50);
                const { data: inserted, error: insErr } = await supabase
                    .from('scheduled_matches')
                    .insert(batch)
                    .select();

                if (insErr) throw insErr;
                if (inserted) insertedMatches = insertedMatches.concat(inserted);
            }
        }

        // 8. Cross-sport conflict detection
        const crossConflicts = detectCrossSportConflicts(insertedMatches, globalPlayerTimeline);

        // Update conflict flags on matches
        for (const conflict of crossConflicts) {
            await supabase
                .from('scheduled_matches')
                .update({
                    status: 'SCHEDULED_OVERLAP',
                    conflict_type: 'CROSS_SPORT',
                    conflict_with_match_id: conflict.conflictMatchId,
                    conflict_player_ids: conflict.playerIds
                })
                .eq('id', conflict.matchId);
        }

        // 9. Generate report
        const totalConflicts = insertedMatches.filter(m => m.status === 'SCHEDULED_OVERLAP').length + crossConflicts.length;
        const sameSportConflicts = insertedMatches.filter(m => m.status === 'SCHEDULED_OVERLAP' && m.conflict_type !== 'CROSS_SPORT').length;

        const report = {
            tournament_id: parseInt(tournamentId),
            total_matches: insertedMatches.length,
            total_conflicts: totalConflicts,
            same_sport_conflicts: sameSportConflicts,
            cross_sport_conflicts: crossConflicts.length,
            conflicted_match_ids: insertedMatches.filter(m => m.status === 'SCHEDULED_OVERLAP').map(m => m.id).join(','),
            report_data: {
                games: games.map(g => ({
                    id: g.id,
                    name: g.game_name,
                    matches: insertedMatches.filter(m => m.game_id === g.id).length,
                    conflicts: insertedMatches.filter(m => m.game_id === g.id && m.status === 'SCHEDULED_OVERLAP').length
                })),
                generated_at: new Date().toISOString()
            },
            generated_at: new Date().toISOString()
        };

        const { error: rptErr } = await supabase
            .from('schedule_reports')
            .insert([report]);

        if (rptErr) console.error('Report insert error:', rptErr);

        // Update schedule config status
        await supabase
            .from('tournament_schedule_config')
            .update({ status: 'SCHEDULED' })
            .eq('tournament_id', tournamentId);

        // Update slot usage counts
        for (const gameId in allSlots) {
            for (const slot of allSlots[gameId]) {
                if (slot.used > 0) {
                    await supabase
                        .from('schedule_slots')
                        .update({ used: slot.used })
                        .eq('id', slot.id);
                }
            }
        }

        res.json({
            success: true,
            message: `Scheduled ${insertedMatches.length} matches with ${totalConflicts} conflict(s).`,
            report: {
                total_matches: insertedMatches.length,
                total_conflicts: totalConflicts,
                same_sport_conflicts: sameSportConflicts,
                cross_sport_conflicts: crossConflicts.length
            },
            matches: insertedMatches
        });

    } catch (error) {
        console.error('shuffleAndSchedule error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateTimeSlots(schedConfig, gameConfig, gameId, tournamentId) {
    const slots = [];
    const slotDuration = (gameConfig.match_duration + gameConfig.break_duration) * 60 * 1000; // ms
    const parallelCount = gameConfig.parallel_matches || 1;
    const venueNames = gameConfig.venue_names || [];

    const startDate = new Date(schedConfig.start_date);
    const endDate = new Date(schedConfig.end_date);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const [startH, startM] = schedConfig.daily_start_time.split(':').map(Number);
        const [endH, endM] = schedConfig.daily_end_time.split(':').map(Number);

        let slotStart = new Date(`${dateStr}T${schedConfig.daily_start_time}:00+06:00`);
        const dayEnd = new Date(`${dateStr}T${schedConfig.daily_end_time}:00+06:00`);

        while (slotStart.getTime() + slotDuration <= dayEnd.getTime()) {
            const slotEnd = new Date(slotStart.getTime() + gameConfig.match_duration * 60 * 1000);

            for (let v = 0; v < parallelCount; v++) {
                slots.push({
                    tournament_id: parseInt(tournamentId),
                    game_id: gameId,
                    slot_start: slotStart.toISOString(),
                    slot_end: slotEnd.toISOString(),
                    venue_name: venueNames[v] || `Venue ${v + 1}`,
                    capacity: 1,
                    used: 0
                });
            }

            // Move to next slot (match + break)
            slotStart = new Date(slotStart.getTime() + slotDuration);
        }
    }

    return slots;
}

async function generateMatchPool(game, tournamentId) {
    const matches = [];
    const gameType = game.game_type;

    if (gameType === 'Solo') {
        // Get all registered users for this game
        const { data: registrations, error } = await supabase
            .from('game_registrations')
            .select('user_id, users(id, full_name, student_id, gender)')
            .eq('game_id', game.id);

        if (error || !registrations || registrations.length < 2) return matches;

        const users = registrations.map(r => ({
            id: r.user_id,
            name: r.users?.full_name || r.users?.student_id || `User ${r.user_id}`,
            gender: r.users?.gender
        }));

        // Generate single-elimination bracket: pair users
        // Shuffle first
        shuffleArray(users);

        // If not power of 2, some get byes
        const bracketSize = nextPowerOf2(users.length);

        for (let i = 0; i < users.length; i += 2) {
            if (i + 1 < users.length) {
                // Gender rules for category
                const catGender = game.category?.toLowerCase();
                if (catGender === 'male' && (users[i].gender === 'Female' || users[i + 1].gender === 'Female')) continue;
                if (catGender === 'female' && (users[i].gender === 'Male' || users[i + 1].gender === 'Male')) continue;

                matches.push({
                    a_user_id: users[i].id,
                    a_label: users[i].name,
                    b_user_id: users[i + 1].id,
                    b_label: users[i + 1].name,
                    playerIds: [users[i].id, users[i + 1].id]
                });
            } else {
                // Bye - auto-advance
                matches.push({
                    a_user_id: users[i].id,
                    a_label: users[i].name,
                    b_user_id: null,
                    b_label: 'BYE',
                    playerIds: [users[i].id],
                    isBye: true
                });
            }
        }
    } else {
        // Team-based games (Duo, Custom)
        const { data: teams, error } = await supabase
            .from('teams')
            .select('id, team_name, leader_user_id, team_members(user_id)')
            .eq('tournament_game_id', game.id)
            .in('status', ['CONFIRMED', 'PENDING']);

        if (error || !teams || teams.length < 2) return matches;

        // Shuffle teams
        shuffleArray(teams);

        for (let i = 0; i < teams.length; i += 2) {
            if (i + 1 < teams.length) {
                const teamAPlayers = teams[i].team_members?.map(m => m.user_id) || [teams[i].leader_user_id];
                const teamBPlayers = teams[i + 1].team_members?.map(m => m.user_id) || [teams[i + 1].leader_user_id];

                matches.push({
                    a_team_id: teams[i].id,
                    a_label: teams[i].team_name,
                    b_team_id: teams[i + 1].id,
                    b_label: teams[i + 1].team_name,
                    playerIds: [...teamAPlayers, ...teamBPlayers]
                });
            } else {
                // Bye
                matches.push({
                    a_team_id: teams[i].id,
                    a_label: teams[i].team_name,
                    b_team_id: null,
                    b_label: 'BYE',
                    playerIds: teams[i].team_members?.map(m => m.user_id) || [teams[i].leader_user_id],
                    isBye: true
                });
            }
        }
    }

    return matches;
}

function shuffleMatchesWeighted(matches, globalTimeline) {
    // Weight by how many existing scheduled matches the players have
    matches.forEach(m => {
        const pids = getPlayerIds(m);
        m._weight = pids.reduce((sum, pid) => {
            return sum + (globalTimeline[pid]?.length || 0);
        }, 0);
    });

    // Sort: higher weight (busier players) first so they get more choice
    matches.sort((a, b) => b._weight - a._weight);

    // Add some randomness within same weight groups
    let i = 0;
    while (i < matches.length) {
        let j = i;
        while (j < matches.length && matches[j]._weight === matches[i]._weight) j++;
        // Shuffle within this group
        const group = matches.slice(i, j);
        shuffleArray(group);
        for (let k = 0; k < group.length; k++) {
            matches[i + k] = group[k];
        }
        i = j;
    }
}

function findBestSlot(slots, match, globalTimeline, tries) {
    const available = slots.filter(s => (s.used || 0) < s.capacity);
    if (available.length === 0) return null;

    if (match.isBye) {
        // Byes don't need real slots, just pick the first
        return available[0];
    }

    let bestSlot = null;
    let bestConflict = Infinity;

    const numTries = Math.min(tries, available.length);
    const tried = new Set();

    for (let t = 0; t < numTries; t++) {
        let idx;
        do {
            idx = Math.floor(Math.random() * available.length);
        } while (tried.has(idx) && tried.size < available.length);
        tried.add(idx);

        const slot = available[idx];
        const conflict = calculateConflict(slot, match, globalTimeline);

        if (conflict.weight === 0) {
            return slot; // Perfect slot, no conflict
        }

        if (conflict.weight < bestConflict) {
            bestConflict = conflict.weight;
            bestSlot = slot;
        }
    }

    return bestSlot || available[0];
}

function calculateConflict(slot, match, globalTimeline) {
    const playerIds = getPlayerIds(match);
    const slotStart = new Date(slot.slot_start).getTime();
    const slotEnd = new Date(slot.slot_end).getTime();

    let weight = 0;
    let type = null;
    const conflictingPlayers = [];

    for (const pid of playerIds) {
        const timeline = globalTimeline[pid] || [];
        for (const entry of timeline) {
            const eStart = entry.start.getTime();
            const eEnd = entry.end.getTime();

            // Check overlap
            if (slotStart < eEnd && slotEnd > eStart) {
                weight++;
                conflictingPlayers.push(pid);
                type = entry.gameId === match.gameId ? 'SAME_SPORT' : 'CROSS_SPORT';
            }
        }
    }

    return {
        weight,
        type,
        playerIds: conflictingPlayers.length > 0 ? conflictingPlayers.join(',') : null
    };
}

function detectCrossSportConflicts(matches, globalTimeline) {
    const conflicts = [];

    // Group matches by player
    const playerMatches = {};
    matches.forEach(m => {
        const pids = [];
        if (m.participant_a_user_id) pids.push(m.participant_a_user_id);
        if (m.participant_b_user_id) pids.push(m.participant_b_user_id);

        pids.forEach(pid => {
            if (!playerMatches[pid]) playerMatches[pid] = [];
            playerMatches[pid].push(m);
        });
    });

    // For each player, check for time overlaps across different games
    for (const pid in playerMatches) {
        const pMatches = playerMatches[pid].sort((a, b) =>
            new Date(a.scheduled_start) - new Date(b.scheduled_start)
        );

        for (let i = 0; i < pMatches.length - 1; i++) {
            const m1 = pMatches[i];
            const m2 = pMatches[i + 1];

            if (m1.game_id !== m2.game_id) {
                const end1 = new Date(m1.scheduled_end).getTime();
                const start2 = new Date(m2.scheduled_start).getTime();

                if (end1 > start2) {
                    conflicts.push({
                        matchId: m2.id,
                        conflictMatchId: m1.id,
                        playerIds: pid.toString()
                    });
                }
            }
        }
    }

    return conflicts;
}

function getPlayerIds(match) {
    const ids = [];
    if (match.a_user_id) ids.push(match.a_user_id);
    if (match.b_user_id) ids.push(match.b_user_id);
    if (match.playerIds) {
        match.playerIds.forEach(id => {
            if (id && !ids.includes(id)) ids.push(id);
        });
    }
    return ids;
}

function calculateBracketRounds(totalMatches) {
    if (totalMatches <= 0) return [];
    if (totalMatches === 1) return [{ count: 1, label: 'Final' }];

    const rounds = [];
    let remaining = totalMatches;

    // Work backwards from total matches
    if (remaining >= 8) {
        const r16Count = Math.min(remaining, 8);
        rounds.push({ count: r16Count, label: 'Round of 16' });
        remaining -= r16Count;
    }
    if (remaining >= 4 || rounds.length > 0) {
        const qfCount = Math.min(remaining > 0 ? remaining : 4, 4);
        if (remaining > 0) {
            rounds.push({ count: qfCount, label: 'Quarter Final' });
            remaining -= qfCount;
        }
    }
    if (remaining >= 2 || rounds.length > 0) {
        const sfCount = Math.min(remaining > 0 ? remaining : 2, 2);
        if (remaining > 0) {
            rounds.push({ count: sfCount, label: 'Semi Final' });
            remaining -= sfCount;
        }
    }
    if (remaining >= 1 || rounds.length > 0) {
        if (remaining > 0) {
            rounds.push({ count: 1, label: 'Final' });
            remaining -= 1;
        }
    }

    // If we still have remaining, add as group stage
    if (remaining > 0) {
        rounds.unshift({ count: remaining, label: 'Group Stage' });
    }

    // If no rounds were created, just do a simple round structure
    if (rounds.length === 0) {
        rounds.push({ count: totalMatches, label: 'Round 1' });
    }

    return rounds;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function nextPowerOf2(n) {
    let p = 1;
    while (p < n) p *= 2;
    return p;
}

// ============================================================
// RESULTS & ADMIN ACTIONS
// ============================================================

const getScheduleResults = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        const { data: matches, error: mErr } = await supabase
            .from('scheduled_matches')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('round_number')
            .order('match_order');

        if (mErr) throw mErr;

        const { data: report, error: rErr } = await supabase
            .from('schedule_reports')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('generated_at', { ascending: false })
            .limit(1)
            .single();

        const { data: schedConfig } = await supabase
            .from('tournament_schedule_config')
            .select('*')
            .eq('tournament_id', tournamentId)
            .single();

        // Get conflicted matches details
        const conflictedMatches = matches ? matches.filter(m => m.status === 'SCHEDULED_OVERLAP') : [];

        res.json({
            success: true,
            matches: matches || [],
            report: report || null,
            scheduleConfig: schedConfig || null,
            conflictedMatches
        });
    } catch (error) {
        console.error('getScheduleResults error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateMatchStatus = async (req, res) => {
    try {
        const { matchId } = req.params;
        const { status, winner_user_id, winner_team_id, winner_label, score_a, score_b, admin_notes, admin_hold_reason } = req.body;

        const updateData = { updated_at: new Date().toISOString() };
        if (status) updateData.status = status;
        if (winner_user_id !== undefined) updateData.winner_user_id = winner_user_id;
        if (winner_team_id !== undefined) updateData.winner_team_id = winner_team_id;
        if (winner_label !== undefined) updateData.winner_label = winner_label;
        if (score_a !== undefined) updateData.score_a = score_a;
        if (score_b !== undefined) updateData.score_b = score_b;
        if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
        if (admin_hold_reason !== undefined) updateData.admin_hold_reason = admin_hold_reason;

        const { data, error } = await supabase
            .from('scheduled_matches')
            .update(updateData)
            .eq('id', matchId)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, match: data });
    } catch (error) {
        console.error('updateMatchStatus error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const rescheduleMatch = async (req, res) => {
    try {
        const { matchId } = req.params;
        const { slot_id } = req.body;

        // Get the new slot
        const { data: slot, error: slotErr } = await supabase
            .from('schedule_slots')
            .select('*')
            .eq('id', slot_id)
            .single();

        if (slotErr || !slot) {
            return res.status(400).json({ success: false, message: 'Invalid slot.' });
        }

        // Update the match
        const { data, error } = await supabase
            .from('scheduled_matches')
            .update({
                slot_id: slot.id,
                scheduled_start: slot.slot_start,
                scheduled_end: slot.slot_end,
                venue_name: slot.venue_name,
                status: 'SCHEDULED',
                conflict_type: null,
                conflict_with_match_id: null,
                conflict_player_ids: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', matchId)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, match: data });
    } catch (error) {
        console.error('rescheduleMatch error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getBracketData = async (req, res) => {
    try {
        const { tournamentId, gameId } = req.params;

        const { data: matches, error } = await supabase
            .from('scheduled_matches')
            .select('*')
            .eq('tournament_id', tournamentId)
            .eq('game_id', gameId)
            .order('round_number')
            .order('match_order');

        if (error) throw error;

        // Get game info
        const { data: game } = await supabase
            .from('tournament_games')
            .select('id, game_name, game_type, category')
            .eq('id', gameId)
            .single();

        // Group by round
        const rounds = {};
        if (matches) {
            matches.forEach(m => {
                const rn = m.round_number || 1;
                if (!rounds[rn]) rounds[rn] = { label: m.round_label || `Round ${rn}`, matches: [] };
                rounds[rn].matches.push(m);
            });
        }

        res.json({
            success: true,
            game: game || null,
            rounds: Object.values(rounds),
            totalMatches: matches?.length || 0
        });
    } catch (error) {
        console.error('getBracketData error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getScheduleReport = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        const { data: report, error } = await supabase
            .from('schedule_reports')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('generated_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        // Get tournament info
        const { data: tournament } = await supabase
            .from('tournaments')
            .select('id, title')
            .eq('id', tournamentId)
            .single();

        res.json({
            success: true,
            report: report || null,
            tournament: tournament || null
        });
    } catch (error) {
        console.error('getScheduleReport error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all reports for analytics panel
const getAllReports = async (req, res) => {
    try {
        const { data: reports, error } = await supabase
            .from('schedule_reports')
            .select('*, tournaments(id, title)')
            .order('generated_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, reports: reports || [] });
    } catch (error) {
        console.error('getAllReports error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getGameConfigs,
    saveGameConfig,
    saveScheduleConfig,
    shuffleAndSchedule,
    getScheduleResults,
    updateMatchStatus,
    rescheduleMatch,
    getBracketData,
    getScheduleReport,
    getAllReports
};
