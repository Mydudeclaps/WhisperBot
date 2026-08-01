const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const loreService = require('../services/loreService');
const { formatDate, categoryLabel } = require('../utils/loreUtils');
const { announceLoreEntry } = require('../utils/notificationRouter');

// Chance that a given scheduled broadcast is flagged "legendary" (rare, gilded variant)
const LEGENDARY_CHANCE = 0.02;

class LoreBroadcast {
    constructor(client) {
        this.client = client;
        this.start();
    }

    start() {
        // 9:00 AM and 9:00 PM daily, server-local time of wherever the process runs.
        // If you want a fixed timezone regardless of host, pass { timezone: 'America/New_York' } etc.
        cron.schedule('0 9,21 * * *', () => {
            this.broadcastToAllGuilds();
        });
    }

    async broadcastToAllGuilds() {
        const guilds = this.client.guilds.cache;

        for (const [guildId] of guilds) {
            try {
                await this.broadcastToGuild(guildId);
            } catch (error) {
                console.error(`[LoreBroadcast] Error for guild ${guildId}:`, error.message);
            }
        }
    }

    async broadcastToGuild(guildId) {
        const entry = await loreService.getRandom(guildId);
        if (!entry) return;

        const isLegendary = Math.random() < LEGENDARY_CHANCE;
        if (isLegendary) {
            await loreService.markLegendary(entry.id);
        }
        await loreService.broadcastEntry(entry.id);

        const embed = this.buildBroadcastEmbed(entry, isLegendary);
        await announceLoreEntry(this.client, embed);
    }

    buildBroadcastEmbed(entry, isLegendary) {
        const titles = [
            '📻 Whisper Radio',
            '📻 A Page From The Archives',
            '📻 The Archives Speak',
            '📻 A Forgotten Chronicle'
        ];

        const endings = [
            'The Archives remember...',
            'History unfolds...',
            'The past lives on...',
            'Some stories never die...'
        ];

        const title = isLegendary
            ? '✨ A Forgotten Page Has Surfaced...'
            : titles[Math.floor(Math.random() * titles.length)];

        const ending = isLegendary
            ? 'Some stories are not meant to be forgotten.'
            : endings[Math.floor(Math.random() * endings.length)];

        const intro = isLegendary
            ? '*"Recovered from the depths of the archives..."*'
            : '*"A page has been recovered..."*';

        const safeText = entry.text.replace(/```/g, '\u200b`\u200b`\u200b`').slice(0, 1500);

        return new EmbedBuilder()
            .setTitle(title)
            .setDescription(
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `${intro}\n\n` +
                `> ${safeText}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📖 Archive Entry #${entry.archive_number}\n` +
                `🗂️ Category: ${categoryLabel(entry.category)}\n` +
                `🕰️ Archived ${formatDate(entry.submitted_at)}\n\n` +
                `*"${ending}"*`
            )
            .setColor(isLegendary ? 0xFFD700 : 0x2C2F33)
            .setFooter({ text: 'WhisperBot • The Archives' })
            .setTimestamp();
    }
}

module.exports = LoreBroadcast;
