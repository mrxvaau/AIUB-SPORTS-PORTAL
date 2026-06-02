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
    // Phase 1: Generate Round 1 match pools per game
    // ================================================================
    const allR1Matches = {};
    for (const game of games) {
        allR1Matches[game.id] = await generateMatchPool(game, tournamentId);
    }

    // ================================================================
    // Phase 2: Build full bracket structure for each game (all rounds)
    // ================================================================
    const allBrackets = {};
    for (const game of games) {
        allBrackets[game.id] = generateFullBracket(allR1Matches[game.id], game.id);
    }

    // ================================================================
    // Phase 3: Build player participation map (Round 1 only)
    // ================================================================
    const playerGameCount = {};
    for (const game of games) {
        for (const match of allR1Matches[game.id] || []) {
            getPlayerIds(match).forEach(pid => {
                playerGameCount[pid] = (playerGameCount[pid] || 0) + 1;
            });
        }
    }

    // ================================================================
    // Phase 4: Sort games by priority; sort R1 matches by conflict risk
    // ================================================================
    const sortedGames = [...games].sort((a, b) => {
        const pA = configMap[a.id]?.priority || 0;
        const pB = configMap[b.id]?.priority || 0;
        if (pB !== pA) return pB - pA;
        return (allR1Matches[b.id]?.length || 0) - (allR1Matches[a.id]?.length || 0);
    });

    for (const game of games) {
        const matches = allR1Matches[game.id] || [];
        matches.sort((a, b) => {
            if (a.isBye !== b.isBye) return a.isBye ? 1 : -1;
            const riskA = getPlayerIds(a).reduce((s, p) => s + (playerGameCount[p] || 1), 0);
            const riskB = getPlayerIds(b).reduce((s, p) => s + (playerGameCount[p] || 1), 0);
            return riskB - riskA;
        });
    }

    // ================================================================
    // Phase 5: Build interleaved Round 1 queue
    // ================================================================
    const r1Queue = [];
    const ptrs = {};
    sortedGames.forEach(g => { ptrs[g.id] = 0; });

    let more = true;
    while (more) {
        more = false;
        for (const game of sortedGames) {
            const matches = allR1Matches[game.id] || [];
            if (ptrs[game.id] < matches.length) {
                r1Queue.push({ match: matches[ptrs[game.id]], game });
                ptrs[game.id]++;
                more = true;
            }
        }
    }

    // ================================================================
    // Phase 6: Time grid setup
    // ================================================================
    const dailyStartHHMM = schedConfig.daily_start_time.split(':').slice(0, 2).join(':');
    const dailyEndHHMM = schedConfig.daily_end_time.split(':').slice(0, 2).join(':');
    const firstDayStart = makeTime(schedConfig.start_date, dailyStartHHMM);
    const endDateTime = makeTime(schedConfig.end_date, dailyEndHHMM);

    const venueData = {};
    for (const game of games) {
        const cfg = configMap[game.id];
        const parallelCount = cfg.parallel_matches || 1;
        const venueNames = cfg.venue_names || [];
        venueData[game.id] = [];
        for (let v = 0; v < parallelCount; v++) {
            venueData[game.id].push({
                venueName: venueNames[v] || `Venue ${v + 1}`,
                occupied: []
            });
        }
    }

    // ================================================================
    // Phase 7: Schedule Round 1 with active conflict avoidance
    // ================================================================
    const globalPlayerTimeline = {};
    const scheduledMatches = [];
    const slotsToInsert = [];
    const CANDIDATES_PER_VENUE = 15;
    const latestEndPerGameRound = {};
    let globalMatchOrder = 0;

    for (const { match, game } of r1Queue) {
        const cfg = configMap[game.id];
        const durationMs = cfg.match_duration * 60 * 1000;
        const breakMs = cfg.break_duration * 60 * 1000;
        const venues = venueData[game.id];
        const pIds = getPlayerIds(match);
        const totalRounds = allBrackets[game.id].rounds.length;

        // BYE handling
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
                _bracketIdx: match._bracketIdx,
                participant_a_user_id: match.a_user_id || null,
                participant_a_team_id: match.a_team_id || null,
                participant_b_user_id: null, participant_b_team_id: null,
                participant_a_label: match.a_label, participant_b_label: 'BYE',
                scheduled_start: byeStart.toISOString(),
                scheduled_end: byeEnd.toISOString(),
                venue_name: venues[0].venueName,
                round_number: 1, round_label: getRoundLabel(0, totalRounds),
                match_order: globalMatchOrder++,
                status: 'SCHEDULED',
                winner_label: match.a_label,
                winner_user_id: match.a_user_id || null,
                winner_team_id: match.a_team_id || null,
                conflict_type: null, conflict_player_ids: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            trackLatestEnd(latestEndPerGameRound, game.id, 1, byeEnd);
            continue;
        }

        // Regular match: search for best slot
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

                const conflict = calculateConflictFromTimeline(
                    slotStart, slotEnd, match, game.id, globalPlayerTimeline
                );
                const candidate = {
                    venueIdx: vi, venueName: venues[vi].venueName,
                    start: slotStart, end: slotEnd, conflict
                };

                if (conflict.weight === 0) { bestCandidate = candidate; break; }

                if (!bestCandidate ||
                    conflict.weight < bestCandidate.conflict.weight ||
                    (conflict.weight === bestCandidate.conflict.weight &&
                     slotStart.getTime() < bestCandidate.start.getTime())) {
                    bestCandidate = candidate;
                }
                searchFrom = new Date(slotStart.getTime() + durationMs + breakMs);
            }
            if (bestCandidate && bestCandidate.conflict.weight === 0) break;
        }

        if (!bestCandidate) continue;

        slotsToInsert.push({
            tournament_id: parseInt(tournamentId), game_id: game.id,
            slot_start: bestCandidate.start.toISOString(),
            slot_end: bestCandidate.end.toISOString(),
            venue_name: bestCandidate.venueName, capacity: 1, used: 1
        });
        scheduledMatches.push({
            tournament_id: parseInt(tournamentId), game_id: game.id,
            _slot_ref: slotsToInsert.length - 1, _playerIds: pIds,
            _bracketIdx: match._bracketIdx,
            participant_a_user_id: match.a_user_id || null,
            participant_a_team_id: match.a_team_id || null,
            participant_b_user_id: match.b_user_id || null,
            participant_b_team_id: match.b_team_id || null,
            participant_a_label: match.a_label,
            participant_b_label: match.b_label,
            scheduled_start: bestCandidate.start.toISOString(),
            scheduled_end: bestCandidate.end.toISOString(),
            venue_name: bestCandidate.venueName,
            round_number: 1, round_label: getRoundLabel(0, allBrackets[game.id].rounds.length),
            match_order: globalMatchOrder++,
            status: bestCandidate.conflict.weight > 0 ? 'SCHEDULED_OVERLAP' : 'SCHEDULED',
            conflict_type: bestCandidate.conflict.type || null,
            conflict_player_ids: bestCandidate.conflict.playerIds || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        venues[bestCandidate.venueIdx].occupied.push({
            start: bestCandidate.start.getTime(), end: bestCandidate.end.getTime()
        });
        venues[bestCandidate.venueIdx].occupied.sort((a, b) => a.start - b.start);
        updatePlayerTimeline(globalPlayerTimeline, match, bestCandidate.start, bestCandidate.end, game.id);
        trackLatestEnd(latestEndPerGameRound, game.id, 1, bestCandidate.end);
    }

    // ================================================================
    // Phase 8: Post-optimization swap pass (Round 1 only)
    // ================================================================
    runSwapOptimization(scheduledMatches, slotsToInsert, globalPlayerTimeline);

    // ================================================================
    // Phase 9: Schedule Round 2+ matches (chronologically after prev round)
    // ================================================================
    for (const game of sortedGames) {
        const bracket = allBrackets[game.id];
        if (bracket.rounds.length <= 1) continue;

        const cfg = configMap[game.id];
        const durationMs = cfg.match_duration * 60 * 1000;
        const breakMs = cfg.break_duration * 60 * 1000;
        const venues = venueData[game.id];
        const totalRounds = bracket.rounds.length;

        for (let r = 1; r < totalRounds; r++) {
            const roundMatches = bracket.rounds[r];
            const prevRoundEnd = getLatestEnd(latestEndPerGameRound, game.id, r);

            // Round N+1 starts after Round N ends + break
            let roundStartFrom = prevRoundEnd
                ? new Date(prevRoundEnd.getTime() + breakMs)
                : new Date(firstDayStart);

            const roundLabel = getRoundLabel(r, totalRounds);

            for (const placeholder of roundMatches) {
                let slotStart = null;
                let venueName = null;

                for (let vi = 0; vi < venues.length; vi++) {
                    slotStart = findFreeSlot(
                        venues[vi], roundStartFrom, durationMs, breakMs,
                        dailyStartHHMM, dailyEndHHMM, endDateTime
                    );
                    if (slotStart) {
                        venueName = venues[vi].venueName;
                        const slotEnd = new Date(slotStart.getTime() + durationMs);
                        venues[vi].occupied.push({
                            start: slotStart.getTime(), end: slotEnd.getTime()
                        });
                        venues[vi].occupied.sort((a, b) => a.start - b.start);
                        break;
                    }
                }

                if (!slotStart) {
                    console.warn(`[scheduler] No slot for ${game.game_name} Round ${r + 1}`);
                    continue;
                }

                const slotEnd = new Date(slotStart.getTime() + durationMs);

                slotsToInsert.push({
                    tournament_id: parseInt(tournamentId), game_id: game.id,
                    slot_start: slotStart.toISOString(), slot_end: slotEnd.toISOString(),
                    venue_name: venueName, capacity: 1, used: 1
                });
                scheduledMatches.push({
                    tournament_id: parseInt(tournamentId), game_id: game.id,
                    _slot_ref: slotsToInsert.length - 1, _playerIds: [],
                    _bracketIdx: placeholder._bracketIdx,
                    _feederA_bracketIdx: placeholder.feederA_bracketIdx,
                    _feederB_bracketIdx: placeholder.feederB_bracketIdx,
                    participant_a_user_id: null,
                    participant_a_team_id: null,
                    participant_b_user_id: null,
                    participant_b_team_id: null,
                    participant_a_label: placeholder.a_label,
                    participant_b_label: placeholder.b_label,
                    scheduled_start: slotStart.toISOString(),
                    scheduled_end: slotEnd.toISOString(),
                    venue_name: venueName,
                    round_number: r + 1, round_label: roundLabel,
                    match_order: globalMatchOrder++,
                    status: 'PENDING',
                    conflict_type: null, conflict_player_ids: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
                trackLatestEnd(latestEndPerGameRound, game.id, r + 1, slotEnd);
            }
        }
    }

    // ================================================================
    // Phase 10: Build report
    // ================================================================
    const dayBreakdown = buildDayBreakdown(scheduledMatches, games, configMap);
    const r1Matches = scheduledMatches.filter(m => m.round_number === 1);
    const totalConflicts = r1Matches.filter(m => m.status === 'SCHEDULED_OVERLAP').length;
    const sameSportConflicts = r1Matches.filter(m =>
        m.status === 'SCHEDULED_OVERLAP' && m.conflict_type === 'SAME_SPORT'
    ).length;
    const crossSportConflicts = r1Matches.filter(m =>
        m.status === 'SCHEDULED_OVERLAP' && m.conflict_type === 'CROSS_SPORT'
    ).length;
    const totalAllRounds = scheduledMatches.length;

    return {
        scheduledMatches,
        slotsToInsert,
        games,
        configMap,
        allMatches: allR1Matches,
        allBrackets,
        dayBreakdown,
        report: {
            total_matches: totalAllRounds,
            total_r1_matches: r1Matches.length,
            total_later_round_matches: totalAllRounds - r1Matches.length,
            total_matches_needed: Object.values(allR1Matches).reduce((sum, m) => sum + m.length, 0),
            unscheduled: 0,
            total_conflicts: totalConflicts,
            same_sport_conflicts: sameSportConflicts,
            cross_sport_conflicts: crossSportConflicts,
            games_breakdown: games.map(g => ({
                id: g.id,
                name: g.game_name,
                category: g.category,
                total_r1_matches: allR1Matches[g.id]?.length || 0,
                total_all_rounds: scheduledMatches.filter(m => m.game_id === g.id).length,
                total_rounds: allBrackets[g.id]?.rounds.length || 1,
                scheduled: scheduledMatches.filter(m => m.game_id === g.id).length,
                conflicts: scheduledMatches.filter(m => m.game_id === g.id && m.status === 'SCHEDULED_OVERLAP').length
            }))
        }
    };
}

// ================================================================
// Generate full bracket structure (all rounds) from Round 1 matches
// ================================================================
function generateFullBracket(r1Matches, gameId) {
    if (!r1Matches || r1Matches.length === 0) return { rounds: [] };

    r1Matches.forEach((m, idx) => { m._bracketIdx = `${gameId}_r1_${idx}`; });

    const rounds = [r1Matches];
    let currentRound = r1Matches;
    let roundNum = 2;

    while (currentRound.length > 1) {
        const nextRound = [];
        for (let i = 0; i < currentRound.length; i += 2) {
            const m1 = currentRound[i];
            const m2 = currentRound[i + 1];

            let aLabel = m1.isBye ? m1.a_label : `Winner of M${i + 1}`;
            let bLabel = !m2 ? 'BYE' : (m2.isBye ? m2.a_label : `Winner of M${i + 2}`);

            nextRound.push({
                _bracketIdx: `${gameId}_r${roundNum}_${nextRound.length}`,
                feederA_bracketIdx: m1._bracketIdx,
                feederB_bracketIdx: m2 ? m2._bracketIdx : null,
                a_label: aLabel,
                b_label: bLabel,
                isBye: !m2
            });
        }
        rounds.push(nextRound);
        currentRound = nextRound;
        roundNum++;
        if (roundNum > 10) break;
    }
    return { rounds };
}

// Round label helper
function getRoundLabel(roundIdx, totalRounds) {
    const fromEnd = totalRounds - roundIdx;
    if (fromEnd === 1) return 'Final';
    if (fromEnd === 2) return 'Semi Final';
    if (fromEnd === 3) return 'Quarter Final';
    if (fromEnd === 4) return 'Round of 16';
    return `Round ${roundIdx + 1}`;
}

// Track latest end time per game per round
function trackLatestEnd(map, gameId, roundNum, endTime) {
    if (!map[gameId]) map[gameId] = {};
    if (!map[gameId][roundNum] || endTime > map[gameId][roundNum]) {
        map[gameId][roundNum] = endTime;
    }
}

function getLatestEnd(map, gameId, roundNum) {
    return map[gameId]?.[roundNum] || null;
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

        // Map slot refs to actual IDs, strip internal fields
        const matchesToInsert = result.scheduledMatches.map(m => {
            const { _slot_ref, _playerIds, _bracketIdx, _feederA_bracketIdx, _feederB_bracketIdx, ...rest } = m;
            rest.slot_id = insertedSlots[_slot_ref]?.id || null;
            // Store bracketIdx temporarily for feeder resolution
            rest._bracketIdx = _bracketIdx;
            rest._feederA_bracketIdx = _feederA_bracketIdx || null;
            rest._feederB_bracketIdx = _feederB_bracketIdx || null;
            return rest;
        });

        // Insert matches (strip internal fields before DB insert)
        let insertedMatches = [];
        if (matchesToInsert.length > 0) {
            // Save bracket indices for post-insert resolution
            const bracketIdxMap = {};
            matchesToInsert.forEach((m, idx) => {
                bracketIdxMap[idx] = {
                    _bracketIdx: m._bracketIdx,
                    _feederA: m._feederA_bracketIdx,
                    _feederB: m._feederB_bracketIdx
                };
            });

            for (let i = 0; i < matchesToInsert.length; i += 50) {
                const batch = matchesToInsert.slice(i, i + 50).map(m => {
                    const { _bracketIdx, _feederA_bracketIdx, _feederB_bracketIdx, ...clean } = m;
                    return clean;
                });
                const { data: ins, error: insErr } = await supabase
                    .from('scheduled_matches')
                    .insert(batch)
                    .select();
                if (insErr) throw insErr;
                if (ins) insertedMatches = insertedMatches.concat(ins);
            }

            // Build bracketIdx → DB ID map for feeder resolution
            const bracketToDbId = {};
            insertedMatches.forEach((dbMatch, idx) => {
                const meta = bracketIdxMap[idx];
                if (meta && meta._bracketIdx) {
                    bracketToDbId[meta._bracketIdx] = dbMatch.id;
                }
            });

            // Update feeder references on Round 2+ matches
            for (let idx = 0; idx < insertedMatches.length; idx++) {
                const meta = bracketIdxMap[idx];
                if (!meta || (!meta._feederA && !meta._feederB)) continue;

                const feederAId = meta._feederA ? bracketToDbId[meta._feederA] : null;
                const feederBId = meta._feederB ? bracketToDbId[meta._feederB] : null;

                if (feederAId || feederBId) {
                    const updateData = {};
                    if (feederAId) updateData.feeder_match_a_id = feederAId;
                    if (feederBId) updateData.feeder_match_b_id = feederBId;

                    await supabase
                        .from('scheduled_matches')
                        .update(updateData)
                        .eq('id', insertedMatches[idx].id);

                    // Also update local reference for response
                    insertedMatches[idx].feeder_match_a_id = feederAId || null;
                    insertedMatches[idx].feeder_match_b_id = feederBId || null;
                }
            }

            console.log(`[scheduler] Inserted ${insertedMatches.length} matches across all rounds`);
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

        console.log('[updateMatchStatus] Received body:', JSON.stringify(req.body));

        const updateData = { updated_at: new Date().toISOString() };
        if (status) updateData.status = status;
        if (score_a !== undefined) updateData.score_a = score_a;
        if (score_b !== undefined) updateData.score_b = score_b;
        if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
        if (admin_hold_reason !== undefined) updateData.admin_hold_reason = admin_hold_reason;

        // Always set winner fields explicitly (set to value or null to clear)
        if (winner_label !== undefined) {
            updateData.winner_label = winner_label;
            updateData.winner_user_id = winner_user_id || null;
            updateData.winner_team_id = winner_team_id || null;
        }

        console.log('[updateMatchStatus] Update payload:', JSON.stringify(updateData));

        const { data, error } = await supabase
            .from('scheduled_matches')
            .update(updateData)
            .eq('id', matchId)
            .select()
            .single();

        if (error) {
            console.error('[updateMatchStatus] Supabase error:', error);
            throw error;
        }

        console.log('[updateMatchStatus] Saved match', matchId, '→ winner_label:', data?.winner_label, ', status:', data?.status);

        // Verify the winner_label was actually saved
        if (winner_label && data && data.winner_label !== winner_label) {
            console.warn('[updateMatchStatus] WARNING: winner_label mismatch! Sent:', winner_label, 'Got:', data?.winner_label);
        }

        // ── Winner Propagation to Next Round ──
        // If a winner was set, find the next-round match where this match
        // is a feeder and update its participant label
        if (data?.winner_label && status === 'PLAYED') {
            try {
                // Find next-round match where this match is feeder_match_a
                const { data: nextMatchA } = await supabase
                    .from('scheduled_matches')
                    .select('*')
                    .eq('feeder_match_a_id', matchId)
                    .single();

                if (nextMatchA) {
                    const propagateA = {
                        participant_a_label: data.winner_label,
                        participant_a_user_id: data.winner_user_id || null,
                        participant_a_team_id: data.winner_team_id || null,
                        updated_at: new Date().toISOString()
                    };

                    // If both participants are now known, activate the match
                    const bReady = nextMatchA.participant_b_label &&
                                   !nextMatchA.participant_b_label.startsWith('Winner of');
                    if (bReady && nextMatchA.status === 'PENDING') {
                        propagateA.status = 'SCHEDULED';
                    }

                    await supabase
                        .from('scheduled_matches')
                        .update(propagateA)
                        .eq('id', nextMatchA.id);

                    console.log(`[updateMatchStatus] Propagated winner "${data.winner_label}" → match ${nextMatchA.id} (participant A)`);
                }

                // Find next-round match where this match is feeder_match_b
                const { data: nextMatchB } = await supabase
                    .from('scheduled_matches')
                    .select('*')
                    .eq('feeder_match_b_id', matchId)
                    .single();

                if (nextMatchB) {
                    const propagateB = {
                        participant_b_label: data.winner_label,
                        participant_b_user_id: data.winner_user_id || null,
                        participant_b_team_id: data.winner_team_id || null,
                        updated_at: new Date().toISOString()
                    };

                    const aReady = nextMatchB.participant_a_label &&
                                   !nextMatchB.participant_a_label.startsWith('Winner of');
                    if (aReady && nextMatchB.status === 'PENDING') {
                        propagateB.status = 'SCHEDULED';
                    }

                    await supabase
                        .from('scheduled_matches')
                        .update(propagateB)
                        .eq('id', nextMatchB.id);

                    console.log(`[updateMatchStatus] Propagated winner "${data.winner_label}" → match ${nextMatchB.id} (participant B)`);
                }
            } catch (propErr) {
                // Non-fatal: log but don't fail the response
                console.error('[updateMatchStatus] Winner propagation error:', propErr.message);
            }
        }

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

        const allMatches = matches || [];
        if (allMatches.length === 0) {
            return res.json({ success: true, game, rounds: [], totalMatches: 0 });
        }

        // Fallback: if a match is PLAYED but winner_label is missing,
        // try to infer it from winner_user_id/winner_team_id
        allMatches.forEach(m => {
            if (m.status === 'PLAYED' && !m.winner_label) {
                if (m.winner_user_id) {
                    if (m.winner_user_id === m.participant_a_user_id) {
                        m.winner_label = m.participant_a_label;
                    } else if (m.winner_user_id === m.participant_b_user_id) {
                        m.winner_label = m.participant_b_label;
                    }
                } else if (m.winner_team_id) {
                    if (m.winner_team_id === m.participant_a_team_id) {
                        m.winner_label = m.participant_a_label;
                    } else if (m.winner_team_id === m.participant_b_team_id) {
                        m.winner_label = m.participant_b_label;
                    }
                }
            }
        });

        // Group matches by round_number
        const roundMap = {};
        allMatches.forEach((m, idx) => {
            const rn = m.round_number || 1;
            if (!roundMap[rn]) roundMap[rn] = [];
            roundMap[rn].push({
                ...m,
                match_number: idx + 1,
                _matchNum: idx + 1,
                _isBye: m.participant_b_label === 'BYE' || m.status === 'BYE_ADVANCE',
                _isPlaceholder: m.status === 'PENDING' && !m.participant_a_user_id && !m.participant_a_team_id
            });
        });

        // Build rounds array sorted by round number
        const roundNumbers = Object.keys(roundMap).map(Number).sort((a, b) => a - b);
        const totalRounds = roundNumbers.length;

        const rounds = roundNumbers.map((rn, idx) => {
            const roundMatches = roundMap[rn];
            // Use the round_label from DB if available, otherwise compute
            const label = roundMatches[0]?.round_label || getRoundLabel(idx, totalRounds);
            return { label, matches: roundMatches };
        });

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
