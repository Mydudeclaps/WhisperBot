// Randomly announces big casino wins to the server (not every win — see
// CASINO_ANNOUNCER config). Call maybeAnnounceWin() after any casino game
// resolves; it no-ops silently unless the win clears the threshold, wins
// the random roll, and the per-guild cooldown has passed.
const { ChannelType, PermissionsBitField } = require("discord.js");
const { CASINO_ANNOUNCER } = require("../config/gameConfig");
const { casinoAnnouncementEmbed } = require("../utils/embedFactory");

// Per-guild cooldown so a lucky streak doesn't spam the channel with
// back-to-back announcements. Resets on bot restart — acceptable, same
// tradeoff cooldownService.js already makes for other in-memory limits.
const COOLDOWN_MS = 3 * 60 * 1000;
const lastAnnouncedAt = new Map();

function findAnnounceChannel(guild) {

    const me = guild.members.me;
    if (!me) return null;

    const canPost = (channel) =>
        channel?.type === ChannelType.GuildText &&
        channel.permissionsFor(me)?.has([
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
        ]);

    if (canPost(guild.systemChannel)) return guild.systemChannel;

    return guild.channels.cache.find(canPost) || null;

}

// payload: { game, username, netWin, jackpot (bool, optional) }
async function maybeAnnounceWin(interaction, payload) {

    try {

        if (!interaction.guild) return;

        if (payload.netWin < CASINO_ANNOUNCER.MIN_WIN_TO_ANNOUNCE) return;

        if (!payload.jackpot && Math.random() > CASINO_ANNOUNCER.ANNOUNCE_CHANCE) return;

        const guildId = interaction.guild.id;
        const last = lastAnnouncedAt.get(guildId) || 0;

        if (!payload.jackpot && Date.now() - last < COOLDOWN_MS) return;

        const channel = findAnnounceChannel(interaction.guild);
        if (!channel) return;

        lastAnnouncedAt.set(guildId, Date.now());

        const { embed, files } = casinoAnnouncementEmbed(payload);

        await channel.send({ embeds: [embed], files });

    } catch (error) {

        console.error("[CasinoAnnouncer] Failed to send announcement:", error.message);

    }

}

module.exports = {
    maybeAnnounceWin
};
