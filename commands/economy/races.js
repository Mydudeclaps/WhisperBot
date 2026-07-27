const { SlashCommandBuilder } = require("discord.js");

const { racesListEmbed } = require("../../utils/embedFactory");
const { listActiveRaces } = require("../../services/raceService");


module.exports = {

    data: new SlashCommandBuilder()
        .setName("races")
        .setDescription("🏆 Show all pending and active daily races"),

    async execute(interaction) {

        // Deferred immediately — the username-resolution loop below makes
        // real network calls per player, on top of the embed's attachment
        // upload, so it's the least safe command to leave undeferred.
        await interaction.deferReply();

        const races = listActiveRaces();

        const ids = new Set();
        races.forEach(r => { ids.add(r.player1_id); ids.add(r.player2_id); });

        const resolveNames = {};

        for (const id of ids) {

            try {
                const user = await interaction.client.users.fetch(id);
                resolveNames[id] = user.username;
            } catch (err) {
                resolveNames[id] = id;
            }

        }

        const { embed, files } = racesListEmbed(races, resolveNames);

        await interaction.editReply({
            embeds: [embed],
            files
        });

    }

};
