const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const SocialHistory = require("../../social-engine/models/SocialHistory");
const RarityEngine = require("../../social-engine/engine/RarityEngine");
const { getCommandThumbnail } = require("../../utils/embedFactory");

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}


module.exports = {

    data: new SlashCommandBuilder()
        .setName("history")
        .setDescription("📜 View a user's recent Social Engine interactions!")
        .addUserOption(option =>
            option
                .setName("target")
                .setDescription("Whose history? (defaults to you)")
                .setRequired(false)
        ),

    async execute(interaction) {

        await interaction.deferReply();

        const target = interaction.options.getUser("target") || interaction.user;
        const events = SocialHistory.getRecentForUser(target.id, 10);

        let description;

        if (!events.length) {

            description = `${target.username} hasn't used any social commands yet — nothing to show!`;

        } else {

            description = events.map(event => {

                const tier = RarityEngine.getTierData(event.rarity);
                const outcome = event.story[event.story.length - 1];
                const snippet = outcome && outcome.text.length > 80
                    ? outcome.text.slice(0, 77) + "..."
                    : (outcome ? outcome.text : "");

                const when = new Date(event.ended_at).toLocaleDateString();

                return `${tier.emoji} **/${event.command}** — ${snippet}\n` +
                    `　　${tier.label} • ${when} • \`${event.event_id}\``;

            }).join("\n\n");

        }

        const thumb = getCommandThumbnail("history");

        const embed = new EmbedBuilder()
            .setTitle(`📜 ${target.username}'s Recent History`)
            .setDescription(description)
            .setColor(0x5865F2)
            .setFooter({ text: "Use /replay <id> to relive any of these • WhisperBot Social Engine" })
            .setTimestamp();

        if (thumb) embed.setThumbnail(`attachment://${thumb.name}`);

        await interaction.editReply({
            embeds: [embed],
            files: thumb ? [thumb] : []
        });

    }

};
