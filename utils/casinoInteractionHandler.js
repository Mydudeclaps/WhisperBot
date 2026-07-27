// Handles buttons rendered by the /casino menu hub (commands/casino/casino.js).
// Game buttons (blackjack/dice/highlow/poker/horse/slots/roulette) just
// point the player at the actual slash command — those games are full
// multi-step interactive flows (Hit/Stand, HIGH/LOW, horse picks, etc.)
// with their own awaitMessageComponent loops, so launching them from
// inside another component's collector would fight over the same
// message. Info buttons (stats/rank/passport/history/achievements/daily)
// render directly since they're simple read-only lookups (or, for daily,
// a single state change).
const { MessageFlags } = require("discord.js");

const { getStats } = require("../services/casinoStatsService");
const { claimDailyBonus } = require("../services/casinoDailyService");
const { getOwnedHorses } = require("../services/horseService");
const { getAchievements } = require("../services/achievementService");
const { getUser } = require("../services/userService");
const achievementData = require("../data/achievements");

const {
    getCasinoXP,
    getCasinoRank,
    getNextCasinoRank,
    getRecentGames,
    getFavoriteGame
} = require("../services/casinoService");

const {
    casinoStatsEmbed,
    casinoRankEmbed,
    casinoPassportEmbed,
    casinoHistoryEmbed,
    casinoAchievementsEmbed
} = require("../utils/embedFactory");

const GAME_COMMAND_REPLIES = {
    casino_blackjack: "🃏 Use `/blackjack` to sit down at the table — pick a bet amount, then play up to 5 hands!",
    casino_dice: "🎲 Use `/dice` to sit down at the arena — pick your guess and bet, then roll up to 5 times!",
    casino_highlow: "🎯 Use `/highlow` to sit down at the table — pick a bet amount, then play up to 5 rounds!",
    casino_poker: "♠️ Use `/poker` to sit down at the table — pick an ante, then play up to 5 hands!",
    casino_horse: "🐎 Use `/horse race` to sit down at the Derby — pick a horse and bet, then race up to 5 times!",
    casino_slots: "🎰 Use `/slots` to sit down and play — pick a machine and bet amount, then spin!",
    casino_roulette: "🔴 Use `/roulette` to sit down at the wheel — pick a bet type and amount, then spin up to 5 times!"
};

function getCasinoAchievementDefs() {
    return Object.values(achievementData).filter(a => a.id.startsWith("CASINO_"));
}

module.exports = async function handleCasinoButton(interaction) {

    const id = interaction.customId;

    if (GAME_COMMAND_REPLIES[id]) {

        return interaction.reply({
            content: GAME_COMMAND_REPLIES[id],
            flags: MessageFlags.Ephemeral
        });

    }

    const userId = interaction.user.id;
    const username = interaction.user.username;

    getUser(userId, username);

    if (id === "casino_stats_btn") {

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const stats = getStats(userId);
        const { embed, files } = casinoStatsEmbed(username, stats, interaction.user.displayAvatarURL());

        return interaction.editReply({ embeds: [embed], files });

    }

    if (id === "casino_vip_btn") {

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const xp = getCasinoXP(userId);
        const rank = getCasinoRank(xp);
        const nextRank = getNextCasinoRank(xp);

        const { embed, files } = casinoRankEmbed(username, xp, rank, nextRank, interaction.user.displayAvatarURL());

        return interaction.editReply({ embeds: [embed], files });

    }

    if (id === "casino_passport_btn") {

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const stats = getStats(userId);
        const xp = getCasinoXP(userId);
        const rank = getCasinoRank(xp);
        const ownedHorses = getOwnedHorses(userId);
        const casinoAchievementCount = getAchievements(userId)
            .filter(a => a.achievement.startsWith("CASINO_")).length;
        const favoriteGame = getFavoriteGame(stats);

        const { embed, files } = casinoPassportEmbed(
            username, stats, rank, ownedHorses, casinoAchievementCount, favoriteGame, interaction.user.displayAvatarURL()
        );

        return interaction.editReply({ embeds: [embed], files });

    }

    if (id === "casino_history_btn") {

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const games = getRecentGames(userId, 10);
        const { embed, files } = casinoHistoryEmbed(username, games);

        return interaction.editReply({ embeds: [embed], files });

    }

    if (id === "casino_achievements_btn") {

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const allCasinoAchievements = getCasinoAchievementDefs();
        const unlockedIds = getAchievements(userId).map(a => a.achievement);

        const { embed, files } = casinoAchievementsEmbed(username, allCasinoAchievements, unlockedIds);

        return interaction.editReply({ embeds: [embed], files });

    }

    if (id === "casino_daily_btn") {

        const result = claimDailyBonus(userId, username);

        if (!result.success) {

            const hours = Math.floor(result.msUntilNext / (60 * 60 * 1000));
            const minutes = Math.ceil((result.msUntilNext % (60 * 60 * 1000)) / (60 * 1000));

            return interaction.reply({
                content: `⏳ You've already claimed today's casino bonus. Come back in ${hours}h ${minutes}m.`,
                flags: MessageFlags.Ephemeral
            });

        }

        return interaction.reply({
            content: `🎁 You claimed your casino daily bonus: **${result.coins.toLocaleString()} coins**! ` +
                `(🔥 ${result.streak} day streak)\n💵 New balance: ${result.newBalance.toLocaleString()} coins.`,
            flags: MessageFlags.Ephemeral
        });

    }

    return interaction.reply({
        content: "❌ Unknown option.",
        flags: MessageFlags.Ephemeral
    });

};
