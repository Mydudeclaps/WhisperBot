const { SlashCommandBuilder } = require("discord.js");

const db = require("../../database/database");

const { getUser } = require("../../services/userService");

const {
    getTitle,
    xpNeeded
} = require("../../services/levelService");

const {
    createProgressBar
} = require("../../utils/progressBar");

const {
    profileEmbed
} = require("../../utils/embedFactory");


module.exports = {

    data: new SlashCommandBuilder()
        .setName("profile")
        .setDescription("View your WhisperBot profile"),


    async execute(interaction) {

        // Acknowledge immediately — DB lookups plus uploading the
        // thumbnail GIF can occasionally take longer than the 3s window
        // Discord allows for the initial reply, especially right after a
        // restart. deferReply() buys much more time; editReply() has no
        // such deadline.
        await interaction.deferReply();


        const user = getUser(
            interaction.user.id,
            interaction.user.username
        );


        // Calculate server rank
        const rank = db.prepare(`
            SELECT COUNT(*) as position
            FROM users
            WHERE xp > ?
        `).get(user.xp);



        // XP calculations
        const neededXP = xpNeeded(user.level);


        const bar = createProgressBar(
            user.xp,
            neededXP
        );



        // Player title
        const title = getTitle(user.level);



        const { embed, files } = profileEmbed(
            user,
            rank.position + 1,
            title,
            bar,
            neededXP,
            interaction.user.displayAvatarURL()
        );

        await interaction.editReply({

            embeds: [embed],

            files

        });


    }

};