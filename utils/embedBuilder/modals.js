const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require("discord.js");


function row(input) {
    return new ActionRowBuilder().addComponents(input);
}


function infoModal(draft) {

    const modal = new ModalBuilder()
        .setCustomId("eb_modal_info")
        .setTitle("Title & Description");

    const title = new TextInputBuilder()
        .setCustomId("title")
        .setLabel("Title")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(256)
        .setRequired(false);

    if (draft.title) title.setValue(draft.title);

    const description = new TextInputBuilder()
        .setCustomId("description")
        .setLabel("Description (Markdown supported)")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(4000)
        .setRequired(false);

    if (draft.description) description.setValue(draft.description);

    modal.addComponents(row(title), row(description));

    return modal;

}


function styleModal(draft) {

    const modal = new ModalBuilder()
        .setCustomId("eb_modal_style")
        .setTitle("Color & Timestamp");

    const color = new TextInputBuilder()
        .setCustomId("color")
        .setLabel("Hex Color (e.g. #5865F2)")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(7)
        .setRequired(false);

    if (draft.color) color.setValue(draft.color);

    const timestamp = new TextInputBuilder()
        .setCustomId("timestamp")
        .setLabel("Show timestamp? (yes/no)")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(3)
        .setRequired(false)
        .setValue(draft.timestamp ? "yes" : "no");

    modal.addComponents(row(color), row(timestamp));

    return modal;

}


function authorModal(draft) {

    const modal = new ModalBuilder()
        .setCustomId("eb_modal_author")
        .setTitle("Author");

    const name = new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Author Name")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(256)
        .setRequired(false);

    if (draft.author.name) name.setValue(draft.author.name);

    const iconURL = new TextInputBuilder()
        .setCustomId("iconURL")
        .setLabel("Author Icon URL (optional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    if (draft.author.iconURL) iconURL.setValue(draft.author.iconURL);

    const url = new TextInputBuilder()
        .setCustomId("url")
        .setLabel("Author Link (optional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    if (draft.author.url) url.setValue(draft.author.url);

    modal.addComponents(row(name), row(iconURL), row(url));

    return modal;

}


function imagesModal(draft) {

    const modal = new ModalBuilder()
        .setCustomId("eb_modal_images")
        .setTitle("Images");

    const thumbnail = new TextInputBuilder()
        .setCustomId("thumbnail")
        .setLabel("Thumbnail URL")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    if (draft.thumbnail) thumbnail.setValue(draft.thumbnail);

    const image = new TextInputBuilder()
        .setCustomId("image")
        .setLabel("Main Image URL")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    if (draft.image) image.setValue(draft.image);

    modal.addComponents(row(thumbnail), row(image));

    return modal;

}


function footerModal(draft) {

    const modal = new ModalBuilder()
        .setCustomId("eb_modal_footer")
        .setTitle("Footer");

    const text = new TextInputBuilder()
        .setCustomId("text")
        .setLabel("Footer Text")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(2048)
        .setRequired(false);

    if (draft.footer.text) text.setValue(draft.footer.text);

    const iconURL = new TextInputBuilder()
        .setCustomId("iconURL")
        .setLabel("Footer Icon URL (optional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    if (draft.footer.iconURL) iconURL.setValue(draft.footer.iconURL);

    modal.addComponents(row(text), row(iconURL));

    return modal;

}


function fieldModal(existingField) {

    const modal = new ModalBuilder()
        .setCustomId("eb_modal_field")
        .setTitle(existingField ? "Edit Field" : "Add Field");

    const name = new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Field Name")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(256)
        .setRequired(true);

    if (existingField?.name) name.setValue(existingField.name);

    const value = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Field Value (Markdown supported)")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1024)
        .setRequired(true);

    if (existingField?.value) value.setValue(existingField.value);

    const inline = new TextInputBuilder()
        .setCustomId("inline")
        .setLabel("Inline? (yes/no)")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(3)
        .setRequired(false)
        .setValue(existingField?.inline ? "yes" : "no");

    modal.addComponents(row(name), row(value), row(inline));

    return modal;

}


function templateNameModal(customId, title, existingName) {

    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle(title);

    const name = new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Template Name")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(80)
        .setRequired(true);

    if (existingName) name.setValue(existingName);

    modal.addComponents(row(name));

    return modal;

}


module.exports = {

    infoModal,
    styleModal,
    authorModal,
    imagesModal,
    footerModal,
    fieldModal,
    templateNameModal

};
