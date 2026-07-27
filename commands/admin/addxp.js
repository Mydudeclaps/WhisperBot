const db = require("../../database/database");

const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const { isBotAdmin } = require("../../services/adminService");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("addxp")
        .setDescription("Add XP to a player"),


    async execute(interaction) {


        if (!isBotAdmin(interaction.member)) {

            return interaction.reply({
                content: "❌ You do not have permission to use this command.",
                flags: MessageFlags.Ephemeral
            });

        }


        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");


        let user = db.prepare(
            "SELECT * FROM users WHERE id = ?"
        ).get(target.id);


        if (!user) {

            db.prepare(`
                INSERT INTO users
                (id, username, joined)
                VALUES (?, ?, ?)
            `).run(
                target.id,
                target.username,
                new Date().toLocaleDateString()
            );


            user = db.prepare(
                "SELECT * FROM users WHERE id = ?"
            ).get(target.id);

        }


        const oldLevel = user.level;


        let newXP = user.xp + amount;
        let newLevel = user.level;


        while (newXP >= newLevel * 100) {

            newXP -= newLevel * 100;
            newLevel++;

        }


        db.prepare(`
            UPDATE users
            SET xp = ?, level = ?
            WHERE id = ?
        `).run(
            newXP,
            newLevel,
            target.id
        );


        await interaction.reply(
            `✨ Added **${amount} XP** to ${target.username}\n\n` +

            `⭐ Level: **${oldLevel} → ${newLevel}**\n` +
            `✨ XP: **${newXP}**`
        );

    }
};