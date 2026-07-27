const { SlashCommandBuilder, MessageFlags } = require("discord.js");

const { fishResultEmbed } = require("../../utils/embedFactory");

const { checkCooldown } = require("../../services/cooldownService");

const { addCoins, getCoins } = require("../../services/coinService");

const { FISHING } = require("../../config/gameConfig");

const fishOutcomes = require("../../data/fishOutcomes");


// Waits `ms` milliseconds
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
}


// Rolls a fishing outcome and returns { text, payout }
function rollFishResult() {

    // Treasure chest — rarest outcome, checked first
    if (Math.random() < FISHING.TREASURE_CHANCE) {

        const { text, min, max } = fishOutcomes.treasure;

        return { text, payout: randomBetween(min, max) };

    }

    // Did they catch anything at all?
    if (Math.random() < FISHING.CATCH_CHANCE) {

        // Is this catch a rare one?
        const pool = Math.random() < FISHING.RARE_CHANCE
            ? fishOutcomes.rareCatches
            : fishOutcomes.catches;

        const { text, min, max } = randomFrom(pool);

        return { text, payout: randomBetween(min, max) };

    }

    // Nothing — one of the flavor-text fails
    const fail = randomFrom(fishOutcomes.fails);

    return { text: fail.text, payout: 0 };

}


module.exports = {

    data: new SlashCommandBuilder()
        .setName("fish")
        .setDescription("🎣 Go fishing and try your luck!"),

    async execute(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        const cooldown = checkCooldown(userId, "fish", FISHING.COOLDOWN_SECONDS);

        if (!cooldown.allowed) {

            return interaction.reply({
                content: `⏳ Your line's still out — wait ${cooldown.remaining}s before fishing again!`,
                flags: MessageFlags.Ephemeral
            });

        }

        await interaction.reply("🎣 You bait your hook...");

        await wait(1000);
        await interaction.editReply("🌊 Cast your line way out there...");

        await wait(1500);
        await interaction.editReply("🎯 Where's your bobber at?");

        await wait(1500);

        const result = rollFishResult();

        let newBalance = getCoins(userId);

        if (result.payout > 0) {
            newBalance = addCoins(userId, username, result.payout);
        }

        const { embed, files } = fishResultEmbed(
            username,
            result.text,
            result.payout,
            newBalance,
            interaction.user.displayAvatarURL()
        );

        await interaction.editReply({
            content: null,
            embeds: [embed],
            files
        });

    }

};
