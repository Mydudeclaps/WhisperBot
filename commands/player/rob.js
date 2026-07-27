const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require("discord.js");

const { validateRobbery } = require("../../services/robberyValidator");
const { estimateSuccessChance, estimateLootRange, resolveRobbery } = require("../../services/robberyCalculator");
const { getRobberyStats, applyRobberyResult, logRobbery } = require("../../services/robberyLogger");
const { lock, unlock } = require("../../utils/robberyUtils");
const { addCoins, getCoins } = require("../../services/coinService");
const { getUser } = require("../../services/userService");
const OUTCOMES = require("../../data/robberyOutcomes");
const ROB = require("../../config/robberyConfig");

const {
    robberyScanEmbed,
    robberyEstimateEmbed,
    robberyExecutionEmbed,
    robberyVictimDMEmbed,
    robberyChannelPingEmbed,
    robberyTimeoutNote,
    robberyResultEmbed
} = require("../../utils/embedFactory");


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function decisionRow() {

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("rob_look").setLabel("👀 Look Around").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("rob_run").setLabel("🏃 Run").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("rob_defend").setLabel("🛡 Defend").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("rob_ignore").setLabel("🙈 Ignore").setStyle(ButtonStyle.Secondary)
    );

}


function proceedRow() {

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("rob_proceed").setLabel("✅ Proceed").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("rob_cancel").setLabel("❌ Cancel").setStyle(ButtonStyle.Secondary)
    );

}


// Sends the DM prompt and waits (up to DECISION_TIMEOUT) for the victim's
// button choice. Returns "look_around" | "run" | "defend" | "ignore" —
// falling back to "ignore" on timeout, declined DMs, or any other error.
async function getVictimResponse(client, victim, robberUsername, originChannel) {

    let dmMessage;

    try {

        const { embed, files } = robberyVictimDMEmbed(robberUsername);

        dmMessage = await victim.send({
            embeds: [embed],
            files,
            components: [decisionRow()]
        });

    } catch (err) {

        // DMs closed — silently default to Ignore, same as a timeout.
        return "ignore";

    }

    try {

        const { embed, files } = robberyChannelPingEmbed(victim.username);

        await originChannel.send({
            embeds: [embed],
            files
        });

    } catch (err) {

        // Non-critical — the DM already went out either way.

    }

    try {

        const choice = await dmMessage.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: ROB.DECISION_TIMEOUT * 1000,
            filter: i => i.user.id === victim.id
        });

        const map = {
            rob_look: "look_around",
            rob_run: "run",
            rob_defend: "defend",
            rob_ignore: "ignore"
        };

        await choice.update({
            content: "✅ Response received.",
            embeds: [],
            components: []
        });

        return map[choice.customId] || "ignore";

    } catch (err) {

        try {

            await dmMessage.edit({
                content: robberyTimeoutNote(),
                embeds: [],
                components: []
            });

        } catch (editErr) {

            // Nothing more we can do if even the edit fails.

        }

        return "ignore";

    }

}


