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
// CORE SCHEDULING ALGORITHM (v3 — CONFLICT-MINIMIZING)
// ============================================================
//
// Key improvements over v2:
// 1. Interleaved round-robin scheduling across all games (not sequential)
// 2. Conflict-risk-aware ordering: multi-game players scheduled first
// 3. Active conflict avoidance: tries multiple time slots before accepting
// 4. Per-venue interval tracking: precisely tracks occupied slots + breaks
// 5. Post-optimization swap pass: reduces remaining conflicts by swapping

const TZ_OFFSET = '+06:00'; // Bangladesh Standard Time

// Convert a Date to YYYY-MM-DD in Bangladesh timezone
function toDateStr(d) {
    const bdMs = d.getTime() + 6 * 3600000;
    return new Date(bdMs).toISOString().split('T')[0];
}

// Create a Date from date string + HH:MM in Bangladesh timezone
function makeTime(dateStr, timeHHMM) {
    return new Date(`${dateStr}T${timeHHMM}:00${TZ_OFFSET}`);
}

// Find next free (unoccupied) slot on a venue starting from `fromTime`.
// Returns null if no slot fits before endDate.
function findFreeSlot(venue, fromTime, matchDurationMs, breakMs, dailyStartHHMM, dailyEndHHMM, endDate) {
    let candidate = new Date(Math.max(fromTime.getTime(), 0));
    let iterations = 0;

    while (candidate <= endDate && iterations < 1000) {
        iterations++;
        const dayStr = toDateStr(candidate);
        const dayStart = makeTime(dayStr, dailyStartHHMM);
        const dayEnd = makeTime(dayStr, dailyEndHHMM);

        // Snap to daily start if before
        if (candidate < dayStart) candidate = new Date(dayStart);

        const slotEnd = new Date(candidate.getTime() + matchDurationMs);

        // Past daily end → jump to next day
        if (slotEnd > dayEnd) {
            const nextDayDate = new Date(dayStart.getTime() + 24 * 3600000);
            candidate = makeTime(toDateStr(nextDayDate), dailyStartHHMM);
            continue;
        }

        // Check overlap with occupied intervals (include break gap after each)
        let blocked = false;
        let skipTo = 0;
        const candStartMs = candidate.getTime();
        const candEndMs = slotEnd.getTime();

        for (const occ of venue.occupied) {
            const occEndWithBreak = occ.end + breakMs;
            if (candStartMs < occEndWithBreak && candEndMs > occ.start) {
                blocked = true;
                skipTo = Math.max(skipTo, occEndWithBreak);
            }
        }

        if (!blocked) return candidate;
        candidate = new Date(skipTo);
    }

    return null;
}

