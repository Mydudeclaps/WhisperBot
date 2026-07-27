const { SlashCommandBuilder } = require("discord.js");
const db = require("../../database/database");
const { getCommandThumbnail } = require("../../utils/embedFactory");

module.exports = {

    data: new SlashCommandBuilder()

        .setName("leaderboard")

        .setDescription("View WhisperBot leaderboards")

        .addStringOption(option =>
            option
                .setName("category")
                .setDescription("Leaderboard category")
                .setRequired(true)
                .addChoices(
                    { name: "Messages", value: "messages_sent" },
                    { name: "Level", value: "level" },
                    { name: "Coins", value: "coins" },
                    { name: "XP", value: "xp" }
                )
        ),

    async execute(interaction) {

        await interaction.deferReply();

        const category =
            interaction.options.getString("category");

        let rows = [];

        if (
            category === "level" ||
            category === "coins" ||
            category === "xp"
        ) {

            rows = db.prepare(`
                SELECT username, ${category} AS value
                FROM users
                ORDER BY value DESC
                LIMIT 10
            `).all();

        } else {

            rows = db.prepare(`
                SELECT
                    users.username,
                    user_stats.stat_value AS value
                FROM user_stats
                JOIN users
                    ON users.id = user_stats.user_id
                WHERE stat_name = ?
                ORDER BY value DESC
                LIMIT 10
            `).all(category);

        }

        let description = "";

        rows.forEach((player, index) => {

            const medals = ["🥇", "🥈", "🥉"];

            const place =
                medals[index] || `#${index + 1}`;

            description +=
                `${place} **${player.username}** — ${player.value}\n`;

        });

        const thumb = getCommandThumbnail("leaderboard");

        await interaction.editReply({

            embeds: [

                {
                    color: 0x5865F2,

                    title: `🏆 ${category.replace("_", " ").toUpperCase()} Leaderboard`,

                    description,

                    thumbnail: thumb ? { url: `attachment://${thumb.name}` } : undefined

                }

            ],

            files: thumb ? [thumb] : []

        });

    }

};