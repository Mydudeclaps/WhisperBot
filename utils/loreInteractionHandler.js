// Handles the Approve/Reject buttons rendered by /lore approve.
// Wire this up in your main bot file's interactionCreate listener, e.g.:
//
//   const handleLoreButton = require('./utils/loreInteractionHandler');
//   client.on('interactionCreate', async (interaction) => {
//       if (interaction.isButton() && interaction.customId.startsWith('lore_')) {
//           return handleLoreButton(interaction);
//       }
//       // ...your existing command routing
//   });

const loreService = require('../services/loreService');

module.exports = async function handleLoreButton(interaction) {
    const [action, entryIdRaw] = interaction.customId.split(':');
    const entryId = Number(entryIdRaw); // SQLite lore.id is an INTEGER primary key

    if (!interaction.member.permissions.has('ManageMessages')) {
        return interaction.reply({
            content: '❌ Only moderators can do that.',
            flags: 64
        });
    }

    if (action === 'lore_approve') {
        const entry = await loreService.approveEntry(entryId);
        if (!entry) {
            return interaction.update({ content: '⚠️ Entry not found (already handled?).', embeds: [], components: [] });
        }
        return interaction.update({
            content: `✅ Archive #${entry.archive_number} approved and published.`,
            embeds: [],
            components: []
        });
    }

    if (action === 'lore_reject') {
        const entry = await loreService.deleteEntry(entryId);
        if (!entry) {
            return interaction.update({ content: '⚠️ Entry not found (already handled?).', embeds: [], components: [] });
        }
        return interaction.update({
            content: `🗑️ Archive #${entry.archive_number} rejected.`,
            embeds: [],
            components: []
        });
    }
};
