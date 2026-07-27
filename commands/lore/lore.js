const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const loreService = require('../../services/loreService');
const {
    CATEGORIES,
    ARCHIVE_COLOR,
    PENDING_COLOR,
    formatDate,
    categoryLabel,
    sanitizeForEmbed,
    buildLoreEmbed
} = require('../../utils/loreUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lore')
        .setDescription('📜 Submit or browse the Whisper Archives')
        .addSubcommand(subcommand =>
            subcommand
                .setName('submit')
                .setDescription('Add a page to the archives')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('Your lore entry')
                        .setRequired(true)
                        .setMaxLength(2000)
                )
                .addStringOption(option =>
                    option.setName('category')
                        .setDescription('Category of your lore')
                        .setRequired(false)
                        .addChoices(
                            ...Object.entries(CATEGORIES).map(([key, value]) => ({
                                name: value,
                                value: key
                            }))
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('random')
                .setDescription('Discover a random page from the archives')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('latest')
                .setDescription('Browse the most recent entries')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('oldest')
                .setDescription('Explore the earliest entries')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('search')
                .setDescription('Search the archives')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('What to search for')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View archive statistics')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('hall')
                .setDescription('The Hall of Legends — greatest stories ever told')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('approve')
                .setDescription('[Mod] Review pending lore entries')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'submit':
                return this.handleSubmit(interaction);
            case 'random':
                return this.handleRandom(interaction);
            case 'latest':
                return this.handleLatest(interaction);
            case 'oldest':
                return this.handleOldest(interaction);
            case 'search':
                return this.handleSearch(interaction);
            case 'stats':
                return this.handleStats(interaction);
            case 'hall':
                return this.handleHall(interaction);
            case 'approve':
                return this.handleApprove(interaction);
        }
    },

    async handleSubmit(interaction) {
        await interaction.deferReply({ flags: 64 }); // ephemeral — submitter sees status, no one else

        const text = interaction.options.getString('text');
        const category = interaction.options.getString('category') || 'history';

        const entry = await loreService.submitEntry(
            interaction.guildId,
            interaction.user.id,
            text,
            category
        );

        const safeText = sanitizeForEmbed(text);
        const embed = new EmbedBuilder()
            .setTitle('📜 Page Added to the Archives')
            .setDescription(
                `"${safeText.length > 200 ? safeText.slice(0, 200) + '...' : safeText}"\n\n` +
                `📖 Archive Entry #${entry.archive_number}\n` +
                `🗂️ Category: ${categoryLabel(category)}\n\n` +
                `*This page is awaiting approval before being published.*`
            )
            .setColor(ARCHIVE_COLOR)
            .setFooter({ text: 'The Archives remember...' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleRandom(interaction) {
        await interaction.deferReply();

        const entry = await loreService.getRandom(interaction.guildId);
        if (!entry) {
            return interaction.editReply({
                content: '📜 The archives are empty. Be the first to write history with `/lore submit`!'
            });
        }

        await interaction.editReply({ embeds: [buildLoreEmbed(entry)] });
    },

    async handleLatest(interaction) {
        await interaction.deferReply();

        const entries = await loreService.getLatest(interaction.guildId, 10);
        if (!entries.length) {
            return interaction.editReply({
                content: '📜 No entries found. Submit one with `/lore submit`!'
            });
        }

        const description = entries.map(e =>
            `**#${e.archive_number}** — ${sanitizeForEmbed(e.text).slice(0, 100)}${e.text.length > 100 ? '...' : ''}\n` +
            `🗂️ ${categoryLabel(e.category)} • ${formatDate(e.submitted_at)}`
        ).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle('📜 Latest Archives')
            .setDescription(description.slice(0, 4000))
            .setColor(ARCHIVE_COLOR)
            .setFooter({ text: 'The Archives remember...' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleOldest(interaction) {
        await interaction.deferReply();

        const entries = await loreService.getOldest(interaction.guildId, 10);
        if (!entries.length) {
            return interaction.editReply({
                content: '📜 No entries found. Submit one with `/lore submit`!'
            });
        }

        const description = entries.map(e =>
            `**#${e.archive_number}** — ${sanitizeForEmbed(e.text).slice(0, 100)}${e.text.length > 100 ? '...' : ''}\n` +
            `🗂️ ${categoryLabel(e.category)} • ${formatDate(e.submitted_at)}`
        ).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle('📜 Earliest Archives')
            .setDescription(description.slice(0, 4000))
            .setColor(ARCHIVE_COLOR)
            .setFooter({ text: 'Where it all began...' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleSearch(interaction) {
        await interaction.deferReply();

        const query = interaction.options.getString('query');
        const entries = await loreService.search(interaction.guildId, query);

        if (!entries.length) {
            return interaction.editReply({
                content: `🔍 No entries found matching "${sanitizeForEmbed(query)}".`
            });
        }

        const description = entries.map(e =>
            `**#${e.archive_number}** — ${sanitizeForEmbed(e.text).slice(0, 150)}${e.text.length > 150 ? '...' : ''}\n` +
            `🗂️ ${categoryLabel(e.category)}`
        ).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle(`🔍 Search Results: "${sanitizeForEmbed(query).slice(0, 100)}"`)
            .setDescription(description.slice(0, 4000))
            .setColor(ARCHIVE_COLOR)
            .setFooter({ text: `Found ${entries.length} entries` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleStats(interaction) {
        await interaction.deferReply();

        const stats = await loreService.getStats(interaction.guildId);

        const categoryList = stats.categories.length
            ? stats.categories.map(c => `${categoryLabel(c.name)}: ${c.count}`).join('\n')
            : 'No entries yet';

        const embed = new EmbedBuilder()
            .setTitle('📚 The Whisper Archives')
            .setDescription('Statistics of the living history of your server')
            .addFields(
                { name: '📖 Total Entries', value: `${stats.total}`, inline: true },
                { name: '🗂️ Categories', value: `${stats.categories.length}`, inline: true },
                { name: '📅 Oldest Entry', value: stats.oldest ? formatDate(stats.oldest) : 'None', inline: false },
                { name: '📅 Newest Entry', value: stats.newest ? formatDate(stats.newest) : 'None', inline: false },
                { name: '📂 Category Breakdown', value: categoryList.slice(0, 1024), inline: false }
            )
            .setColor(ARCHIVE_COLOR)
            .setFooter({ text: 'The Archives remember...' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async handleHall(interaction) {
        await interaction.deferReply();

        const entries = await loreService.getHallOfLegends(interaction.guildId);
        if (!entries.length) {
            return interaction.editReply({
                content: '🏆 The Hall of Legends is empty. Write history with `/lore submit`!'
            });
        }

        const description = entries.slice(0, 20).map((e, i) =>
            `**#${i + 1}** — Archive #${e.archive_number}\n` +
            `"${sanitizeForEmbed(e.text).slice(0, 150)}${e.text.length > 150 ? '...' : ''}"\n` +
            `📖 ${e.readings} reads • 🗂️ ${categoryLabel(e.category)}`
        ).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle('🏆 Hall of Legends')
            .setDescription('The greatest stories ever told...')
            .addFields({ name: 'Legends', value: description.slice(0, 4000) })
            .setColor(0xFFD700)
            .setFooter({ text: 'Only the most read entries live forever.' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    // Mod-only: shows each pending entry with Approve / Reject buttons.
    // Button clicks are handled in schedulers/../loreInteractionHandler.js
    // (registered on the client's interactionCreate event).
    async handleApprove(interaction) {
        if (!interaction.member.permissions.has('ManageMessages')) {
            return interaction.reply({
                content: '❌ Only moderators can approve lore entries.',
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 });

        const pending = await loreService.getPending(interaction.guildId);
        if (!pending.length) {
            return interaction.editReply({
                content: '📜 No pending entries awaiting approval.'
            });
        }

        // Send one message per pending entry (max 5, to stay well under
        // rate limits / message caps) with its own approve/reject buttons.
        const batch = pending.slice(0, 5);

        for (const entry of batch) {
            const embed = new EmbedBuilder()
                .setTitle(`📜 Pending — Archive #${entry.archive_number}`)
                .setDescription(
                    `${sanitizeForEmbed(entry.text).slice(0, 1000)}\n\n` +
                    `🗂️ ${categoryLabel(entry.category)} • Submitted ${formatDate(entry.submitted_at)}`
                )
                .setColor(PENDING_COLOR);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`lore_approve:${entry.id}`)
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`lore_reject:${entry.id}`)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.followUp({ embeds: [embed], components: [row], flags: 64 });
        }

        if (pending.length > batch.length) {
            await interaction.followUp({
                content: `...and ${pending.length - batch.length} more pending. Run \`/lore approve\` again after clearing these.`,
                flags: 64
            });
        }
    }
};
