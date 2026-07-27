const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");

const {
    getStats,
    getLeaderboard
} = require("../../services/casinoStatsService");

const { getJackpot } = require("../../services/jackpotService");
const { getLuckyNumber } = require("../../services/luckyNumberService");
const { claimDailyBonus } = require("../../services/casinoDailyService");
const { getOwnedHorses } = require("../../services/horseService");
const { getAchievements } = require("../../services/achievementService");
const { getCoins } = require("../../services/coinService");
const { getUser } = require("../../services/userService");
const achievementData = require("../../data/achievements");

const {
    getCasinoXP,
    getCasinoRank,
    getNextCasinoRank,
    getRecentGames,
    getFavoriteGame
} = require("../../services/casinoService");

const {
    casinoMenuEmbed,
    casinoStatsEmbed,
    casinoLeaderboardEmbed,
    casinoRankEmbed,
    casinoPassportEmbed,
    casinoHistoryEmbed,
    casinoAchievementsEmbed
} = require("../../utils/embedFactory");


function menuButtons() {

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("casino_blackjack").setLabel("🃏 Blackjack").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("casino_dice").setLabel("🎲 Dice").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("casino_highlow").setLabel("🎯 High/Low").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("casino_poker").setLabel("♠️ Poker").setStyle(ButtonStyle.Primary)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("casino_horse").setLabel("🐎 Horse Racing").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("casino_slots").setLabel("🎰 Slots").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("casino_roulette").setLabel("🔴 Roulette").setStyle(ButtonStyle.Primary)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("casino_stats_btn").setLabel("📊 My Stats").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("casino_vip_btn").setLabel("🏆 Rank").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("casino_passport_btn").setLabel("💳 Passport").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("casino_history_btn").setLabel("📜 History").setStyle(ButtonStyle.Secondary)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("casino_achievements_btn").setLabel("🎖️ Achievements").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("casino_daily_btn").setLabel("🎁 Daily Bonus").setStyle(ButtonStyle.Success)
        )
    ];

}


// All CASINO_-prefixed entries from the shared achievement data — used
// by both /casino achievements and the passport's unlocked count.
function getCasinoAchievementDefs() {

    return Object.values(achievementData).filter(a => a.id.startsWith("CASINO_"));

}


module.exports = {

    menuButtons,

    data: new SlashCommandBuilder()
        .setName("casino")
        .setDescription("🎰 Whispers Casino — the main hub, stats, and more")

        .addSubcommand(sub =>
            sub
                .setName("menu")
                .setDescription("Open the Whispers Casino hub")
        )

        .addSubcommand(sub =>
            sub
                .setName("stats")
                .setDescription("View your (or another player's) casino stats")
                .addUserOption(option =>
                    option
                        .setName("player")
                        .setDescription("Player to look up (defaults to you)")
                        .setRequired(false)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("leaderboard")
                .setDescription("Top gamblers ranked by net profit")
        )

        .addSubcommand(sub =>
            sub
                .setName("vip")
                .setDescription("View your Casino Rank and XP progress")
        )

        .addSubcommand(sub =>
            sub
                .setName("passport")
                .setDescription("View your full Whispers Casino Passport")
                .addUserOption(option =>
                    option
                        .setName("player")
                        .setDescription("Player to look up (defaults to you)")
                        .setRequired(false)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("history")
                .setDescription("View your recent casino games")
        )

        .addSubcommand(sub =>
            sub
                .setName("achievements")
                .setDescription("View your casino achievements")
        )

        .addSubcommand(sub =>
            sub
                .setName("daily")
                .setDescription("Claim your casino daily bonus")
        ),

    async execute(interaction) {

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "leaderboard") return this.handleLeaderboard(interaction);
        if (subcommand === "vip") return this.handleVip(interaction);
        if (subcommand === "passport") return this.handlePassport(interaction);
        if (subcommand === "history") return this.handleHistory(interaction);
        if (subcommand === "achievements") return this.handleAchievements(interaction);
        if (subcommand === "daily") return this.handleDaily(interaction);
        if (subcommand === "stats") return this.handleStats(interaction);
        return this.handleMenu(interaction);

    },

    async handleMenu(interaction) {

        await interaction.deferReply();

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const balance = getCoins(userId);
        const jackpot = getJackpot();
        const luckyNumber = getLuckyNumber();

        const { embed, files } = casinoMenuEmbed(username, balance, jackpot, luckyNumber);

        return interaction.editReply({
            embeds: [embed],
            files,
            components: menuButtons()
        });

    },

    async handleStats(interaction) {

        await interaction.deferReply();

        const target = interaction.options.getUser("player") || interaction.user;
        const stats = getStats(target.id);

        const { embed, files } = casinoStatsEmbed(target.username, stats, target.displayAvatarURL());

        return interaction.editReply({ embeds: [embed], files });

    },

    async handleLeaderboard(interaction) {

        await interaction.deferReply();

        const rows = getLeaderboard(10);
        const { embed, files } = casinoLeaderboardEmbed(rows);

        return interaction.editReply({ embeds: [embed], files });

    },

    async handleVip(interaction) {

        await interaction.deferReply();

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const xp = getCasinoXP(userId);
        const rank = getCasinoRank(xp);
        const nextRank = getNextCasinoRank(xp);

        const { embed, files } = casinoRankEmbed(username, xp, rank, nextRank, interaction.user.displayAvatarURL());

        return interaction.editReply({ embeds: [embed], files });

    },

    async handlePassport(interaction) {

        await interaction.deferReply();

        const target = interaction.options.getUser("player") || interaction.user;

        const stats = getStats(target.id);
        const xp = getCasinoXP(target.id);
        const rank = getCasinoRank(xp);
        const ownedHorses = getOwnedHorses(target.id);
        const casinoAchievementCount = getAchievements(target.id)
            .filter(a => a.achievement.startsWith("CASINO_")).length;
        const favoriteGame = getFavoriteGame(stats);

        const { embed, files } = casinoPassportEmbed(
            target.username, stats, rank, ownedHorses, casinoAchievementCount, favoriteGame, target.displayAvatarURL()
        );

        return interaction.editReply({ embeds: [embed], files });

    },

    async handleHistory(interaction) {

        await interaction.deferReply();

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const games = getRecentGames(userId, 10);
        const { embed, files } = casinoHistoryEmbed(username, games);

        return interaction.editReply({ embeds: [embed], files });

    },

    async handleAchievements(interaction) {

        await interaction.deferReply();

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const allCasinoAchievements = getCasinoAchievementDefs();
        const unlockedIds = getAchievements(userId).map(a => a.achievement);

        const { embed, files } = casinoAchievementsEmbed(username, allCasinoAchievements, unlockedIds);

        return interaction.editReply({ embeds: [embed], files });

    },

    async handleDaily(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

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
                `(🔥 ${result.streak} day streak)\n💵 New balance: ${result.newBalance.toLocaleString()} coins.`
        });

    }

};
