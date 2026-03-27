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
        const { match_duration, break_duration, parallel_matches, venue_names, priority } = req.body;

        const configData = {
            game_id: parseInt(gameId),
            match_duration: parseInt(match_duration) || 30,
            break_duration: parseInt(break_duration) || 10,
            parallel_matches: parseInt(parallel_matches) || 1,
            venue_names: venue_names || [],
            priority: parseInt(priority) || 0,
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
        const { start_date, end_date, daily_start_time, daily_end_time, scheduling_mode } = req.body;

        const configData = {
            tournament_id: parseInt(tournamentId),
            start_date,
            end_date,
            daily_start_time: daily_start_time || '09:00',
            daily_end_time: daily_end_time || '18:00',
            scheduling_mode: scheduling_mode || 'serial',
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
// CORE SCHEDULING ALGORITHM (v2 — UNIFIED SERIAL)
// ============================================================

// ---- Shared core: runs algorithm without DB writes ----
async function runSchedulingAlgorithm(tournamentId, schedConfig, games, configMap) {
    // 1. Generate match pools per game
    const allMatches = {};
    for (const game of games) {
        const matches = await generateMatchPool(game, tournamentId);
        allMatches[game.id] = matches;
    }

    // 2. Sort games by priority (desc) then match count (desc)
    const sortedGames = [...games].sort((a, b) => {
        const pA = configMap[a.id]?.priority || 0;
        const pB = configMap[b.id]?.priority || 0;
        if (pB !== pA) return pB - pA;
        return (allMatches[b.id]?.length || 0) - (allMatches[a.id]?.length || 0);
    });

    // 3. Build venue cursors per game
    //    Each game has its own venues. Each venue has a time cursor
    //    starting at daily_start_time on start_date.
    const dailyStartHHMM = schedConfig.daily_start_time.split(':').slice(0, 2).join(':');
    const dailyEndHHMM = schedConfig.daily_end_time.split(':').slice(0, 2).join(':');
    const startDate = new Date(schedConfig.start_date + 'T00:00:00+06:00');
    const endDate = new Date(schedConfig.end_date + 'T23:59:59+06:00');

    // Helper: get next available time for a venue cursor
    function advanceCursor(cursor, durationMs, breakMs) {
        let next = new Date(cursor.getTime() + durationMs + breakMs);
        const dateStr = next.toISOString().split('T')[0];
        const dayEnd = new Date(`${dateStr}T${dailyEndHHMM}:00+06:00`);

        // If next slot would exceed day end, jump to next day's start
        if (next.getTime() > dayEnd.getTime() ||
            next.getTime() + durationMs > dayEnd.getTime()) {
            const nextDay = new Date(next);
            nextDay.setDate(nextDay.getDate() + 1);
            // Skip forward until we find a valid day within range
            while (nextDay <= endDate) {
                const ndStr = nextDay.toISOString().split('T')[0];
                next = new Date(`${ndStr}T${dailyStartHHMM}:00+06:00`);
                const ndEnd = new Date(`${ndStr}T${dailyEndHHMM}:00+06:00`);
                if (next.getTime() + durationMs <= ndEnd.getTime()) {
                    return next;
                }
                nextDay.setDate(nextDay.getDate() + 1);
            }
            return null; // No more days available
        }
        return next;
    }

    // Initialize venue cursors per game
    const venueCursors = {}; // gameId -> [{venueName, cursor (Date)}]
    for (const game of games) {
        const cfg = configMap[game.id];
        const parallelCount = cfg.parallel_matches || 1;
        const venueNames = cfg.venue_names || [];
        const firstDayStr = startDate.toISOString().split('T')[0];
        const initialTime = new Date(`${firstDayStr}T${dailyStartHHMM}:00+06:00`);

        venueCursors[game.id] = [];
        for (let v = 0; v < parallelCount; v++) {
            venueCursors[game.id].push({
                venueName: venueNames[v] || `Venue ${v + 1}`,
                cursor: new Date(initialTime)
            });
        }
    }

    // 4. Serial assignment — process each game, assign matches sequentially
    const scheduledMatches = [];
    const slotsToInsert = [];
    const globalPlayerTimeline = {};
    const schedulingMode = schedConfig.scheduling_mode || 'serial';

    for (const game of sortedGames) {
        const matches = allMatches[game.id] || [];
        if (matches.length === 0) continue;

        const cfg = configMap[game.id];
        const matchDurationMs = cfg.match_duration * 60 * 1000;
        const breakDurationMs = cfg.break_duration * 60 * 1000;
        const venues = venueCursors[game.id];

        // Shuffle matches (random pairing order, but serial TIME assignment)
        shuffleArray(matches);

        let matchOrder = 0;

        for (const match of matches) {
            if (match.isBye) {
                // BYEs get the earliest venue's current slot but don't advance cursor
                const byeVenue = venues[0];
                const byeStart = new Date(byeVenue.cursor);
                const byeEnd = new Date(byeStart.getTime() + matchDurationMs);

                const slot = {
                    tournament_id: parseInt(tournamentId),
                    game_id: game.id,
                    slot_start: byeStart.toISOString(),
                    slot_end: byeEnd.toISOString(),
                    venue_name: byeVenue.venueName,
                    capacity: 1,
                    used: 1
                };
                slotsToInsert.push(slot);

                scheduledMatches.push({
                    tournament_id: parseInt(tournamentId),
                    game_id: game.id,
                    _slot_ref: slotsToInsert.length - 1,
                    participant_a_user_id: match.a_user_id || null,
                    participant_a_team_id: match.a_team_id || null,
                    participant_b_user_id: null,
                    participant_b_team_id: null,
                    participant_a_label: match.a_label,
                    participant_b_label: 'BYE',
                    scheduled_start: byeStart.toISOString(),
                    scheduled_end: byeEnd.toISOString(),
                    venue_name: byeVenue.venueName,
                    round_number: 1,
                    round_label: 'Round 1',
                    match_order: matchOrder++,
                    status: 'SCHEDULED',
                    conflict_type: null,
                    conflict_player_ids: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
                continue;
            }

            // Find the venue with the EARLIEST cursor (serial fill)
            let bestVenueIdx = 0;
            let earliestTime = venues[0].cursor.getTime();
            for (let v = 1; v < venues.length; v++) {
                if (venues[v].cursor.getTime() < earliestTime) {
                    earliestTime = venues[v].cursor.getTime();
                    bestVenueIdx = v;
                }
            }

            const venue = venues[bestVenueIdx];
            const slotStart = new Date(venue.cursor);
            const slotEnd = new Date(slotStart.getTime() + matchDurationMs);

            // Check if slot fits within tournament dates
            if (slotStart > endDate) {
                // No more room — this match can't be scheduled
                continue;
            }

            // Check daily end time
            const dayStr = slotStart.toISOString().split('T')[0];
            const dayEnd = new Date(`${dayStr}T${dailyEndHHMM}:00+06:00`);
            if (slotEnd.getTime() > dayEnd.getTime()) {
                // Advance to next day
                const nextDay = advanceCursor(new Date(dayEnd.getTime() - 1), 0, 0);
                if (!nextDay || nextDay > endDate) continue;
                venue.cursor = nextDay;
                // Re-attempt this match (push back to try again)
                // For simplicity, just assign at next day start
                const newStart = new Date(venue.cursor);
                const newEnd = new Date(newStart.getTime() + matchDurationMs);

                const slot = {
                    tournament_id: parseInt(tournamentId),
                    game_id: game.id,
                    slot_start: newStart.toISOString(),
                    slot_end: newEnd.toISOString(),
                    venue_name: venue.venueName,
                    capacity: 1,
                    used: 1
                };
                slotsToInsert.push(slot);

                // Check cross-sport conflict
                const conflict = calculateConflictFromTimeline(
                    newStart, newEnd, match, game.id, globalPlayerTimeline
                );

                scheduledMatches.push({
                    tournament_id: parseInt(tournamentId),
                    game_id: game.id,
                    _slot_ref: slotsToInsert.length - 1,
                    participant_a_user_id: match.a_user_id || null,
                    participant_a_team_id: match.a_team_id || null,
                    participant_b_user_id: match.b_user_id || null,
                    participant_b_team_id: match.b_team_id || null,
                    participant_a_label: match.a_label,
                    participant_b_label: match.b_label,
                    scheduled_start: newStart.toISOString(),
                    scheduled_end: newEnd.toISOString(),
                    venue_name: venue.venueName,
                    round_number: 1,
                    round_label: 'Round 1',
                    match_order: matchOrder++,
                    status: conflict.weight > 0 ? 'SCHEDULED_OVERLAP' : 'SCHEDULED',
                    conflict_type: conflict.type || null,
                    conflict_player_ids: conflict.playerIds || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

                // Update timeline
                updatePlayerTimeline(globalPlayerTimeline, match, newStart, newEnd, game.id);

                // Advance cursor
                venue.cursor = advanceCursor(newStart, matchDurationMs, breakDurationMs) || new Date(endDate.getTime() + 1);
                continue;
            }

            // Normal assignment at current cursor position
            const slot = {
                tournament_id: parseInt(tournamentId),
                game_id: game.id,
                slot_start: slotStart.toISOString(),
                slot_end: slotEnd.toISOString(),
                venue_name: venue.venueName,
                capacity: 1,
                used: 1
            };
            slotsToInsert.push(slot);

            // Check cross-sport conflict
            const conflict = calculateConflictFromTimeline(
                slotStart, slotEnd, match, game.id, globalPlayerTimeline
            );

            scheduledMatches.push({
                tournament_id: parseInt(tournamentId),
                game_id: game.id,
                _slot_ref: slotsToInsert.length - 1,
                participant_a_user_id: match.a_user_id || null,
                participant_a_team_id: match.a_team_id || null,
                participant_b_user_id: match.b_user_id || null,
                participant_b_team_id: match.b_team_id || null,
                participant_a_label: match.a_label,
                participant_b_label: match.b_label,
                scheduled_start: slotStart.toISOString(),
                scheduled_end: slotEnd.toISOString(),
                venue_name: venue.venueName,
                round_number: 1,
                round_label: 'Round 1',
                match_order: matchOrder++,
                status: conflict.weight > 0 ? 'SCHEDULED_OVERLAP' : 'SCHEDULED',
                conflict_type: conflict.type || null,
                conflict_player_ids: conflict.playerIds || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            // Update player timeline
            updatePlayerTimeline(globalPlayerTimeline, match, slotStart, slotEnd, game.id);

            // Advance cursor to next serial slot
            const nextCursor = advanceCursor(slotStart, matchDurationMs, breakDurationMs);
            venue.cursor = nextCursor || new Date(endDate.getTime() + 1);
        }
    }

    // 5. Build day-by-day breakdown for preview
    const dayBreakdown = buildDayBreakdown(scheduledMatches, games, configMap);

    // 6. Calculate report stats
    const totalConflicts = scheduledMatches.filter(m => m.status === 'SCHEDULED_OVERLAP').length;
    const sameSportConflicts = scheduledMatches.filter(m =>
        m.status === 'SCHEDULED_OVERLAP' && m.conflict_type === 'SAME_SPORT'
    ).length;
    const crossSportConflicts = scheduledMatches.filter(m =>
        m.status === 'SCHEDULED_OVERLAP' && m.conflict_type === 'CROSS_SPORT'
    ).length;

    const totalMatchesNeeded = Object.values(allMatches).reduce((sum, m) => sum + m.length, 0);
    const unscheduled = totalMatchesNeeded - scheduledMatches.length;

    return {
        scheduledMatches,
        slotsToInsert,
        games,
        configMap,
        allMatches,
        dayBreakdown,
        report: {
            total_matches: scheduledMatches.length,
            total_matches_needed: totalMatchesNeeded,
            unscheduled,
            total_conflicts: totalConflicts,
            same_sport_conflicts: sameSportConflicts,
            cross_sport_conflicts: crossSportConflicts,
            games_breakdown: games.map(g => ({
                id: g.id,
                name: g.game_name,
                category: g.category,
                total_matches: allMatches[g.id]?.length || 0,
                scheduled: scheduledMatches.filter(m => m.game_id === g.id).length,
                conflicts: scheduledMatches.filter(m => m.game_id === g.id && m.status === 'SCHEDULED_OVERLAP').length
            }))
        }
    };
}

// ---- Preview endpoint (dry run) ----
const previewSchedule = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // Load configs
        const { schedConfig, games, configMap, error: loadErr } = await loadScheduleData(tournamentId);
        if (loadErr) return res.status(400).json({ success: false, message: loadErr });

        // Run algorithm without saving
        const result = await runSchedulingAlgorithm(tournamentId, schedConfig, games, configMap);

        res.json({
            success: true,
            preview: true,
            matches: result.scheduledMatches.map(m => {
                const { _slot_ref, ...rest } = m;
                return rest;
            }),
            dayBreakdown: result.dayBreakdown,
            report: result.report
        });
    } catch (error) {
        console.error('previewSchedule error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ---- Schedule endpoint (saves to DB) ----
const shuffleAndSchedule = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        // Load configs
        const { schedConfig, games, configMap, error: loadErr } = await loadScheduleData(tournamentId);
        if (loadErr) return res.status(400).json({ success: false, message: loadErr });

        // Run algorithm
        const result = await runSchedulingAlgorithm(tournamentId, schedConfig, games, configMap);

        // Clear previous schedule
        await supabase.from('scheduled_matches').delete().eq('tournament_id', tournamentId);
        await supabase.from('schedule_slots').delete().eq('tournament_id', tournamentId);
        await supabase.from('schedule_reports').delete().eq('tournament_id', tournamentId);

        // Insert slots into DB
        let insertedSlots = [];
        if (result.slotsToInsert.length > 0) {
            for (let i = 0; i < result.slotsToInsert.length; i += 50) {
                const batch = result.slotsToInsert.slice(i, i + 50);
                const { data: ins, error: slotErr } = await supabase
                    .from('schedule_slots')
                    .insert(batch)
                    .select();
                if (slotErr) throw slotErr;
                if (ins) insertedSlots = insertedSlots.concat(ins);
            }
        }

        // Map slot refs to actual IDs
        const matchesToInsert = result.scheduledMatches.map(m => {
            const { _slot_ref, ...rest } = m;
            rest.slot_id = insertedSlots[_slot_ref]?.id || null;
            return rest;
        });

        // Insert matches
        let insertedMatches = [];
        if (matchesToInsert.length > 0) {
            for (let i = 0; i < matchesToInsert.length; i += 50) {
                const batch = matchesToInsert.slice(i, i + 50);
                const { data: ins, error: insErr } = await supabase
                    .from('scheduled_matches')
                    .insert(batch)
                    .select();
                if (insErr) throw insErr;
                if (ins) insertedMatches = insertedMatches.concat(ins);
            }
        }

        // Insert report
        const report = {
            tournament_id: parseInt(tournamentId),
            total_matches: result.report.total_matches,
            total_conflicts: result.report.total_conflicts,
            same_sport_conflicts: result.report.same_sport_conflicts,
            cross_sport_conflicts: result.report.cross_sport_conflicts,
            conflicted_match_ids: insertedMatches
                .filter(m => m.status === 'SCHEDULED_OVERLAP')
                .map(m => m.id).join(','),
            report_data: {
                ...result.report,
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

        res.json({
            success: true,
            message: `Scheduled ${insertedMatches.length} matches with ${result.report.total_conflicts} conflict(s).`,
            report: result.report,
            matches: insertedMatches,
            dayBreakdown: result.dayBreakdown
        });

    } catch (error) {
        console.error('shuffleAndSchedule error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ---- Suggest dates endpoint ----
const suggestDates = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { daily_start_time, daily_end_time } = req.body;

        const dailyStart = daily_start_time || '09:00';
        const dailyEnd = daily_end_time || '18:00';

        // Parse daily hours to calculate available minutes per day
        const [startH, startM] = dailyStart.split(':').map(Number);
        const [endH, endM] = dailyEnd.split(':').map(Number);
        const dailyMinutes = (endH * 60 + endM) - (startH * 60 + startM);

        if (dailyMinutes <= 0) {
            return res.status(400).json({ success: false, message: 'End time must be after start time.' });
        }

        // Load games and configs
        const { data: games, error: gErr } = await supabase
            .from('tournament_games')
            .select('id, category, game_name, game_type, team_size')
            .eq('tournament_id', tournamentId);

        if (gErr) throw gErr;
        if (!games || games.length === 0) {
            return res.status(400).json({ success: false, message: 'No games found.' });
        }

        const gameIds = games.map(g => g.id);
        const { data: configs } = await supabase
            .from('game_configs')
            .select('*')
            .in('game_id', gameIds);

        const configMap = {};
        if (configs) configs.forEach(c => { configMap[c.game_id] = c; });

        // Count matches needed per game
        const gamesAnalysis = [];
        let bottleneckDays = 0;
        let totalMatchesAll = 0;

        for (const game of games) {
            const cfg = configMap[game.id];
            if (!cfg) continue;

            const matchDuration = cfg.match_duration || 30;
            const breakDuration = cfg.break_duration || 10;
            const slotDuration = matchDuration + breakDuration;
            const parallelMatches = cfg.parallel_matches || 1;

            // Count registrations / teams
            let participantCount = 0;
            if (game.game_type === 'Solo') {
                const { count } = await supabase
                    .from('game_registrations')
                    .select('id', { count: 'exact', head: true })
                    .eq('game_id', game.id);
                participantCount = count || 0;
            } else {
                const { count } = await supabase
                    .from('teams')
                    .select('id', { count: 'exact', head: true })
                    .eq('tournament_game_id', game.id)
                    .in('status', ['CONFIRMED', 'PENDING']);
                participantCount = count || 0;
            }

            // Single-elimination: matches = ceil(participants/2)
            const totalMatches = Math.max(0, Math.ceil(participantCount / 2));
            totalMatchesAll += totalMatches;

            // Slots per day = floor(dailyMinutes / slotDuration) * parallelMatches
            const slotsPerDay = Math.floor(dailyMinutes / slotDuration) * parallelMatches;
            const minDays = slotsPerDay > 0 ? Math.ceil(totalMatches / slotsPerDay) : 999;

            if (minDays > bottleneckDays) bottleneckDays = minDays;

            gamesAnalysis.push({
                id: game.id,
                name: game.game_name,
                category: game.category,
                type: game.game_type,
                participants: participantCount,
                total_matches: totalMatches,
                match_duration: matchDuration,
                break_duration: breakDuration,
                parallel_matches: parallelMatches,
                slots_per_day: slotsPerDay,
                min_days: minDays
            });
        }

        // Generate 3 suggestions
        const today = new Date();
        today.setDate(today.getDate() + 1); // Start from tomorrow at earliest
        const baseStartStr = today.toISOString().split('T')[0];

        const compactDays = Math.max(bottleneckDays, 1);
        const comfortableDays = Math.max(Math.ceil(compactDays * 1.4), compactDays + 1);
        const relaxedDays = Math.max(Math.ceil(compactDays * 2), compactDays + 3);

        function addDays(dateStr, days) {
            const d = new Date(dateStr + 'T00:00:00');
            d.setDate(d.getDate() + days - 1);
            return d.toISOString().split('T')[0];
        }

        // Calculate total slots across all games for utilization
        function calcUtilization(days) {
            let totalSlots = 0;
            gamesAnalysis.forEach(g => { totalSlots += g.slots_per_day * days; });
            return totalSlots > 0 ? Math.round((totalMatchesAll / totalSlots) * 100) : 0;
        }

        const suggestions = [
            {
                label: `Compact (${compactDays} day${compactDays > 1 ? 's' : ''})`,
                mode: 'compact',
                start_date: baseStartStr,
                end_date: addDays(baseStartStr, compactDays),
                days: compactDays,
                utilization: calcUtilization(compactDays),
                description: 'Minimum days, tightly packed schedule. Possible time clashes in busy games.'
            },
            {
                label: `Comfortable (${comfortableDays} day${comfortableDays > 1 ? 's' : ''})`,
                mode: 'comfortable',
                start_date: baseStartStr,
                end_date: addDays(baseStartStr, comfortableDays),
                days: comfortableDays,
                utilization: calcUtilization(comfortableDays),
                description: 'Balanced schedule with buffer days. Low chance of clashes.'
            },
            {
                label: `Relaxed (${relaxedDays} day${relaxedDays > 1 ? 's' : ''})`,
                mode: 'relaxed',
                start_date: baseStartStr,
                end_date: addDays(baseStartStr, relaxedDays),
                days: relaxedDays,
                utilization: calcUtilization(relaxedDays),
                description: 'Spread out schedule with plenty of breathing room.'
            }
        ];

        // Find bottleneck game
        const bottleneckGame = gamesAnalysis.reduce((max, g) =>
            g.min_days > (max?.min_days || 0) ? g : max, null
        );

        res.json({
            success: true,
            suggestions,
            analysis: {
                total_matches: totalMatchesAll,
                total_games: games.length,
                bottleneck_game: bottleneckGame ? `${bottleneckGame.name} (${bottleneckGame.category})` : null,
                bottleneck_days: bottleneckDays,
                daily_hours: dailyMinutes / 60,
                games_breakdown: gamesAnalysis
            }
        });

    } catch (error) {
        console.error('suggestDates error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Load and validate all scheduling data
async function loadScheduleData(tournamentId) {
    const { data: schedConfig, error: scErr } = await supabase
        .from('tournament_schedule_config')
        .select('*')
        .eq('tournament_id', tournamentId)
        .single();

    if (scErr || !schedConfig) {
        return { error: 'Please configure the tournament schedule first (dates & times).' };
    }

    const { data: games, error: gErr } = await supabase
        .from('tournament_games')
        .select('id, category, game_name, game_type, team_size')
        .eq('tournament_id', tournamentId);

    if (gErr) throw gErr;
    if (!games || games.length === 0) {
        return { error: 'No games found for this tournament.' };
    }

    const gameIds = games.map(g => g.id);
    const { data: configs, error: cfgErr } = await supabase
        .from('game_configs')
        .select('*')
        .in('game_id', gameIds);

    if (cfgErr) throw cfgErr;

    const configMap = {};
    if (configs) configs.forEach(c => { configMap[c.game_id] = c; });

    const unconfigured = games.filter(g => !configMap[g.id]);
    if (unconfigured.length > 0) {
        return { error: `Please configure all games first. Missing: ${unconfigured.map(g => g.game_name).join(', ')}` };
    }

    return { schedConfig, games, configMap };
}

// Calculate conflict from global player timeline
function calculateConflictFromTimeline(slotStart, slotEnd, match, gameId, globalTimeline) {
    const playerIds = getPlayerIds(match);
    const startMs = slotStart.getTime();
    const endMs = slotEnd.getTime();

    let weight = 0;
    let type = null;
    const conflictingPlayers = [];

    for (const pid of playerIds) {
        const timeline = globalTimeline[pid] || [];
        for (const entry of timeline) {
            const eStart = entry.start.getTime();
            const eEnd = entry.end.getTime();

            if (startMs < eEnd && endMs > eStart) {
                weight++;
                conflictingPlayers.push(pid);
                type = entry.gameId === gameId ? 'SAME_SPORT' : 'CROSS_SPORT';
            }
        }
    }

    return {
        weight,
        type,
        playerIds: conflictingPlayers.length > 0 ? conflictingPlayers.join(',') : null
    };
}

// Update global player timeline
function updatePlayerTimeline(timeline, match, start, end, gameId) {
    const playerIds = getPlayerIds(match);
    playerIds.forEach(pid => {
        if (!timeline[pid]) timeline[pid] = [];
        timeline[pid].push({
            start: new Date(start),
            end: new Date(end),
            gameId
        });
    });
}

// Build day-by-day breakdown for preview
function buildDayBreakdown(scheduledMatches, games, configMap) {
    const days = {};
    const gameNameMap = {};
    games.forEach(g => { gameNameMap[g.id] = g.game_name; });

    for (const match of scheduledMatches) {
        if (!match.scheduled_start) continue;
        const dayStr = match.scheduled_start.split('T')[0];
        if (!days[dayStr]) {
            days[dayStr] = { date: dayStr, slots: [], matchCount: 0, conflictCount: 0 };
        }
        days[dayStr].slots.push({
            time: match.scheduled_start,
            end: match.scheduled_end,
            venue: match.venue_name,
            game: gameNameMap[match.game_id] || `Game ${match.game_id}`,
            game_id: match.game_id,
            matchup: `${match.participant_a_label} vs ${match.participant_b_label}`,
            status: match.status,
            conflict_type: match.conflict_type
        });
        days[dayStr].matchCount++;
        if (match.status === 'SCHEDULED_OVERLAP') days[dayStr].conflictCount++;
    }

    // Sort slots within each day by time, then venue
    for (const dayStr in days) {
        days[dayStr].slots.sort((a, b) => {
            const timeDiff = new Date(a.time) - new Date(b.time);
            if (timeDiff !== 0) return timeDiff;
            return (a.venue || '').localeCompare(b.venue || '');
        });
    }

    // Return as sorted array
    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
}

async function generateMatchPool(game, tournamentId) {
    const matches = [];
    const gameType = game.game_type;

    if (gameType === 'Solo') {
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

        shuffleArray(users);

        for (let i = 0; i < users.length; i += 2) {
            if (i + 1 < users.length) {
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
        const { data: teams, error } = await supabase
            .from('teams')
            .select('id, team_name, leader_user_id, team_members(user_id)')
            .eq('tournament_game_id', game.id)
            .in('status', ['CONFIRMED', 'PENDING']);

        if (error || !teams || teams.length < 2) return matches;

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

        // Build a proper single-elimination bracket from the matches
        const allMatches = matches || [];
        if (allMatches.length === 0) {
            return res.json({ success: true, game, rounds: [], totalMatches: 0 });
        }

        // All real matches go into Round 1 (the first round of the bracket)
        const round1Matches = allMatches.map((m, idx) => ({
            ...m,
            match_number: idx + 1
        }));

        // [BUG 1 FIX] Correct totalRounds: number of rounds in a single-elimination bracket
        // with N first-round matches is ceil(log2(N)) + 1, but we need at least 1 round.
        // For N=1 -> 1 round (Final only). For N=2 -> 2 rounds. For N=3,4 -> 3 rounds. etc.
        const totalR1 = round1Matches.length;
        let totalRounds;
        if (totalR1 <= 1) {
            totalRounds = 1;
        } else {
            // Number of rounds needed: keep halving R1 count until we reach 1
            totalRounds = Math.ceil(Math.log2(totalR1)) + 1;
        }

        // Build round labels
        function getRoundLabel(roundIdx, totalRounds) {
            const fromEnd = totalRounds - roundIdx;
            if (fromEnd === 1) return 'Final';
            if (fromEnd === 2) return 'Semi Final';
            if (fromEnd === 3) return 'Quarter Final';
            if (fromEnd === 4) return 'Round of 16';
            return `Round ${roundIdx + 1}`;
        }

        const rounds = [];

        // Round 1: all real matches
        const r1Label = totalRounds === 1 ? 'Final'
            : totalRounds === 2 ? 'Semi Final'
                : getRoundLabel(0, totalRounds);

        rounds.push({
            label: r1Label,
            matches: round1Matches.map(m => ({
                ...m,
                _matchNum: m.match_number,
                _isBye: m.participant_b_label === 'BYE'
            }))
        });

        // [BUG 2 FIX] Running match number counter to prevent duplicates
        let nextMatchNum = round1Matches.length + 1;

        // Generate placeholder rounds for subsequent elimination stages
        for (let r = 1; r < totalRounds; r++) {
            const prevRoundMatches = rounds[r - 1].matches;
            const nextRoundMatches = [];
            const label = getRoundLabel(r, totalRounds);

            for (let i = 0; i < prevRoundMatches.length; i += 2) {
                const m1 = prevRoundMatches[i];
                const m2 = prevRoundMatches[i + 1];

                // Determine labels for this match's participants
                let aLabel, bLabel;
                let aUserId = null, bUserId = null;
                let aTeamId = null, bTeamId = null;
                let isAutoAdvance = false;

                // [BUG 4 FIX] Check winner_label FIRST (even for BYE matches),
                // fall back to participant_a_label only if no winner recorded
                if (m1 && m1._isBye) {
                    // BYE match — use winner_label if set, otherwise the non-BYE participant auto-advances
                    aLabel = m1.winner_label || m1.participant_a_label;
                    aUserId = m1.winner_user_id || m1.participant_a_user_id;
                    aTeamId = m1.winner_team_id || m1.participant_a_team_id;
                } else if (m1 && m1.winner_label) {
                    aLabel = m1.winner_label;
                    aUserId = m1.winner_user_id;
                    aTeamId = m1.winner_team_id;
                } else if (m1) {
                    aLabel = `Winner of Match ${m1._matchNum}`;
                } else {
                    aLabel = 'TBD';
                }

                if (!m2) {
                    // [BUG 3 FIX] Odd number of matches in previous round — this one auto-advances
                    // Mark as auto-advance so the UI collapses it
                    bLabel = 'BYE';
                    isAutoAdvance = true;
                } else if (m2._isBye) {
                    // [BUG 4 FIX] Same as above — respect winner_label
                    bLabel = m2.winner_label || m2.participant_a_label;
                    bUserId = m2.winner_user_id || m2.participant_a_user_id;
                    bTeamId = m2.winner_team_id || m2.participant_a_team_id;
                } else if (m2.winner_label) {
                    bLabel = m2.winner_label;
                    bUserId = m2.winner_user_id;
                    bTeamId = m2.winner_team_id;
                } else {
                    bLabel = `Winner of Match ${m2._matchNum}`;
                }

                // [BUG 2 FIX] Use running counter for unique match numbers
                const matchNum = nextMatchNum++;

                // [BUG 3 FIX] For auto-advance placeholders, pre-set winner so next round picks it up
                let placeholderWinner = null;
                if (isAutoAdvance) {
                    placeholderWinner = aLabel;
                }

                nextRoundMatches.push({
                    id: null, // placeholder — no DB record
                    _matchNum: matchNum,
                    _isBye: isAutoAdvance,
                    _isPlaceholder: true,
                    round_number: r + 1,
                    round_label: label,
                    participant_a_label: aLabel,
                    participant_a_user_id: aUserId,
                    participant_a_team_id: aTeamId,
                    participant_b_label: bLabel,
                    participant_b_user_id: bUserId,
                    participant_b_team_id: bTeamId,
                    scheduled_start: null,
                    scheduled_end: null,
                    venue_name: null,
                    status: isAutoAdvance ? 'BYE_ADVANCE' : 'PENDING',
                    score_a: null,
                    score_b: null,
                    winner_label: placeholderWinner,
                    winner_user_id: isAutoAdvance ? aUserId : null,
                    winner_team_id: isAutoAdvance ? aTeamId : null
                });
            }

            // Stop generating rounds if we're down to 1 match (the Final)
            rounds.push({ label, matches: nextRoundMatches });
            if (nextRoundMatches.length <= 1) break;
        }

        res.json({
            success: true,
            game: game || null,
            rounds,
            totalMatches: allMatches.length
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
    previewSchedule,
    suggestDates,
    getScheduleResults,
    updateMatchStatus,
    rescheduleMatch,
    getBracketData,
    getScheduleReport,
    getAllReports
};
