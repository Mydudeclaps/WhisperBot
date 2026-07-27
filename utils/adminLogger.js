const { EmbedBuilder } = require("discord.js");

const { ADMIN_LOG_CHANNEL_ID } = require("../config/adminConfig");


// Logs a single admin action to the configured log channel.
// target can be a User/GuildMember, a plain string (e.g. "server-wide"),
// or omitted entirely for actions with no single target.
async function logAdminAction(interaction, action, target, details) {

    if (!ADMIN_LOG_CHANNEL_ID) return;

    try {

        const channel = await interaction.client.channels
            .fetch(ADMIN_LOG_CHANNEL_ID)
            .catch(() => null);

        if (!channel) return;

        const targetText = typeof target === "string"
            ? target
            : target
                ? `${target} (${target.id ?? "unknown id"})`
                : "—";

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🛡️ Admin Action: ${action}`)
            .addFields(
                { name: "Admin", value: `${interaction.user} (${interaction.user.id})`, inline: false },
                { name: "Target", value: targetText, inline: false },
                { name: "Details", value: details || "—", inline: false }
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });

    } catch (error) {

        // Never let a logging failure break the admin command itself.
        console.error("adminLogger: failed to log admin action:", error);

    }

}


// Same as logAdminAction, but takes a data object instead of a details
// string and renders each key/value pair as its own embed field. Useful
// for actions with several before/after values (e.g. shop price changes).
async function logAdminActionWithData(interaction, action, target, data = {}) {

    if (!ADMIN_LOG_CHANNEL_ID) return;

    try {

        const channel = await interaction.client.channels
            .fetch(ADMIN_LOG_CHANNEL_ID)
            .catch(() => null);

        if (!channel) return;

        const targetText = typeof target === "string"
            ? target
            : target
                ? `${target} (${target.id ?? "unknown id"})`
                : "—";

        const dataFields = Object.entries(data).map(([key, value]) => ({
            name: key,
            value: String(value ?? "—"),
            inline: true
        }));

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🛡️ Admin Action: ${action}`)
            .addFields(
                { name: "Admin", value: `${interaction.user} (${interaction.user.id})`, inline: false },
                { name: "Target", value: targetText, inline: false },
                ...dataFields
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });

    } catch (error) {

        console.error("adminLogger: failed to log admin action:", error);

    }

}


module.exports = {

    logAdminAction,

    logAdminActionWithData

};
