const { isFeatureEnabled } = require("./featureFlags");

function isPokerEnabled() {

    return isFeatureEnabled("casino_poker_enabled");

}

function isSlotMachineEnabled(machineKey) {

    if (machineKey === "kingdom") {
        return isFeatureEnabled("casino_kingdom_slots_enabled");
    }

    return true;

}

module.exports = { isPokerEnabled, isSlotMachineEnabled };
