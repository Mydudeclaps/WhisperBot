// Numerology core: game lifecycle (start/stop/reset) and the actual
// count validator (attemptCount). Everything in attemptCount() runs
// fully synchronously (no awaits) — better-sqlite3 is synchronous, and
// Node never interleaves two synchronous call stacks, so as long as
// "read current state -> validate -> write new state" never yields to
// the event loop in between, two messages arriving milliseconds apart
// can't both be accepted as "correct" for the same expected number.
// This is the one place in this whole feature where a race condition
// would actually be visible to players (two people both getting a
// reaction for the same number), so it's worth being explicit about why
// the sync-only design matters here.
const db = require("../database/database");
const { computeNext, advanceState } = require("./numerologyRules");


function parseState(row) {
    try { return JSON.parse(row.formula_state || "{}"); }
    catch (e) { return {}; }
}


// Strict classic-mode validation: digits only, no leading zero (except
// the literal number 0), no letters/emoji/punctuation/spaces. Returns
// the parsed integer, or null if the raw content doesn't qualify at all
// (in which case the message is just ignored — not every message in a
// numerology channel is a counting attempt, e.g. "gg" or a reaction-only
// message shouldn't be treated as a failed count).
function parseAttempt(content) {

    const trimmed = content.trim();

    if (!/^(0|[1-9][0-9]*)$/.test(trimmed)) return null;

    const value = Number(trimmed);

    if (!Number.isSafeInteger(value)) return null;

    return value;

}


function getActiveGameByChannel(channelId) {

    return db.prepare(`
        SELECT * FROM numerology_games
        WHERE channel_id = ? AND status = 'active'
        ORDER BY id DESC LIMIT 1
    `).get(channelId);

}


function getGameById(gameId) {

    return db.prepare(`SELECT * FROM numerology_games WHERE id = ?`).get(gameId);

}


function startGame(guildId, channelId, mode, formula, startNumber = 0, goalNumber = null) {

    // Only one active game per channel at a time.
    const existing = getActiveGameByChannel(channelId);
    if (existing) return { error: "A game is already active in this channel." };

    const result = db.prepare(`
        INSERT INTO numerology_games (guild_id, channel_id, mode, formula, formula_state, current_number, goal_number, status, started_at)
        VALUES (?, ?, ?, ?, '{}', ?, ?, 'active', ?)
    `).run(guildId, channelId, mode, formula, startNumber, goalNumber, new Date().toISOString());

    return { game: getGameById(result.lastInsertRowid) };

}


function stopGame(channelId) {

    const game = getActiveGameByChannel(channelId);
    if (!game) return { error: "No active game in this channel." };

    db.prepare(`UPDATE numerology_games SET status = 'stopped', completed_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), game.id);

    return { game: getGameById(game.id) };

}


function resetGame(channelId, startNumber = 0, goalNumber = null) {

    const game = getActiveGameByChannel(channelId);
    if (!game) return { error: "No active game in this channel." };

    db.prepare(`
        UPDATE numerology_games
        SET current_number = ?, goal_number = ?, formula_state = '{}', total_contributions = 0, highest_count = 0
        WHERE id = ?
    `).run(startNumber, goalNumber, game.id);

    return { game: getGameById(game.id) };

}


function ensureStatsRow(userId) {

    db.prepare(`INSERT OR IGNORE INTO numerology_stats (user_id) VALUES (?)`).run(userId);

}


// The core validator. `rawContent` is the raw message text. Returns one
// of:
//   { type: "ignored" }                          — not a counting attempt at all (not a plain number)
//   { type: "correct", game, newNumber, streak, totalCorrect, milestone, isFirstEver }
//   { type: "incorrect", game, expected, given, streak (reset to 0) }
//   { type: "no_game" }
function attemptCount(guildId, channelId, userId, username, rawContent) {

    const game = getActiveGameByChannel(channelId);
    if (!game) return { type: "no_game" };

    const given = parseAttempt(rawContent);
    if (given === null) return { type: "ignored" };

    ensureStatsRow(userId);

    const state = parseState(game);
    const expected = computeNext(game.formula, game.current_number, state);

    const now = new Date().toISOString();

    if (given === expected) {

        const newState = advanceState(game.formula, game.current_number, expected, state);

        db.prepare(`
            UPDATE numerology_games
            SET current_number = ?, formula_state = ?, total_contributions = total_contributions + 1,
                highest_count = CASE WHEN ? > highest_count THEN ? ELSE highest_count END
            WHERE id = ?
        `).run(expected, JSON.stringify(newState), expected, expected, game.id);

        db.prepare(`
            INSERT INTO numerology_contributions (game_id, user_id, number, is_correct, attempt_time)
            VALUES (?, ?, ?, 1, ?)
        `).run(game.id, userId, expected, now);

        const statsBefore = db.prepare(`SELECT * FROM numerology_stats WHERE user_id = ?`).get(userId);
        const isFirstEver = statsBefore.total_correct === 0;
        const newStreak = statsBefore.current_streak + 1;
        const newLongest = Math.max(statsBefore.longest_streak, newStreak);
        const newHighest = Math.max(statsBefore.highest_count_achieved, expected);

        db.prepare(`
            UPDATE numerology_stats
            SET total_correct = total_correct + 1, current_streak = ?, longest_streak = ?,
                highest_count_achieved = ?, last_contribution = ?
            WHERE user_id = ?
        `).run(newStreak, newLongest, newHighest, now, userId);

        return {
            type: "correct",
            game: getGameById(game.id),
            previousNumber: game.current_number,
            newNumber: expected,
            streak: newStreak,
            isFirstEver,
            username
        };

    }

    db.prepare(`
        INSERT INTO numerology_contributions (game_id, user_id, number, is_correct, attempt_time)
        VALUES (?, ?, ?, 0, ?)
    `).run(game.id, userId, given, now);

    db.prepare(`
        UPDATE numerology_stats
        SET total_incorrect = total_incorrect + 1, current_streak = 0, last_contribution = ?
        WHERE user_id = ?
    `).run(now, userId);

    db.prepare(`INSERT INTO numerology_mistakes (user_id, occurred_at) VALUES (?, ?)`).run(userId, Date.now());

    return {
        type: "incorrect",
        game,
        expected,
        given,
        username
    };

}


module.exports = {
    parseAttempt,
    getActiveGameByChannel,
    getGameById,
    startGame,
    stopGame,
    resetGame,
    attemptCount
};
