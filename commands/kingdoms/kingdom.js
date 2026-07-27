const {
    SlashCommandBuilder,
    ComponentType,
    MessageFlags
} = require("discord.js");


const {
    getKingdom,
    joinKingdom,
    leaveKingdom,
    getKingdomRank,
    getServerStats,
    getKingdomStats,
    getAllKingdomRepTotals
} = require("../../services/kingdomService");

const kingdoms = require("../../data/kingdoms");

const {
    kingdomSelectEmbed,
    kingdomSelectRow,
    kingdomConfirmEmbed,
    kingdomConfirmRow,
    kingdomJoinSuccessEmbed,
    kingdomTimeoutEmbed,
    kingdomLeaveEmbed,
    kingdomAtlasRows,
    kingdomAtlasEmbed,
    kingdomDetailEmbed,
    myKingdomEmbed,
    myKingdomNoneEmbed
} = require("../../utils/kingdomEmbeds");

const { errorEmbed } = require("../../utils/embedFactory");


const SELECTION_TIMEOUT = 60 * 1000; // 1 minute
const ATLAS_TIMEOUT = 5 * 60 * 1000; // 5 minutes


module.exports = {


    data: new SlashCommandBuilder()

        .setName("kingdom")

        .setDescription("Manage your WhisperSMP kingdom")

        .addSubcommand(sub =>

            sub
                .setName("info")
                .setDescription("Explore the WhisperSMP Kingdom Atlas")

        )


        .addSubcommand(sub =>

            sub
                .setName("join")
                .setDescription("Join a kingdom")

        )


        .addSubcommand(sub =>

            sub
                .setName("leave")
                .setDescription("Leave your current kingdom")

        ),



    async execute(interaction) {


        const userId = interaction.user.id;


        const action =
            interaction.options.getSubcommand();


        if (action === "info") {
            return handleInfo(interaction, userId);
        }


        if (action === "join") {
            return handleJoin(interaction, userId);
        }


        if (action === "leave") {
            return handleLeave(interaction, userId);
        }

    }


};


// Builds the "My Kingdom" page for whoever is currently viewing the atlas.
// Returns { embed, files } like the other embedFactory/kingdomEmbeds helpers.
function buildMyKingdomPage(discordUser) {

    const user = getKingdom(discordUser.id);

    if (!user || user.kingdom === "None") {
        return myKingdomNoneEmbed();
    }

    const rank = getKingdomRank(discordUser.id, user.kingdom);

    return myKingdomEmbed(
        discordUser.username,
        discordUser.displayAvatarURL(),
        user,
        rank
    );

}


async function handleInfo(interaction, userId) {

    await interaction.deferReply();

    const { embed: atlasEmbed1, files: atlasFiles1 } = kingdomAtlasEmbed(getServerStats());

    await interaction.editReply({
        embeds: [atlasEmbed1],
        files: atlasFiles1,
        components: kingdomAtlasRows("overview")
    });

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => i.user.id === userId,
        time: ATLAS_TIMEOUT
    });

    collector.on("collect", async i => {

        try {

            if (i.customId === "atlas_overview") {

                const { embed, files } = kingdomAtlasEmbed(getServerStats());

                await i.update({
                    embeds: [embed],
                    files,
                    components: kingdomAtlasRows("overview")
                });

                return;

            }

            if (i.customId === "atlas_mykingdom") {

                const { embed, files } = buildMyKingdomPage(i.user);

                await i.update({
                    embeds: [embed],
                    files,
                    components: kingdomAtlasRows("mykingdom")
                });

                return;

            }

            if (i.customId.startsWith("atlas_")) {

                const key = i.customId.replace("atlas_", "");

                if (!kingdoms[key]) return;

                const stats = getKingdomStats(key);
                const repTotals = getAllKingdomRepTotals();

                const { embed, files } = kingdomDetailEmbed(key, stats, repTotals);

                await i.update({
                    embeds: [embed],
                    files,
                    components: kingdomAtlasRows(key)
                });

                return;

            }

        } catch (error) {

            console.error("Kingdom Atlas button error:", error);

        }

    });

    collector.on("end", async (_collected, reason) => {

        if (reason !== "time") return;

        try {

            await interaction.editReply({ components: [] });

        } catch {

            // Message may already be gone; nothing to do.

        }

    });

}


async function handleJoin(interaction, userId) {

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { embed: selectEmbed1, files: selectFiles1 } = kingdomSelectEmbed();

    await interaction.editReply({
        embeds: [selectEmbed1],
        files: selectFiles1,
        components: [kingdomSelectRow()]
    });

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === userId,
        time: SELECTION_TIMEOUT
    });

    let finished = false;

    collector.on("collect", async i => {

        try {

            if (i.customId.startsWith("select_")) {

                const key = i.customId.replace("select_", "");

                const { embed, files } = kingdomConfirmEmbed(key);

                await i.update({
                    embeds: [embed],
                    files,
                    components: [kingdomConfirmRow(key)]
                });

                return;

            }

            if (i.customId.startsWith("confirm_")) {

                const key = i.customId.replace("confirm_", "");

                const result = joinKingdom(userId, key);

                if (!result.success) {

                    await i.update({
                        embeds: [errorEmbed(result.message)],
                        components: []
                    });

                    finished = true;
                    collector.stop("done");
                    return;

                }

                const { embed, files } = kingdomJoinSuccessEmbed(key);

                await i.update({
                    embeds: [embed],
                    files,
                    components: []
                });

                finished = true;
                collector.stop("done");
                return;

            }

            if (i.customId === "cancel") {

                const { embed, files } = kingdomSelectEmbed();

                await i.update({
                    embeds: [embed],
                    files,
                    components: [kingdomSelectRow()]
                });

                return;

            }

        } catch (error) {

            console.error("Kingdom button error:", error);

        }

    });

    collector.on("end", async (_collected, reason) => {

        if (finished || reason !== "time") return;

        try {

            const { embed, files } = kingdomTimeoutEmbed();

            await interaction.editReply({
                embeds: [embed],
                files,
                components: []
            });

        } catch {

            // Message may already be gone; nothing to do.

        }

    });

}


async function handleLeave(interaction, userId) {

    await interaction.deferReply();

    leaveKingdom(userId);

    const { embed, files } = kingdomLeaveEmbed();

    return interaction.editReply({
        embeds: [embed],
        files
    });

}
