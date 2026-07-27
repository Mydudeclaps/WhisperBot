// Simple in-memory cooldown tracker, keyed per user+command.
// Cooldowns reset when the bot restarts — that's fine for something
// like /fish where the stakes of losing a cooldown are low.
const cooldowns = new Map();


function checkCooldown(userId, command, seconds) {

    const key = `${userId}_${command}`;
    const now = Date.now();
    const expiresAt = cooldowns.get(key);

    if (expiresAt && now < expiresAt) {

        const remaining = Math.ceil((expiresAt - now) / 1000);
        return { allowed: false, remaining };

    }

    cooldowns.set(key, now + (seconds * 1000));

    return { allowed: true };

}


function clearCooldown(userId, command) {

    cooldowns.delete(`${userId}_${command}`);

}


// Cross-game anti-spam limiter: caps total casino bets (dice, blackjack,
// high/low, etc. combined) within a rolling time window, independent of
// each game's own per-game cooldown. Call this once per actual bet placed
// — not on rejected attempts — so it only counts real plays.
const betTimestamps = new Map();

function checkBetRateLimit(userId, maxBets, windowSeconds) {

    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    const timestamps = (betTimestamps.get(userId) || [])
        .filter(ts => now - ts < windowMs);

    if (timestamps.length >= maxBets) {

        const oldest = timestamps[0];
        const remaining = Math.ceil((windowMs - (now - oldest)) / 1000);

        betTimestamps.set(userId, timestamps);

        return { allowed: false, remaining };

    }

    timestamps.push(now);
    betTimestamps.set(userId, timestamps);

    return { allowed: true };

}


module.exports = {

    checkCooldown,

    clearCooldown,

    checkBetRateLimit

};