// ---- Shared core: runs algorithm without DB writes ----
async function runSchedulingAlgorithm(tournamentId, schedConfig, games, configMap) {

    // ================================================================
    // Phase 1: Generate match pools per game
    // ================================================================
    const allMatches = {};
    for (const game of games) {
        allMatches[game.id] = await generateMatchPool(game, tournamentId);
    }

    // ================================================================
    // Phase 2: Build player participation map
    // ================================================================
    // playerGameCount[playerId] = number of distinct games this player is in
    const playerGameCount = {};
    for (const game of games) {
        for (const match of allMatches[game.id] || []) {
            getPlayerIds(match).forEach(pid => {
                playerGameCount[pid] = (playerGameCount[pid] || 0) + 1;
            });
        }
    }

    // ================================================================
    // Phase 3: Sort games by priority; sort matches by conflict risk
    // ================================================================
    const sortedGames = [...games].sort((a, b) => {
        const pA = configMap[a.id]?.priority || 0;
        const pB = configMap[b.id]?.priority || 0;
        if (pB !== pA) return pB - pA;
        return (allMatches[b.id]?.length || 0) - (allMatches[a.id]?.length || 0);
    });

    // Within each game, schedule high-risk matches first (players in multiple games)
    // so they get the most scheduling flexibility (more open slots available)
    for (const game of games) {
        const matches = allMatches[game.id] || [];
        matches.sort((a, b) => {
            if (a.isBye !== b.isBye) return a.isBye ? 1 : -1;
            const riskA = getPlayerIds(a).reduce((s, p) => s + (playerGameCount[p] || 1), 0);
            const riskB = getPlayerIds(b).reduce((s, p) => s + (playerGameCount[p] || 1), 0);
            return riskB - riskA; // Higher risk first
        });
    }

    // ================================================================
    // Phase 4: Build interleaved match queue (round-robin across games)
    // ================================================================
    // Instead of scheduling ALL of Game A, then ALL of Game B (which
    // causes conflicts for shared players), we alternate: 1 from A,
    // 1 from B, 1 from C, back to A, etc. This naturally spreads
    // each game's matches across the timeline.
    const matchQueue = [];
    const ptrs = {};
    sortedGames.forEach(g => { ptrs[g.id] = 0; });

    let more = true;
    while (more) {
        more = false;
        for (const game of sortedGames) {
            const matches = allMatches[game.id] || [];
            if (ptrs[game.id] < matches.length) {
                matchQueue.push({ match: matches[ptrs[game.id]], game });
                ptrs[game.id]++;
                more = true;
            }
        }
    }

    // ================================================================
    // Phase 5: Time grid setup
    // ================================================================
    const dailyStartHHMM = schedConfig.daily_start_time.split(':').slice(0, 2).join(':');
    const dailyEndHHMM = schedConfig.daily_end_time.split(':').slice(0, 2).join(':');
    // Use the raw date strings from config to avoid timezone round-trip bugs
    const firstDayStart = makeTime(schedConfig.start_date, dailyStartHHMM);
    const endDateTime = makeTime(schedConfig.end_date, dailyEndHHMM);

    // Per-game venue trackers with occupied interval lists
    const venueData = {};
    for (const game of games) {
        const cfg = configMap[game.id];
        const parallelCount = cfg.parallel_matches || 1;
        const venueNames = cfg.venue_names || [];
        venueData[game.id] = [];
        for (let v = 0; v < parallelCount; v++) {
            venueData[game.id].push({
                venueName: venueNames[v] || `Venue ${v + 1}`,
                occupied: [] // [{start: ms, end: ms}] sorted by start
            });
        }
    }

    // ================================================================
    // Phase 6: Assign matches with active conflict avoidance
    // ================================================================
    // For each match we try up to CANDIDATES_PER_VENUE time slots on
    // each venue. If a slot has a player conflict, we skip ahead to
    // the next free slot. We pick the slot with zero conflicts (if
    // any), otherwise the slot with the minimum conflict weight.

    const globalPlayerTimeline = {};
    const scheduledMatches = [];
    const slotsToInsert = [];
    const CANDIDATES_PER_VENUE = 15;

    for (const { match, game } of matchQueue) {
        const cfg = configMap[game.id];
        const durationMs = cfg.match_duration * 60 * 1000;
        const breakMs = cfg.break_duration * 60 * 1000;
        const venues = venueData[game.id];
        const pIds = getPlayerIds(match);

        // --- BYE handling (no venue blocking, no conflict possible) ---
        if (match.isBye) {
            const byeStart = findFreeSlot(
                venues[0], firstDayStart, durationMs, breakMs,
                dailyStartHHMM, dailyEndHHMM, endDateTime
            );
            if (!byeStart) continue;
            const byeEnd = new Date(byeStart.getTime() + durationMs);

            slotsToInsert.push({
                tournament_id: parseInt(tournamentId), game_id: game.id,
                slot_start: byeStart.toISOString(), slot_end: byeEnd.toISOString(),
                venue_name: venues[0].venueName, capacity: 1, used: 1
            });
            scheduledMatches.push({
                tournament_id: parseInt(tournamentId), game_id: game.id,
                _slot_ref: slotsToInsert.length - 1, _playerIds: pIds,
                participant_a_user_id: match.a_user_id || null,
                participant_a_team_id: match.a_team_id || null,
                participant_b_user_id: null, participant_b_team_id: null,
                participant_a_label: match.a_label, participant_b_label: 'BYE',
                scheduled_start: byeStart.toISOString(),
                scheduled_end: byeEnd.toISOString(),
                venue_name: venues[0].venueName,
                round_number: 1, round_label: 'Round 1',
                match_order: scheduledMatches.length,
                status: 'SCHEDULED',
                conflict_type: null, conflict_player_ids: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            continue;
        }

        // --- Regular match: search for the best slot ---
        let bestCandidate = null;

        for (let vi = 0; vi < venues.length; vi++) {
            let searchFrom = new Date(firstDayStart);

            for (let c = 0; c < CANDIDATES_PER_VENUE; c++) {
                const slotStart = findFreeSlot(
                    venues[vi], searchFrom, durationMs, breakMs,
                    dailyStartHHMM, dailyEndHHMM, endDateTime
                );
                if (!slotStart) break;

                const slotEnd = new Date(slotStart.getTime() + durationMs);

                // Score this slot by checking player timeline conflicts
                const conflict = calculateConflictFromTimeline(
                    slotStart, slotEnd, match, game.id, globalPlayerTimeline
                );

                const candidate = {
                    venueIdx: vi, venueName: venues[vi].venueName,
                    start: slotStart, end: slotEnd, conflict
                };

                // Zero conflict → perfect, take it immediately
                if (conflict.weight === 0) {
                    bestCandidate = candidate;
                    break;
                }

                // Track minimum-conflict slot as fallback
                if (!bestCandidate ||
                    conflict.weight < bestCandidate.conflict.weight ||
                    (conflict.weight === bestCandidate.conflict.weight &&
                     slotStart.getTime() < bestCandidate.start.getTime())) {
                    bestCandidate = candidate;
                }

                // Advance search past this slot to try the next one
                searchFrom = new Date(slotStart.getTime() + durationMs + breakMs);
            }

            // If we already found a perfect slot, stop searching venues
            if (bestCandidate && bestCandidate.conflict.weight === 0) break;
        }

        if (!bestCandidate) continue; // No room at all

        // --- Assign the match to the best slot ---
        slotsToInsert.push({
            tournament_id: parseInt(tournamentId), game_id: game.id,
            slot_start: bestCandidate.start.toISOString(),
            slot_end: bestCandidate.end.toISOString(),
            venue_name: bestCandidate.venueName, capacity: 1, used: 1
        });

        scheduledMatches.push({
            tournament_id: parseInt(tournamentId), game_id: game.id,
            _slot_ref: slotsToInsert.length - 1, _playerIds: pIds,
            participant_a_user_id: match.a_user_id || null,
            participant_a_team_id: match.a_team_id || null,
            participant_b_user_id: match.b_user_id || null,
            participant_b_team_id: match.b_team_id || null,
            participant_a_label: match.a_label,
            participant_b_label: match.b_label,
            scheduled_start: bestCandidate.start.toISOString(),
            scheduled_end: bestCandidate.end.toISOString(),
            venue_name: bestCandidate.venueName,
            round_number: 1, round_label: 'Round 1',
            match_order: scheduledMatches.length,
            status: bestCandidate.conflict.weight > 0 ? 'SCHEDULED_OVERLAP' : 'SCHEDULED',
            conflict_type: bestCandidate.conflict.type || null,
            conflict_player_ids: bestCandidate.conflict.playerIds || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        // Mark venue slot as occupied
        venues[bestCandidate.venueIdx].occupied.push({
            start: bestCandidate.start.getTime(),
            end: bestCandidate.end.getTime()
        });
        venues[bestCandidate.venueIdx].occupied.sort((a, b) => a.start - b.start);

        // Update global player timeline
        updatePlayerTimeline(globalPlayerTimeline, match, bestCandidate.start, bestCandidate.end, game.id);
    }

    // ================================================================
    // Phase 7: Post-optimization swap pass
    // ================================================================
    // For each remaining SCHEDULED_OVERLAP match, try swapping its
    // time slot with a non-conflicting match of the same game. If the
    // swap eliminates both matches' conflicts, apply it.
    runSwapOptimization(scheduledMatches, slotsToInsert, globalPlayerTimeline);

    // ================================================================
    // Phase 8: Build report
    // ================================================================
    const dayBreakdown = buildDayBreakdown(scheduledMatches, games, configMap);
    const totalConflicts = scheduledMatches.filter(m => m.status === 'SCHEDULED_OVERLAP').length;
    const sameSportConflicts = scheduledMatches.filter(m =>
        m.status === 'SCHEDULED_OVERLAP' && m.conflict_type === 'SAME_SPORT'
    ).length;
    const crossSportConflicts = scheduledMatches.filter(m =>
        m.status === 'SCHEDULED_OVERLAP' && m.conflict_type === 'CROSS_SPORT'
    ).length;
    const totalMatchesNeeded = Object.values(allMatches).reduce((sum, m) => sum + m.length, 0);

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
            unscheduled: totalMatchesNeeded - scheduledMatches.length,
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

// ---- Swap Optimization Engine ----
// Iteratively tries to swap conflicting matches with non-conflicting
// ones of the same game to eliminate player timeline overlaps.
function runSwapOptimization(scheduledMatches, slotsToInsert, globalTimeline) {
    const MAX_PASSES = 3;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        let improved = false;

        // Collect all currently conflicting matches
        const conflicting = [];
        scheduledMatches.forEach((m, i) => {
            if (m.status === 'SCHEDULED_OVERLAP') conflicting.push({ m, i });
        });

        if (conflicting.length === 0) break; // Nothing to optimize

        for (const { m: cm } of conflicting) {
            // Find non-conflicting matches in the same game to try swapping
            const candidates = [];
            scheduledMatches.forEach((m, i) => {
                if (m.game_id === cm.game_id &&
                    m.status === 'SCHEDULED' &&
                    m.participant_b_label !== 'BYE') {
                    candidates.push({ m, i });
                }
            });

            for (const { m: sm } of candidates) {
                const cmPIds = cm._playerIds || [];
                const smPIds = sm._playerIds || [];

                // Build exclusion set: temporarily remove both matches
                const exclude = [
                    { startMs: new Date(cm.scheduled_start).getTime(), endMs: new Date(cm.scheduled_end).getTime(), gameId: cm.game_id, pIds: cmPIds },
                    { startMs: new Date(sm.scheduled_start).getTime(), endMs: new Date(sm.scheduled_end).getTime(), gameId: sm.game_id, pIds: smPIds }
                ];

                // Would cm be conflict-free at sm's time slot?
                const cmClean = !checkConflictExcluding(
                    cmPIds, new Date(sm.scheduled_start), new Date(sm.scheduled_end),
                    cm.game_id, globalTimeline, exclude
                );

                // Would sm be conflict-free at cm's time slot?
                const smClean = !checkConflictExcluding(
                    smPIds, new Date(cm.scheduled_start), new Date(cm.scheduled_end),
                    sm.game_id, globalTimeline, exclude
                );

                if (cmClean && smClean) {
                    // Swap improves things — apply it
                    removeTimelineEntries(globalTimeline, cmPIds, new Date(cm.scheduled_start), new Date(cm.scheduled_end), cm.game_id);
                    removeTimelineEntries(globalTimeline, smPIds, new Date(sm.scheduled_start), new Date(sm.scheduled_end), sm.game_id);

                    // Swap time/venue
                    const tmpStart = cm.scheduled_start;
                    const tmpEnd = cm.scheduled_end;
                    const tmpVenue = cm.venue_name;

                    cm.scheduled_start = sm.scheduled_start;
                    cm.scheduled_end = sm.scheduled_end;
                    cm.venue_name = sm.venue_name;
                    cm.status = 'SCHEDULED';
                    cm.conflict_type = null;
                    cm.conflict_player_ids = null;

                    sm.scheduled_start = tmpStart;
                    sm.scheduled_end = tmpEnd;
                    sm.venue_name = tmpVenue;
                    // sm stays SCHEDULED (verify it's still clean is guaranteed by smClean check)

                    // Update slot references
                    if (slotsToInsert[cm._slot_ref]) {
                        slotsToInsert[cm._slot_ref].slot_start = cm.scheduled_start;
                        slotsToInsert[cm._slot_ref].slot_end = cm.scheduled_end;
                        slotsToInsert[cm._slot_ref].venue_name = cm.venue_name;
                    }
                    if (slotsToInsert[sm._slot_ref]) {
                        slotsToInsert[sm._slot_ref].slot_start = sm.scheduled_start;
                        slotsToInsert[sm._slot_ref].slot_end = sm.scheduled_end;
                        slotsToInsert[sm._slot_ref].venue_name = sm.venue_name;
                    }

                    // Re-add timeline entries at new positions
                    addTimelineEntries(globalTimeline, cmPIds, new Date(cm.scheduled_start), new Date(cm.scheduled_end), cm.game_id);
                    addTimelineEntries(globalTimeline, smPIds, new Date(sm.scheduled_start), new Date(sm.scheduled_end), sm.game_id);

                    improved = true;
                    break; // Move to next conflicting match
                }
            }
        }

        if (!improved) break; // No more swaps possible
    }
}

// Check if placing playerIds at [start, end] would cause a timeline
// conflict, EXCLUDING the specified entries (used during swap simulation)
function checkConflictExcluding(playerIds, start, end, gameId, globalTimeline, excludeEntries) {
    const startMs = start.getTime();
    const endMs = end.getTime();

    for (const pid of playerIds) {
        const timeline = globalTimeline[pid] || [];
        for (const entry of timeline) {
            // Skip excluded entries (the swapping matches themselves)
            const isExcluded = excludeEntries.some(ex =>
                ex.pIds.includes(pid) &&
                Math.abs(entry.start.getTime() - ex.startMs) < 1000 &&
                Math.abs(entry.end.getTime() - ex.endMs) < 1000 &&
                entry.gameId === ex.gameId
            );
            if (isExcluded) continue;

            if (startMs < entry.end.getTime() && endMs > entry.start.getTime()) {
                return true; // Conflict found
            }
        }
    }
    return false;
}

// Remove specific timeline entries for players
function removeTimelineEntries(timeline, playerIds, start, end, gameId) {
    const startMs = start.getTime();
    const endMs = end.getTime();
    for (const pid of playerIds) {
        if (!timeline[pid]) continue;
        timeline[pid] = timeline[pid].filter(e =>
            !(Math.abs(e.start.getTime() - startMs) < 1000 &&
              Math.abs(e.end.getTime() - endMs) < 1000 &&
              e.gameId === gameId)
        );
    }
}

// Add timeline entries for players
function addTimelineEntries(timeline, playerIds, start, end, gameId) {
    for (const pid of playerIds) {
        if (!timeline[pid]) timeline[pid] = [];
        timeline[pid].push({ start: new Date(start), end: new Date(end), gameId });
    }
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
                const { _slot_ref, _playerIds, ...rest } = m;
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
            const { _slot_ref, _playerIds, ...rest } = m;
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
