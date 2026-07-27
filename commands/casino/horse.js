const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    MessageFlags
} = require("discord.js");

const {
    casinoSetupEmbed,
    casinoSessionEmbed,
    casinoSessionSummaryEmbed,
    casinoCooldownBlockedEmbed
} = require("../../utils/embedFactory");

const {
    betSelectRow,
    startButtonRow,
    cooldownRow,
    validateBet
} = require("../../utils/casinoSessionUI");

const {
    pickRaceField,
    runRace,
    ownsHorse,
    buyHorse,
    getOwnedHorses,
    recordRace,
    getHorseById,
    HORSES
} = require("../../services/horseService");

const { addCoins, getCoins, hasEnoughCoins } = require("../../services/coinService");
const { recordBet } = require("../../services/casinoStatsService");
const { getUser } = require("../../services/userService");
const { npcLineForGame } = require("../../services/casinoNpcService");
const { contribute: contributeJackpot } = require("../../services/jackpotService");
const { getRandomCooldown, getSessionStats, awardGameXP, logGameResult, checkCooldown, startCooldown, clearCooldown } = require("../../services/casinoService");
const { unlockAchievement, giveAchievementRewards } = require("../../services/achievementService");
const { HORSE, CASINO_SESSION } = require("../../config/gameConfig");

const GAME_TITLE = "🐎 WHISPERS DERBY — Dealer Luca";
const GAME_LABEL = "Horse Racing";


function horsePickRow(field, selectedId = null) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("horse_pick_select")
        .setPlaceholder("Pick your horse...")
        .addOptions(field.map(h => ({
            label: h.name,
            description: `${h.odds}x payout`,
            value: h.id,
            default: h.id === selectedId
        })));
    return new ActionRowBuilder().addComponents(menu);
}

function fieldLines(field, winnerId = null) {
    return field.map(h => {
        const marker = winnerId === h.id ? " 🏆" : "";
        return `🏇 ${h.name.padEnd(15)} ${h.odds}x${marker}`;
    });
}


