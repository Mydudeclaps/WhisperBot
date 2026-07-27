const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const SocialHistory = require("../../social-engine/models/SocialHistory");
const RarityEngine = require("../../social-engine/engine/RarityEngine");
const { getCommandThumbnail } = require("../../utils/embedFactory");


async function resolveUsername(client, userId) {

    try {

        const user = await client.users.fetch(userId);
        return user.username;

    } catch (err) {

        return userId;

    }

}


module.exports = {

    data: new SlashCommandBuilder()
        .setName("topmoments")
        .setDescription("🎲 A random sample of the server's funniest and rarest moments!"),

    async execute(interaction) {

        await interaction.deferReply();

        const events = SocialHistory.getTopMoments(5);

        let description;

        if (!events.length) {

            description = "No standout moments yet — nothing Epic, Legendary, or Divine has happened so far. Get out there!";

        } else {

            const lines = [];

            for (const event of events) {

                const tier = RarityEngine.getTierData(event.rarity);
                const outcome = event.story[event.story.length - 1];
                const snippet = outcome && outcome.text.length > 90
                    ? outcome.text.slice(0, 87) + "..."
                    : (outcome ? outcome.text : "");

                const username = await resolveUsername(interaction.client, event.user_id);

                lines.push(
                    `${tier.emoji} **${tier.label}** — /${event.command}\n` +
                    `*"${snippet}"*\n` +
                    `— ${username} • \`${event.event_id}\``
                );

            }

            description = lines.join("\n━━━━━━━━━━━━━━━━━━━━\n");

        }

        const thumb = getCommandThumbnail("topmoments");

        const embed = new EmbedBuilder()
            .setTitle("🎲 Top Moments")
            .setDescription(description)
            .setColor(0x9B59B6)
            .setFooter({ text: "Run again for a different set • WhisperBot Social Engine" })
            .setTimestamp();

        if (thumb) embed.setThumbnail(`attachment://${thumb.name}`);

        await interaction.editReply({
            embeds: [embed],
            files: thumb ? [thumb] : []
        });

    }

};
