const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");

const SocialHistory = require("../../social-engine/models/SocialHistory");
const RarityEngine = require("../../social-engine/engine/RarityEngine");
const { getCommandThumbnail } = require("../../utils/embedFactory");


module.exports = {

    data: new SlashCommandBuilder()
        .setName("replay")
        .setDescription("🎬 Relive a past Social Engine moment by its event ID!")
        .addStringOption(option =>
            option
                .setName("event_id")
                .setDescription("The event ID (shown in /history or /halloffame)")
                .setRequired(true)
        ),

    async execute(interaction) {

        const eventId = interaction.options.getString("event_id").trim();
        const event = SocialHistory.getEvent(eventId);

        if (!event) {

            return interaction.reply({
                content: `❌ No event found with ID \`${eventId}\`. Double-check it against \`/history\` or \`/halloffame\`.`,
                flags: MessageFlags.Ephemeral
            });

        }

        await interaction.deferReply();

        let userName = event.user_id;
        let targetName = null;

        try {

            const user = await interaction.client.users.fetch(event.user_id);
            userName = user.username;

        } catch (err) {

            // User may have left the server — fall back to the raw ID.

        }

        if (event.target_id) {

            try {

                const target = await interaction.client.users.fetch(event.target_id);
                targetName = target.username;

            } catch (err) {

                targetName = event.target_id;

            }

        }

        const tier = RarityEngine.getTierData(event.rarity);

        const storyText = event.story
            .map(stage => stage.text)
            .join("\n\n");

        const thumb = getCommandThumbnail(event.command);

        const embed = new EmbedBuilder()
            .setTitle(`🎬 Replay: /${event.command}`)
            .setDescription(storyText)
            .addFields({
                name: "🎲 Rarity",
                value: `${tier.stars} ${tier.label}`,
                inline: true
            })
            .setColor(tier.color)
            .setFooter({ text: `${new Date(event.ended_at).toLocaleString()} • WhisperBot Social Engine` })
            .setTimestamp(new Date(event.ended_at));

        if (thumb) embed.setThumbnail(`attachment://${thumb.name}`);

        embed.addFields({
            name: "👤 Participants",
            value: targetName ? `${userName} → ${targetName}` : userName,
            inline: true
        });

        if (event.combo > 1) {

            embed.addFields({
                name: "💫 Combo",
                value: `x${event.combo}`,
                inline: true
            });

        }

        if (event.npc_interrupted) {

            embed.addFields({
                name: "NPC Interruption",
                value: event.npc_name || "Unknown",
                inline: true
            });

        }

        if (event.plot_twist_occurred) {

            embed.addFields({
                name: "🌟 Plot Twist",
                value: "This moment had a plot twist!",
                inline: true
            });

        }

        await interaction.editReply({
            embeds: [embed],
            files: thumb ? [thumb] : []
        });

    }

};
