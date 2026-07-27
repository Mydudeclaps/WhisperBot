const npcs = require("../data/npcs.json");
const { pickRandom, rollChance } = require("../utils/helpers");

// 2-5% chance per the design doc — we roll once per interaction inside
// that range so it stays surprising rather than a fixed number.
const NPC_CHANCE_MIN = 2;
const NPC_CHANCE_MAX = 5;


// Rolls whether an NPC interrupts this interaction. If a command supplies
// its own flavored `npcInteractions` (5+ per the content spec — see
// hug.json), those are preferred over the generic global pool so the
// interruption feels tailored to what just happened. Falls back to the
// global npcs.json pool otherwise.
//
// Returns null (no interruption) or { key, name, emoji, line }.
function rollNPC(commandData) {

    const chance = typeof commandData.npcChanceOverride === "number"
        ? commandData.npcChanceOverride
        : NPC_CHANCE_MIN + Math.random() * (NPC_CHANCE_MAX - NPC_CHANCE_MIN);

    if (!rollChance(chance)) return null;

    if (commandData.npcInteractions && commandData.npcInteractions.length > 0) {

        const pick = pickRandom(commandData.npcInteractions);
        const npc = npcs[pick.npc];

        if (npc) {

            return {
                key: pick.npc,
                name: npc.name,
                emoji: npc.emoji,
                line: pick.line
            };

        }

    }

    const keys = Object.keys(npcs);
    const key = pickRandom(keys);
    const npc = npcs[key];

    return {
        key,
        name: npc.name,
        emoji: npc.emoji,
        line: pickRandom(npc.interruptions)
    };

}


module.exports = { rollNPC };