module.exports = {

    data: new SlashCommandBuilder()
        .setName("rob")
        .setDescription("🥷 Attempt to rob another player")
        .addUserOption(option =>
            option
                .setName("victim")
                .setDescription("Who are you targeting?")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("bet")
                .setDescription(`Coins to risk (${ROB.MIN_BET.toLocaleString()}-${ROB.MAX_BET.toLocaleString()})`)
                .setRequired(true)
                .setMinValue(ROB.MIN_BET)
                .setMaxValue(ROB.MAX_BET)
        ),

    async execute(interaction) {

        const robberId = interaction.user.id;
        const robberUsername = interaction.user.username;
        const victim = interaction.options.getUser("victim");
        const bet = interaction.options.getInteger("bet");

        getUser(robberId, robberUsername);

        const validation = validateRobbery(robberId, robberUsername, victim, bet);

        if (!validation.valid) {

            return interaction.reply({
                content: `❌ ${validation.reason}`,
                flags: MessageFlags.Ephemeral
            });

        }

        getUser(victim.id, victim.username);

        lock(robberId);
        lock(victim.id);

        try {

            // --- Scan phase ---
            await interaction.deferReply();

            const { embed: scanEmbed1, files: scanFiles1 } = robberyScanEmbed(victim.username, 20);

            await interaction.editReply({
                embeds: [scanEmbed1],
                files: scanFiles1
            });

            await sleep((ROB.SCAN_DURATION * 1000) / 2);

            const { embed: scanEmbed2, files: scanFiles2 } = robberyScanEmbed(victim.username, 100);

            await interaction.editReply({
                embeds: [scanEmbed2],
                files: scanFiles2
            });

            await sleep((ROB.SCAN_DURATION * 1000) / 2);

            const robberStats = getRobberyStats(robberId);
            const robberUser = getUser(robberId, robberUsername);
            const victimUser = getUser(victim.id, victim.username);
            const victimCoins = getCoins(victim.id);

            const estimatedChance = estimateSuccessChance({
                robberRep: robberUser.kingdom_rep,
                victimRep: victimUser.kingdom_rep,
                heat: robberStats.heat,
                streak: robberStats.streak,
                victimResponse: null
            });

            const lootRange = estimateLootRange(victimCoins);

            // --- Decision phase (robber) ---
            const { embed: estimateEmbed, files: estimateFiles } = robberyEstimateEmbed(victim.username, estimatedChance, lootRange, bet);

            await interaction.editReply({
                embeds: [estimateEmbed],
                files: estimateFiles,
                components: [proceedRow()]
            });

            const message = await interaction.fetchReply();

            let proceed;

            try {

                proceed = await message.awaitMessageComponent({
                    componentType: ComponentType.Button,
                    time: ROB.PROCEED_TIMEOUT * 1000,
                    filter: i => i.user.id === robberId
                });

            } catch (err) {

                await interaction.editReply({
                    content: "⌛ No response — robbery called off.",
                    embeds: [],
                    components: []
                });

                return;

            }

            if (proceed.customId === "rob_cancel") {

                await proceed.update({
                    content: "❌ Robbery cancelled.",
                    embeds: [],
                    components: []
                });

                return;

            }

            const { embed: executionEmbed, files: executionFiles } = robberyExecutionEmbed(victim.username);

            await proceed.deferUpdate();

            await interaction.editReply({
                embeds: [executionEmbed],
                files: executionFiles,
                components: []
            });

            // --- Execution phase ---
            await sleep(ROB.EXECUTION_WAIT * 1000);

            const victimResponse = await getVictimResponse(
                interaction.client,
                victim,
                robberUsername,
                interaction.channel
            );

            // --- Resolve outcome ---
            const freshRobberStats = getRobberyStats(robberId);

            const result = resolveRobbery({
                robberRep: robberUser.kingdom_rep,
                victimRep: victimUser.kingdom_rep,
                heat: freshRobberStats.heat,
                streak: freshRobberStats.streak,
                victimResponse,
                victimCoins: getCoins(victim.id),
                bet
            });

            // Apply coin effects
            if (result.loot > 0) {

                addCoins(victim.id, victim.username, -result.loot);
                addCoins(robberId, robberUsername, result.loot);

            } else if (result.loot < 0) {

                // Defended — robber pays the victim
                const amount = Math.abs(result.loot);
                addCoins(robberId, robberUsername, -amount);
                addCoins(victim.id, victim.username, amount);

            }

            if (result.fine > 0) {

                addCoins(robberId, robberUsername, -result.fine);

            }

            applyRobberyResult(robberId, {
                heatDelta: result.heatDelta,
                streakReset: result.streakReset,
                cooldownSeconds: result.cooldownSeconds
            });

            logRobbery({
                robberId,
                victimId: victim.id,
                betAmount: bet,
                lootStolen: result.loot,
                outcome: result.outcome,
                victimResponse,
                successChance: result.successChance,
                randomRoll: result.randomRoll
            });

            const outcomeKey = result.outcome.toUpperCase();
            const outcomeMeta = OUTCOMES[outcomeKey] || OUTCOMES.ESCAPED;

            const { embed: resultEmbed, files: resultFiles } = robberyResultEmbed(
                robberUsername,
                victim.username,
                outcomeMeta,
                result,
                getCoins(robberId)
            );

            await interaction.editReply({
                embeds: [resultEmbed],
                files: resultFiles,
                components: []
            });

        } catch (err) {

            console.error("Robbery error:", err);

            try {

                await interaction.editReply({
                    content: "❌ Something went wrong mid-robbery — no coins changed hands.",
                    embeds: [],
                    components: []
                });

            } catch (editErr) {

                // Interaction may already be dead — nothing more to do.

            }

        } finally {

            unlock(robberId);
            unlock(victim.id);

        }

    }

};
