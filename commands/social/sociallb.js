const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const { getLeaderboard } = require("../../social-engine/models/SocialLeaderboard");
const { getCommandThumbnail } = require("../../utils/embedFactory");

const CATEGORY_CHOICES = [
    { name: "Overall Interactions", value: "overall" },
    { name: "Highest Combo", value: "combos" },
    { name: "Divine Outcomes", value: "divine" },
    { name: "Legendary Outcomes", value: "legendary" },
    { name: "NPC Encounters", value: "npc" },
    { name: "Plot Twists Witnessed", value: "plottwists" },
    { name: "Most Hugs", value: "hug" },
    { name: "Most Slaps", value: "slap" },
    { name: "Most Fights", value: "fight" },
    { name: "Most Yeets", value: "yeet" }
];

const LABELS = {
    overall: "🏆 Overall Interactions",
    combos: "💫 Highest Combo",
    divine: "☀️ Divine Outcomes",
    legendary: "🔮 Legendary Outcomes",
    npc: "👤 NPC Encounters",
    plottwists: "🌟 Plot Twists Witnessed",
    hug: "🤗 Most Hugs",
    slap: "👋 Most Slaps",
    fight: "⚔️ Most Fights",
    yeet: "🚀 Most Yeets"
};

const MEDALS = ["🥇", "🥈", "🥉"];


module.exports = {

    data: new SlashCommandBuilder()
        .setName("sociallb")
        .setDescription("🏆 View the Social Engine leaderboards!")
        .addStringOption(option =>
            option
                .setName("category")
                .setDescription("Which leaderboard? (defaults to Overall)")
                .setRequired(false)
                .addChoices(...CATEGORY_CHOICES)
        ),

    async execute(interaction) {

        await interaction.deferReply();

        const category = interaction.options.getString("category") || "overall";
        const rows = getLeaderboard(category, 10);

        let description;

        if (!rows.length) {

            description = "No data yet for this leaderboard — go make some history!";

        } else {

            const lines = [];

            for (let i = 0; i < rows.length; i++) {

                const row = rows[i];
                let username = row.user_id;

                try {

                    const user = await interaction.client.users.fetch(row.user_id);
                    username = user.username;

                } catch (err) {

                    // User may have left the server — fall back to the
                    // raw ID rather than failing the whole leaderboard.

                }

                const place = MEDALS[i] || `#${i + 1}`;

                lines.push(`${place} **${username}** — ${row.value.toLocaleString()}`);

            }

            description = lines.join("\n");

        }

        const thumb = getCommandThumbnail("sociallb");

        const embed = new EmbedBuilder()
            .setTitle(LABELS[category] || "🏆 Social Leaderboard")
            .setDescription(description)
            .setColor(0xFFD700)
            .setFooter({ text: "WhisperBot Social Engine" })
            .setTimestamp();

        if (thumb) embed.setThumbnail(`attachment://${thumb.name}`);

        await interaction.editReply({
            embeds: [embed],
            files: thumb ? [thumb] : []
        });

    }

};
