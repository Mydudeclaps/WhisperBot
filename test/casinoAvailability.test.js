const test = require("node:test");
const assert = require("node:assert/strict");

const {
    isPokerEnabled,
    isSlotMachineEnabled
} = require("../services/casinoAvailabilityService");

test("unsafe casino games are disabled by default", () => {

    assert.equal(isPokerEnabled(), false);
    assert.equal(isSlotMachineEnabled("kingdom"), false);

});

test("other slot machines remain enabled", () => {

    for (const machine of ["classic", "treasure", "fortune5", "mega3x3"]) {
        assert.equal(isSlotMachineEnabled(machine), true);
    }

});
