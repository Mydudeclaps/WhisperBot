// Shared component builders for the "sit down and play" session pattern
// used by roulette, horse, blackjack, dice, highlow, and poker. Keeps the
// bet-amount dropdown, start button, and cooldown/leave row identical
// (and identically validated) across every game instead of six
// hand-rolled copies.
const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const { CASINO_SESSION } = require("../config/gameConfig");
const { maxBetFor } = require("../services/casinoService");


function betOptions() {

    return CASINO_SESSION.BET_OPTIONS.map(amount => ({
        label: `💰 ${amount.toLocaleString()} coins`,
        value: String(amount)
    }));

}


function betSelectRow(customId, selectedValue = null) {

    const menu = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder("Select Bet Amount")
        .addOptions(betOptions().map(o => ({ ...o, default: o.value === String(selectedValue) })));

    return new ActionRowBuilder().addComponents(menu);

}


function startButtonRow(customId, canStart) {

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel("▶ Start Playing")
            .setStyle(ButtonStyle.Success)
            .setDisabled(!canStart)
    );

}


// The row shown while a session is on cooldown — everything disabled
// except Leave.
function cooldownRow(leaveCustomId) {

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("waiting_disabled").setLabel("⏳ Waiting...").setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(leaveCustomId).setLabel("🚪 Leave").setStyle(ButtonStyle.Danger)
    );

}


// Validates a bet selection against balance + the dynamic 10%-of-balance
// cap. Returns { ok: true, amount } or { ok: false, message }.
function validateBet(userId, requestedAmount, getCoins) {

    const balance = getCoins(userId);
    const cap = maxBetFor(balance);

    if (requestedAmount > balance) {

        return { ok: false, message: `❌ Insufficient balance for this bet. Your balance: ${balance.toLocaleString()} coins.` };

    }

    if (requestedAmount > cap) {

        return { ok: false, message: `⚠️ Maximum bet right now is ${cap.toLocaleString()} coins (10% of your balance, capped at ${CASINO_SESSION.MAX_BET.toLocaleString()}).` };

    }

    return { ok: true, amount: requestedAmount };

}


module.exports = {
    betOptions,
    betSelectRow,
    startButtonRow,
    cooldownRow,
    validateBet
};
