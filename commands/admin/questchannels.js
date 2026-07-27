const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");

const {
    getExcludedChannels,
    addExcludedChannel,
    removeExcludedChannel
} = require("../../config/questChannelConfig");

const { isBotAdmin } = require("../../services/adminService");


module.exports = {

    data: new SlashCommandBuilder()
        .setName("questchannels")
        .setDescription("Manage which channels are excluded from quest message tracking")

        .addSubcommand(sub =>
            sub
                .setName("list")
                .setDescription("List channels excluded from quest tracking")
        )

        .addSubcommand(sub =>
            sub
                .setName("add")
                .setDescription("Exclude a channel from quest tracking")
                .addChannelOption(opt =>
                    opt
                        .setName("channel")
                        .setDescription("Channel to exclude")
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("remove")
                .setDescription("Re-include a channel in quest tracking")
                .addChannelOption(opt =>
                    opt
                        .setName("channel")
                        .setDescription("Channel to re-include")
                        .setRequired(true)
                )
        ),


    async execute(interaction) {


        if (!isBotAdmin(interaction.member)) {

            return interaction.reply({
                content: "❌ You do not have permission to use this command.",
                flags: MessageFlags.Ephemeral
            });

        }


        const sub = interaction.options.getSubcommand();


        if (sub === "list") {

            const excluded = getExcludedChannels();

            if (excluded.length === 0) {

                return interaction.reply({
                    content: "✅ No channels are currently excluded — quest progress is tracked in every channel.",
                    flags: MessageFlags.Ephemeral
                });

            }

            const formatted = excluded
                .map(entry => `• ${entry}`)
                .join("\n");

            return interaction.reply({
                content: `🚫 **Channels excluded from quest tracking:**\n${formatted}`,
                flags: MessageFlags.Ephemeral
            });

        }


        const channel = interaction.options.getChannel("channel");


        if (sub === "add") {

            addExcludedChannel(channel.id);

            return interaction.reply({
                content: `🚫 <#${channel.id}> will no longer count toward quest progress.`,
                flags: MessageFlags.Ephemeral
            });

        }


        if (sub === "remove") {

            removeExcludedChannel(channel.id);

            return interaction.reply({
                content: `✅ <#${channel.id}> now counts toward quest progress again.`,
                flags: MessageFlags.Ephemeral
            });

        }

    }

};
