const {
    SlashCommandBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");

const { isBotAdmin } = require("../../services/adminService");

const {
    createSession,
    getSession,
    endSession,
    defaultDraft
} = require("../../services/embedBuilder/sessionService");

const {
    listTemplates,
    getTemplate,
    saveTemplate,
    deleteTemplate,
    renameTemplate,
    duplicateTemplate
} = require("../../services/embedBuilder/templateService");

const {
    buildDraftEmbed,
    buildPreviewPanelEmbed
} = require("../../utils/embedBuilder/preview");

const { validateDraft } = require("../../utils/embedBuilder/validation");

const {
    mainPanelComponents,
    fieldsPanelComponents,
    templatesPanelComponents,
    channelPickerComponents
} = require("../../utils/embedBuilder/components");

const {
    infoModal,
    styleModal,
    authorModal,
    imagesModal,
    footerModal,
    fieldModal,
    templateNameModal
} = require("../../utils/embedBuilder/modals");


const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes idle
const MODAL_TIMEOUT = 5 * 60 * 1000;    // 5 minutes to fill out a modal


module.exports = {

    data: new SlashCommandBuilder()
        .setName("embedbuilder")
        .setDescription("Create and send a custom embed (staff only)")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        if (!interaction.guild) {

            return interaction.reply({
                content: "❌ This command can only be used in a server.",
                flags: MessageFlags.Ephemeral
            });

        }

        if (!isBotAdmin(interaction.member)) {

            return interaction.reply({
                content: "❌ You need Administrator permission (or an approved admin role) to use the Embed Builder.",
                flags: MessageFlags.Ephemeral
            });

        }

        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        const session = createSession(userId, guildId);
        session.view = "main";

        await interaction.reply({
            embeds: [buildPreviewPanelEmbed(session.draft)],
            components: mainPanelComponents(),
            flags: MessageFlags.Ephemeral
        });

        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: SESSION_TIMEOUT
        });

        collector.on("collect", async i => {

            const current = getSession(userId);

            if (!current) return;

            try {

                await routeInteraction(i, current, collector);

            } catch (err) {

                console.error("Embed builder error:", err);

                try {

                    if (!i.replied && !i.deferred) {
                        await i.reply({
                            content: "❌ Something went wrong. Please try again.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                } catch (fallbackErr) {

                    console.error("Embed builder fallback reply failed:", fallbackErr.message);

                }

            }

        });

        collector.on("end", async () => {

            endSession(userId);

            try {

                await interaction.editReply({ components: [] });

            } catch {

                // Message may already be gone; nothing to do.

            }

        });

    }

};


// ---------------------------------------------------------------------
// Interaction routing
// ---------------------------------------------------------------------

async function routeInteraction(i, session, collector) {

    const id = i.customId;

    // --- Main panel ---

    if (id === "eb_section") return handleSectionSelect(i, session);
    if (id === "eb_send") return handleSend(i, session);
    if (id === "eb_save") return handleSaveTemplate(i, session);
    if (id === "eb_load") return handleOpenTemplates(i, session);
    if (id === "eb_reset") return handleReset(i, session);

    if (id === "eb_cancel") {

        session.view = "cancelled";

        await i.update({
            content: "❌ Embed builder cancelled.",
            embeds: [],
            components: []
        });

        collector.stop("cancelled");
        return;

    }

    // --- Fields panel ---

    if (id === "eb_field_select") return handleFieldSelect(i, session);
    if (id === "eb_field_add") return handleFieldAdd(i, session);
    if (id === "eb_field_edit") return handleFieldEdit(i, session);
    if (id === "eb_field_delete") return handleFieldDelete(i, session);
    if (id === "eb_field_up") return handleFieldMove(i, session, -1);
    if (id === "eb_field_down") return handleFieldMove(i, session, 1);

    // --- Templates panel ---

    if (id === "eb_template_select") return handleTemplateSelect(i, session);
    if (id === "eb_template_load") return handleTemplateLoad(i, session);
    if (id === "eb_template_rename") return handleTemplateRename(i, session);
    if (id === "eb_template_duplicate") return handleTemplateDuplicate(i, session);
    if (id === "eb_template_delete") return handleTemplateDelete(i, session);

    // --- Channel picker ---

    if (id === "eb_channel_select") return handleChannelSelect(i, session);

    // --- Shared "Back" button (fields, templates, channel picker -> main) ---

    if (id === "eb_back") return showMainPanel(i, session);

}


// ---------------------------------------------------------------------
// View renderers
// ---------------------------------------------------------------------

async function showMainPanel(i, session) {

    session.view = "main";

    await i.update({
        embeds: [buildPreviewPanelEmbed(session.draft)],
        components: mainPanelComponents()
    });

}

async function showFieldsPanel(i, session) {

    session.view = "fields";

    await i.update({
        embeds: [buildPreviewPanelEmbed(session.draft)],
        components: fieldsPanelComponents(session.draft.fields, session.selectedFieldIndex)
    });

}

async function showTemplatesPanel(i, session) {

    session.view = "templates";

    const templates = listTemplates(session.guildId);

    await i.update({
        embeds: [buildPreviewPanelEmbed(session.draft)],
        components: templatesPanelComponents(templates, session.selectedTemplateName)
    });

}


// ---------------------------------------------------------------------
// Modal helper
// ---------------------------------------------------------------------

// Shows a modal on `i` and waits for the same user to submit it.
// Returns the ModalSubmitInteraction, or null if it timed out.
async function promptModal(i, modal, userId) {

    await i.showModal(modal);

    try {

        return await i.awaitModalSubmit({
            filter: mi => mi.user.id === userId,
            time: MODAL_TIMEOUT
        });

    } catch (err) {

        return null;

    }

}


// ---------------------------------------------------------------------
// Main panel handlers
// ---------------------------------------------------------------------

async function handleSectionSelect(i, session) {

    const section = i.values[0];

    if (section === "fields") {
        return showFieldsPanel(i, session);
    }

    const modals = {
        info: () => infoModal(session.draft),
        style: () => styleModal(session.draft),
        author: () => authorModal(session.draft),
        images: () => imagesModal(session.draft),
        footer: () => footerModal(session.draft)
    };

    const buildModal = modals[section];
    if (!buildModal) return;

    const submitted = await promptModal(i, buildModal(), i.user.id);
    if (!submitted) return;

    applySectionSubmit(section, submitted, session.draft);

    await submitted.update({
        embeds: [buildPreviewPanelEmbed(session.draft)],
        components: mainPanelComponents()
    });

}

function cleanText(value) {

    const trimmed = (value || "").trim();
    return trimmed.length ? trimmed : null;

}

function applySectionSubmit(section, submitted, draft) {

    if (section === "info") {

        draft.title = cleanText(submitted.fields.getTextInputValue("title"));
        draft.description = cleanText(submitted.fields.getTextInputValue("description"));

    } else if (section === "style") {

        draft.color = cleanText(submitted.fields.getTextInputValue("color"));

        const timestampRaw = (submitted.fields.getTextInputValue("timestamp") || "").trim().toLowerCase();
        draft.timestamp = timestampRaw.startsWith("y");

    } else if (section === "author") {

        draft.author.name = cleanText(submitted.fields.getTextInputValue("name"));
        draft.author.iconURL = cleanText(submitted.fields.getTextInputValue("iconURL"));
        draft.author.url = cleanText(submitted.fields.getTextInputValue("url"));

    } else if (section === "images") {

        draft.thumbnail = cleanText(submitted.fields.getTextInputValue("thumbnail"));
        draft.image = cleanText(submitted.fields.getTextInputValue("image"));

    } else if (section === "footer") {

        draft.footer.text = cleanText(submitted.fields.getTextInputValue("text"));
        draft.footer.iconURL = cleanText(submitted.fields.getTextInputValue("iconURL"));

    }

}

async function handleReset(i, session) {

    session.draft = defaultDraft();
    session.selectedFieldIndex = null;
    session.selectedTemplateName = null;

    await i.update({
        embeds: [buildPreviewPanelEmbed(session.draft)],
        components: mainPanelComponents()
    });

    await i.followUp({
        content: "🧹 Draft cleared.",
        flags: MessageFlags.Ephemeral
    });

}

async function handleSend(i, session) {

    const { valid, errors } = validateDraft(session.draft);

    if (!valid) {

        await i.reply({
            content: `❌ This embed can't be sent yet:\n${errors.map(e => `• ${e}`).join("\n")}`,
            flags: MessageFlags.Ephemeral
        });

        return;

    }

    session.view = "channel";

    await i.update({
        embeds: [buildPreviewPanelEmbed(session.draft)],
        components: channelPickerComponents()
    });

}

async function handleChannelSelect(i, session) {

    const channel = i.channels.first();

    if (!channel) {

        await i.reply({
            content: "❌ Couldn't resolve that channel. Try again.",
            flags: MessageFlags.Ephemeral
        });

        return;

    }

    const botMember = i.guild.members.me;
    const perms = channel.permissionsFor(botMember);

    if (!perms || !perms.has(["ViewChannel", "SendMessages", "EmbedLinks"])) {

        await i.reply({
            content: `❌ I don't have permission to send embeds in ${channel}. Pick a different channel.`,
            flags: MessageFlags.Ephemeral
        });

        return;

    }

    const { valid, errors } = validateDraft(session.draft);

    if (!valid) {

        await i.reply({
            content: `❌ This embed can't be sent:\n${errors.map(e => `• ${e}`).join("\n")}`,
            flags: MessageFlags.Ephemeral
        });

        return;

    }

    try {

        await channel.send({ embeds: [buildDraftEmbed(session.draft)] });

    } catch (err) {

        console.error("Embed builder send failed:", err);

        await i.reply({
            content: "❌ Failed to send the embed to that channel. Check my permissions and try again.",
            flags: MessageFlags.Ephemeral
        });

        return;

    }

    await showMainPanel(i, session);

    await i.followUp({
        content: `✅ Embed sent to ${channel}!`,
        flags: MessageFlags.Ephemeral
    });

}


// ---------------------------------------------------------------------
// Fields panel handlers
// ---------------------------------------------------------------------

async function handleFieldSelect(i, session) {

    session.selectedFieldIndex = parseInt(i.values[0], 10);
    await showFieldsPanel(i, session);

}

async function handleFieldAdd(i, session) {

    const submitted = await promptModal(i, fieldModal(null), i.user.id);
    if (!submitted) return;

    const field = {
        name: cleanText(submitted.fields.getTextInputValue("name")) || "\u200b",
        value: cleanText(submitted.fields.getTextInputValue("value")) || "\u200b",
        inline: (submitted.fields.getTextInputValue("inline") || "").trim().toLowerCase().startsWith("y")
    };

    session.draft.fields.push(field);
    session.selectedFieldIndex = session.draft.fields.length - 1;

    await submitted.update({
        embeds: [buildPreviewPanelEmbed(session.draft)],
        components: fieldsPanelComponents(session.draft.fields, session.selectedFieldIndex)
    });

}

async function handleFieldEdit(i, session) {

    const idx = session.selectedFieldIndex;
    const field = session.draft.fields[idx];

    if (field === undefined) return;

    const submitted = await promptModal(i, fieldModal(field), i.user.id);
    if (!submitted) return;

    session.draft.fields[idx] = {
        name: cleanText(submitted.fields.getTextInputValue("name")) || "\u200b",
        value: cleanText(submitted.fields.getTextInputValue("value")) || "\u200b",
        inline: (submitted.fields.getTextInputValue("inline") || "").trim().toLowerCase().startsWith("y")
    };

    await submitted.update({
        embeds: [buildPreviewPanelEmbed(session.draft)],
        components: fieldsPanelComponents(session.draft.fields, session.selectedFieldIndex)
    });

}

async function handleFieldDelete(i, session) {

    const idx = session.selectedFieldIndex;

    if (session.draft.fields[idx] === undefined) return;

    session.draft.fields.splice(idx, 1);
    session.selectedFieldIndex = null;

    await showFieldsPanel(i, session);

}

async function handleFieldMove(i, session, direction) {

    const idx = session.selectedFieldIndex;
    const fields = session.draft.fields;
    const targetIdx = idx + direction;

    if (idx === null || idx === undefined) return;
    if (targetIdx < 0 || targetIdx >= fields.length) return;

    [fields[idx], fields[targetIdx]] = [fields[targetIdx], fields[idx]];
    session.selectedFieldIndex = targetIdx;

    await showFieldsPanel(i, session);

}


// ---------------------------------------------------------------------
// Templates panel handlers
// ---------------------------------------------------------------------

async function handleOpenTemplates(i, session) {

    session.selectedTemplateName = null;
    await showTemplatesPanel(i, session);

}

async function handleTemplateSelect(i, session) {

    session.selectedTemplateName = i.values[0];
    await showTemplatesPanel(i, session);

}

async function handleTemplateLoad(i, session) {

    const name = session.selectedTemplateName;
    if (!name) return;

    const template = getTemplate(session.guildId, name);

    if (!template) {

        await i.reply({
            content: "❌ That template no longer exists.",
            flags: MessageFlags.Ephemeral
        });

        return;

    }

    const baseDraft = defaultDraft();

    session.draft = {
        ...baseDraft,
        ...template.data,
        author: { ...baseDraft.author, ...(template.data.author || {}) },
        footer: { ...baseDraft.footer, ...(template.data.footer || {}) },
        fields: Array.isArray(template.data.fields) ? template.data.fields : []
    };

    session.selectedTemplateName = null;

    await showMainPanel(i, session);

    await i.followUp({
        content: `📂 Loaded template **${name}**.`,
        flags: MessageFlags.Ephemeral
    });

}

async function handleTemplateRename(i, session) {

    const oldName = session.selectedTemplateName;
    if (!oldName) return;

    const submitted = await promptModal(
        i,
        templateNameModal("eb_modal_rename_template", "Rename Template", oldName),
        i.user.id
    );

    if (!submitted) return;

    const newName = cleanText(submitted.fields.getTextInputValue("name"));

    if (!newName) {

        await submitted.reply({
            content: "❌ Template name can't be empty.",
            flags: MessageFlags.Ephemeral
        });

        return;

    }

    const success = renameTemplate(session.guildId, oldName, newName);

    if (!success) {

        await submitted.reply({
            content: `❌ Couldn't rename — a template named **${newName}** may already exist.`,
            flags: MessageFlags.Ephemeral
        });

        return;

    }

    session.selectedTemplateName = newName;

    const templates = listTemplates(session.guildId);

    await submitted.update({
        embeds: [buildPreviewPanelEmbed(session.draft)],
        components: templatesPanelComponents(templates, newName)
    });

}

async function handleTemplateDuplicate(i, session) {

    const name = session.selectedTemplateName;
    if (!name) return;

    const submitted = await promptModal(
        i,
        templateNameModal("eb_modal_duplicate_template", "Duplicate Template As...", `${name} (copy)`),
        i.user.id
    );

    if (!submitted) return;

    const newName = cleanText(submitted.fields.getTextInputValue("name"));

    if (!newName) {

        await submitted.reply({
            content: "❌ Template name can't be empty.",
            flags: MessageFlags.Ephemeral
        });

        return;

    }

    const success = duplicateTemplate(session.guildId, name, newName, i.user.id);

    if (!success) {

        await submitted.reply({
            content: `❌ Couldn't duplicate — a template named **${newName}** may already exist.`,
            flags: MessageFlags.Ephemeral
        });

        return;

    }

    session.selectedTemplateName = newName;

    const templates = listTemplates(session.guildId);

    await submitted.update({
        embeds: [buildPreviewPanelEmbed(session.draft)],
        components: templatesPanelComponents(templates, newName)
    });

}

async function handleTemplateDelete(i, session) {

    const name = session.selectedTemplateName;
    if (!name) return;

    deleteTemplate(session.guildId, name);
    session.selectedTemplateName = null;

    await showTemplatesPanel(i, session);

    await i.followUp({
        content: `🗑️ Deleted template **${name}**.`,
        flags: MessageFlags.Ephemeral
    });

}


// ---------------------------------------------------------------------
// Save template (from the main panel)
// ---------------------------------------------------------------------

async function handleSaveTemplate(i, session) {

    const { valid, errors } = validateDraft(session.draft);

    if (!valid) {

        await i.reply({
            content: `❌ Fix these before saving as a template:\n${errors.map(e => `• ${e}`).join("\n")}`,
            flags: MessageFlags.Ephemeral
        });

        return;

    }

    const submitted = await promptModal(
        i,
        templateNameModal("eb_modal_save_template", "Save Template"),
        i.user.id
    );

    if (!submitted) return;

    const name = cleanText(submitted.fields.getTextInputValue("name"));

    if (!name) {

        await submitted.reply({
            content: "❌ Template name can't be empty.",
            flags: MessageFlags.Ephemeral
        });

        return;

    }

    saveTemplate(session.guildId, name, session.draft, submitted.user.id);

    await submitted.update({
        embeds: [buildPreviewPanelEmbed(session.draft)],
        components: mainPanelComponents()
    });

    await submitted.followUp({
        content: `💾 Saved as template **${name}**.`,
        flags: MessageFlags.Ephemeral
    });

}