module.exports = {

    data: new SlashCommandBuilder()
        .setName("horse")
        .setDescription("🐎 Bet on the Whispers Derby, or buy your own horse")
        .addSubcommand(sub =>
            sub.setName("race").setDescription("Sit down at the Whispers Derby")
        )
        .addSubcommand(sub =>
            sub
                .setName("buy")
                .setDescription(`Buy a horse (${HORSE.OWNERSHIP_COST.toLocaleString()} coins)`)
                .addStringOption(option =>
                    option.setName("horse").setDescription("Which horse to buy").setRequired(true)
                        .addChoices(...HORSES.map(h => ({ name: h.name, value: h.id })))
                )
        )
        .addSubcommand(sub => sub.setName("stable").setDescription("View the horses you own")),

    async execute(interaction) {

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "buy") return this.handleBuy(interaction);
        if (subcommand === "stable") return this.handleStable(interaction);
        return this.handleRaceSession(interaction);

    },

    async handleBuy(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;
        const horseId = interaction.options.getString("horse");
        const horse = getHorseById(horseId);

        getUser(userId, username);

        if (ownsHorse(userId, horseId)) {
            return interaction.reply({ content: `❌ You already own **${horse.name}**.`, flags: MessageFlags.Ephemeral });
        }

        if (!hasEnoughCoins(userId, HORSE.OWNERSHIP_COST)) {
            return interaction.reply({
                content: `❌ Buying **${horse.name}** costs ${HORSE.OWNERSHIP_COST.toLocaleString()} coins. Your balance: ${getCoins(userId).toLocaleString()} coins.`,
                flags: MessageFlags.Ephemeral
            });
        }

        addCoins(userId, username, -HORSE.OWNERSHIP_COST);
        buyHorse(userId, horseId);

        if (unlockAchievement(userId, "CASINO_HORSE_OWNER")) {
            giveAchievementRewards(userId, "CASINO_HORSE_OWNER");
        }

        return interaction.reply({
            content: `🐎 You bought **${horse.name}** for ${HORSE.OWNERSHIP_COST.toLocaleString()} coins! ` +
                `They'll now race with a +${Math.round(HORSE.OWNER_WIN_BONUS * 100)}% win chance boost when you bet on them.`
        });

    },

    async handleStable(interaction) {

        const userId = interaction.user.id;
        const owned = getOwnedHorses(userId);

        if (!owned.length) {
            return interaction.reply({ content: "🐎 You don't own any horses yet. Use `/horse buy` to start your stable.", flags: MessageFlags.Ephemeral });
        }

        const lines = owned.map(h => {
            const horse = getHorseById(h.horse_id);
            const winRate = h.races > 0 ? Math.round((h.wins / h.races) * 100) : 0;
            return `🐎 **${horse ? horse.name : h.horse_id}** — ${h.races} races, ${winRate}% win rate`;
        }).join("\n");

        return interaction.reply({ content: `🐎 **Your Stable**\n\n${lines}` });

    },

    async handleRaceSession(interaction) {

        const userId = interaction.user.id;
        const username = interaction.user.username;

        getUser(userId, username);

        const cooldown = checkCooldown(userId, "horse");

        if (cooldown.onCooldown) {

            const { embed, files } = casinoCooldownBlockedEmbed("Horse Racing", cooldown.untilUnix);
            return interaction.reply({ embeds: [embed], files, flags: MessageFlags.Ephemeral });

        }

        await interaction.deferReply();

        const field = pickRaceField();

        // ---------------- Setup: horse pick + bet amount ----------------

        let chosenHorseId = null;
        let betAmount = null;

        const renderSetup = () => {
            const chosen = chosenHorseId ? getHorseById(chosenHorseId) : null;
            const { embed, files } = casinoSetupEmbed(GAME_TITLE, [
                { label: "Your Pick", value: chosen ? `${chosen.name} (${chosen.odds}x)` : null },
                { label: "Bet Amount", value: betAmount ? `${betAmount.toLocaleString()} coins` : null }
            ]);
            embed.addFields({ name: "Field", value: fieldLines(field).join("\n"), inline: false });
            return {
                embeds: [embed], files,
                components: [
                    horsePickRow(field, chosenHorseId),
                    betSelectRow("horse_bet_select", betAmount),
                    startButtonRow("horse_start", Boolean(chosenHorseId && betAmount))
                ]
            };
        };

        await interaction.editReply(renderSetup());
        let message = await interaction.fetchReply();
        let setupDone = false;

        while (!setupDone) {

            let choice;
            try {
                choice = await message.awaitMessageComponent({ time: CASINO_SESSION.SETUP_TIMEOUT_MS, filter: i => i.user.id === userId });
            } catch (err) {
                return interaction.editReply({ content: "⌛ Setup timed out.", embeds: [], components: [] });
            }

            if (choice.customId === "horse_pick_select") {

                chosenHorseId = choice.values[0];
                await choice.update(renderSetup());

            } else if (choice.customId === "horse_bet_select") {

                const check = validateBet(userId, parseInt(choice.values[0], 10), getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                } else {
                    betAmount = check.amount;
                    await choice.update(renderSetup());
                }

            } else if (choice.customId === "horse_start") {

                if (!chosenHorseId || !betAmount) { await choice.deferUpdate(); continue; }

                const check = validateBet(userId, betAmount, getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                    continue;
                }

                await choice.deferUpdate();
                setupDone = true;

            }

            message = await interaction.fetchReply();

        }

        // ---------------- Playing ----------------

        const plays = [];
        let racesLeft = CASINO_SESSION.MAX_PLAYS_PER_SESSION;
        let raceNumber = 0;
        let cooldownUntil = null;
        let cooldownLabel = null;

        const renderPlaying = (extra = {}) => {

            const chosen = getHorseById(chosenHorseId);
            const cooldown = cooldownUntil
                ? { seconds: 0, label: cooldownLabel, untilUnix: Math.ceil(cooldownUntil / 1000) }
                : null;

            const bodyLines = extra.winner
                ? [`🏆 **${extra.winner.name}** WINS!`, "", ...fieldLines(field, extra.winner.id)]
                : ["Field:", ...fieldLines(field)];

            const { embed, files } = casinoSessionEmbed({
                title: GAME_TITLE,
                roundLabel: `Race #${raceNumber}`,
                betLine: `${betAmount.toLocaleString()} coins (${chosen.name} - ${chosen.odds}x)`,
                balance: getCoins(userId),
                playsLeft: racesLeft,
                maxPlays: CASINO_SESSION.MAX_PLAYS_PER_SESSION,
                playsLabel: "Races Left",
                bodyLines,
                resultLine: extra.resultLine || null,
                color: extra.color || 0x9B59B6,
                cooldown,
                npcLine: extra.npcLine || null
            });

            const components = cooldown
                ? [cooldownRow("horse_leave")]
                : [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("horse_race").setLabel("🏇 RACE").setStyle(ButtonStyle.Success).setDisabled(racesLeft <= 0),
                    new ButtonBuilder().setCustomId("horse_change_pick").setLabel("🐎 Change Pick").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("horse_change_bet").setLabel("💰 Change Bet").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("horse_leave").setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
                  )];

            return { embeds: [embed], files, components };

        };

        await interaction.editReply(renderPlaying());
        message = await interaction.fetchReply();

        let leftSession = false;

        while (!leftSession) {

            const waitTime = cooldownUntil ? Math.max(1000, cooldownUntil - Date.now()) : CASINO_SESSION.SESSION_IDLE_TIMEOUT_MS;

            let choice;
            try {
                choice = await message.awaitMessageComponent({ time: waitTime, filter: i => i.user.id === userId });
            } catch (err) {

                if (cooldownUntil && Date.now() >= cooldownUntil) {
                    racesLeft = CASINO_SESSION.MAX_PLAYS_PER_SESSION;
                    cooldownUntil = null;
                    cooldownLabel = null;
                    clearCooldown(userId, "horse");
                    await interaction.editReply(renderPlaying());
                    message = await interaction.fetchReply();
                    continue;
                }

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await interaction.editReply({ embeds: [embed], files, components: [] });
                return;

            }

            if (choice.customId === "horse_leave") {

                const stats = getSessionStats(plays);
                const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                await choice.update({ embeds: [embed], files, components: [] });
                leftSession = true;
                continue;

            }

            if (choice.customId === "horse_change_pick") {

                const chosen = getHorseById(chosenHorseId);
                const setupView = casinoSetupEmbed(GAME_TITLE, [{ label: "Your Pick", value: `${chosen.name} (${chosen.odds}x)` }]);
                await choice.update({ embeds: [setupView.embed], files: setupView.files, components: [horsePickRow(field, chosenHorseId)] });
                message = await interaction.fetchReply();

                let chosenPick = false;
                while (!chosenPick) {

                    let pickChoice;
                    try {
                        pickChoice = await message.awaitMessageComponent({ time: CASINO_SESSION.SETUP_TIMEOUT_MS, filter: i => i.user.id === userId });
                    } catch (err) {
                        const stats = getSessionStats(plays);
                        const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                        await interaction.editReply({ embeds: [embed], files, components: [] });
                        return;
                    }

                    chosenHorseId = pickChoice.values[0];
                    await pickChoice.update(renderPlaying());
                    message = await interaction.fetchReply();
                    chosenPick = true;

                }

                continue;

            }

            if (choice.customId === "horse_change_bet") {

                const setupView = casinoSetupEmbed(GAME_TITLE, [{ label: "Bet Amount", value: `${betAmount.toLocaleString()} coins` }]);
                await choice.update({ embeds: [setupView.embed], files: setupView.files, components: [betSelectRow("horse_bet_select", betAmount)] });
                message = await interaction.fetchReply();

                let betChosen = false;
                while (!betChosen) {

                    let betChoice;
                    try {
                        betChoice = await message.awaitMessageComponent({ time: CASINO_SESSION.SETUP_TIMEOUT_MS, filter: i => i.user.id === userId });
                    } catch (err) {
                        const stats = getSessionStats(plays);
                        const { embed, files } = casinoSessionSummaryEmbed(GAME_LABEL, stats);
                        await interaction.editReply({ embeds: [embed], files, components: [] });
                        return;
                    }

                    const check = validateBet(userId, parseInt(betChoice.values[0], 10), getCoins);
                    if (!check.ok) {
                        await betChoice.deferUpdate();
                        await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                    } else {
                        betAmount = check.amount;
                        await betChoice.update(renderPlaying());
                        message = await interaction.fetchReply();
                        betChosen = true;
                    }

                }

                continue;

            }

            if (choice.customId === "horse_race") {

                if (racesLeft <= 0 || cooldownUntil) { await choice.deferUpdate(); continue; }

                const check = validateBet(userId, betAmount, getCoins);
                if (!check.ok) {
                    await choice.deferUpdate();
                    await interaction.followUp({ content: check.message, flags: MessageFlags.Ephemeral });
                    continue;
                }

                raceNumber += 1;

                const chosenHorse = getHorseById(chosenHorseId);
                const winner = runRace(field, userId);
                const won = winner.id === chosenHorse.id;

                let payoutMultiplier = chosenHorse.odds;
                if (won && ownsHorse(userId, chosenHorse.id)) {
                    payoutMultiplier *= (1 + HORSE.OWNER_PAYOUT_BONUS);
                }

                let netChange;
                let payout = 0;

                if (won) {
                    payout = Math.round(betAmount * payoutMultiplier);
                    netChange = payout - betAmount;
                    addCoins(userId, username, netChange);
                } else {
                    netChange = -betAmount;
                    addCoins(userId, username, netChange);
                }

                plays.push({ wagered: betAmount, won: won ? payout : 0 });
                racesLeft -= 1;

                recordBet(userId, "horse", betAmount, netChange, won);
                awardGameXP(userId, won, netChange);
                logGameResult(userId, "horse", betAmount, won ? "win" : "loss", plays[plays.length - 1].won);
                recordRace(userId, chosenHorse.id, won);
                contributeJackpot(betAmount);

                const npcLine = npcLineForGame("horse", won ? "win" : "lose");

                const resultLine = won
                    ? `Your Pick: ${chosenHorse.name} ✅\nYou win! +${payout.toLocaleString()} coins! (${payoutMultiplier.toFixed(1)}x)`
                    : `Your Pick: ${chosenHorse.name} ❌\nYou lost ${betAmount.toLocaleString()} coins.`;

                if (racesLeft <= 0) {
                    const c = getRandomCooldown();
                    cooldownUntil = startCooldown(userId, "horse", c.seconds);
                    cooldownLabel = c.label;
                }

                await choice.update(renderPlaying({
                    winner,
                    resultLine,
                    color: won ? 0x57F287 : 0xED4245,
                    npcLine
                }));

                message = await interaction.fetchReply();

            }

        }

    }

};
