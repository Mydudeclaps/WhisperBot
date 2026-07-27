const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType
} = require("discord.js");


// ---------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------

function mainSectionSelect() {

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("eb_section")
            .setPlaceholder("✏️ Edit a section...")
            .addOptions(
                { label: "Title & Description", value: "info", emoji: "📝" },
                { label: "Color & Timestamp", value: "style", emoji: "🎨" },
                { label: "Author", value: "author", emoji: "👤" },
                { label: "Images", value: "images", emoji: "🖼️" },
                { label: "Footer", value: "footer", emoji: "📄" },
                { label: "Manage Fields", value: "fields", emoji: "📋" }
            )
    );

}

function mainActionRow() {

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("eb_send").setLabel("Send Embed").setEmoji("✅").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("eb_save").setLabel("Save Template").setEmoji("💾").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("eb_load").setLabel("Load Template").setEmoji("📂").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("eb_reset").setLabel("Reset").setEmoji("🧹").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("eb_cancel").setLabel("Cancel").setEmoji("❌").setStyle(ButtonStyle.Danger)
    );

}

function mainPanelComponents() {

    return [mainSectionSelect(), mainActionRow()];

}


// ---------------------------------------------------------------------
// Fields sub-panel
// ---------------------------------------------------------------------

function fieldsSelectRow(fields, selectedIndex) {

    const select = new StringSelectMenuBuilder()
        .setCustomId("eb_field_select")
        .setPlaceholder(fields.length ? "Select a field to edit, delete, or move..." : "No fields yet — add one below");

    if (!fields.length) {

        select
            .setDisabled(true)
            .addOptions({ label: "No fields yet", value: "none" });

    } else {

        select.addOptions(
            fields.slice(0, 25).map((f, i) => ({
                label: (f.name || "Untitled field").slice(0, 100),
                description: (f.value || "").slice(0, 100) || undefined,
                value: String(i),
                default: i === selectedIndex
            }))
        );

    }

    return new ActionRowBuilder().addComponents(select);

}

function fieldsActionRow(hasSelection) {

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("eb_field_add").setLabel("Add Field").setEmoji("➕").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("eb_field_edit").setLabel("Edit").setEmoji("✏️").setStyle(ButtonStyle.Primary).setDisabled(!hasSelection),
        new ButtonBuilder().setCustomId("eb_field_delete").setLabel("Delete").setEmoji("🗑️").setStyle(ButtonStyle.Danger).setDisabled(!hasSelection),
        new ButtonBuilder().setCustomId("eb_field_up").setLabel("Move Up").setEmoji("⬆️").setStyle(ButtonStyle.Secondary).setDisabled(!hasSelection),
        new ButtonBuilder().setCustomId("eb_field_down").setLabel("Move Down").setEmoji("⬇️").setStyle(ButtonStyle.Secondary).setDisabled(!hasSelection)
    );

}

function fieldsBackRow() {

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("eb_back").setLabel("Back to Editor").setEmoji("⬅️").setStyle(ButtonStyle.Secondary)
    );

}

function fieldsPanelComponents(fields, selectedIndex) {

    return [
        fieldsSelectRow(fields, selectedIndex),
        fieldsActionRow(selectedIndex !== null && selectedIndex !== undefined),
        fieldsBackRow()
    ];

}


// ---------------------------------------------------------------------
// Templates sub-panel
// ---------------------------------------------------------------------

function templatesSelectRow(templates, selectedName) {

    const select = new StringSelectMenuBuilder()
        .setCustomId("eb_template_select")
        .setPlaceholder(templates.length ? "Select a template..." : "No templates saved yet");

    if (!templates.length) {

        select
            .setDisabled(true)
            .addOptions({ label: "No templates saved yet", value: "none" });

    } else {

        select.addOptions(
            templates.slice(0, 25).map(t => ({
                label: t.name.slice(0, 100),
                value: t.name,
                default: t.name === selectedName
            }))
        );

    }

    return new ActionRowBuilder().addComponents(select);

}

function templatesActionRow(hasSelection) {

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("eb_template_load").setLabel("Load").setEmoji("📂").setStyle(ButtonStyle.Success).setDisabled(!hasSelection),
        new ButtonBuilder().setCustomId("eb_template_rename").setLabel("Rename").setEmoji("✏️").setStyle(ButtonStyle.Primary).setDisabled(!hasSelection),
        new ButtonBuilder().setCustomId("eb_template_duplicate").setLabel("Duplicate").setEmoji("📑").setStyle(ButtonStyle.Secondary).setDisabled(!hasSelection),
        new ButtonBuilder().setCustomId("eb_template_delete").setLabel("Delete").setEmoji("🗑️").setStyle(ButtonStyle.Danger).setDisabled(!hasSelection),
        new ButtonBuilder().setCustomId("eb_back").setLabel("Back").setEmoji("⬅️").setStyle(ButtonStyle.Secondary)
    );

}

function templatesPanelComponents(templates, selectedName) {

    return [
        templatesSelectRow(templates, selectedName),
        templatesActionRow(!!selectedName)
    ];

}


// ---------------------------------------------------------------------
// Channel picker (shown when sending)
// ---------------------------------------------------------------------

function channelPickerComponents() {

    const select = new ChannelSelectMenuBuilder()
        .setCustomId("eb_channel_select")
        .setPlaceholder("Select a channel to send this embed to...")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

    const cancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("eb_back").setLabel("Cancel").setEmoji("❌").setStyle(ButtonStyle.Secondary)
    );

    return [new ActionRowBuilder().addComponents(select), cancelRow];

}


module.exports = {

    mainPanelComponents,
    fieldsPanelComponents,
    templatesPanelComponents,
    channelPickerComponents

};
