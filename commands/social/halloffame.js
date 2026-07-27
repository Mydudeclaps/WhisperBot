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
        .setName("halloffame")
        .setDescription("🏛️ The permanent record of WhisperSMP's Legendary and Divine moments!"),

    async execute(interaction) {

        await interaction.deferReply();

        const events = SocialHistory.getHallOfFame(8);

        let description;

        if (!events.length) {

            description = "The Hall of Fame is empty so far — someone needs to pull off something Legendary or Divine!";

        } else {

            const lines = [];

            for (const event of events) {

                const tier = RarityEngine.getTierData(event.rarity);
                const outcome = event.story[event.story.length - 1];
                const snippet = outcome && outcome.text.length > 90
                    ? outcome.text.slice(0, 87) + "..."
                    : (outcome ? outcome.text : "");

                const username = await resolveUsername(interaction.client, event.user_id);
                const when = new Date(event.ended_at).toLocaleDateString();

                lines.push(
                    `${tier.emoji} **${tier.label}** — /${event.command} — ${when}\n` +
                    `*"${snippet}"*\n` +
                    `— ${username}`
                );

            }

            description = lines.join("\n━━━━━━━━━━━━━━━━━━━━\n");

        }

        const thumb = getCommandThumbnail("halloffame");

        const embed = new EmbedBuilder()
            .setTitle("🏛️ WhisperBot Hall of Fame")
            .setDescription(description)
            .setColor(0xFFD700)
            .setFooter({ text: "Every Legendary and Divine moment, forever • WhisperBot Social Engine" })
            .setTimestamp();

        if (thumb) embed.setThumbnail(`attachment://${thumb.name}`);

        await interaction.editReply({
            embeds: [embed],
            files: thumb ? [thumb] : []
        });

    }

};
