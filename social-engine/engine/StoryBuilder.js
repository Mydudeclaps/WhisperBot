const { pickRandom, fillTemplate, rollChance } = require("../utils/helpers");
const NPCManager = require("./NPCManager");

// Combo flavor lines are keyed by the highest threshold met — checked
// highest-first so e.g. combo 12 gets the "10" line, not "2".
const COMBO_THRESHOLDS = [15, 10, 5, 3, 2];


function pickComboLine(commandData, combo) {

    if (!commandData.comboLines || combo < 2) return null;

    for (const threshold of COMBO_THRESHOLDS) {

        if (combo >= threshold && commandData.comboLines[threshold]) {
            return commandData.comboLines[threshold];
        }

    }

    return null;

}


// Builds the full 3-stage story for a normal (non-self) interaction.
// Returns:
//   {
//     stages: [{ stage, text, emoji }, ...],   // 3 entries, intro/action/outcome
//     emojiSet: [...],
//     plotTwist: string | null,
//     npc: { key, name, emoji, line } | null,
//     comboLine: string | null
//   }
function build(commandData, user, target, rarity, combo) {

    const userMention = `**${user.username}**`;
    const targetMention = `**${target.username}**`;
    const names = { user: userMention, target: targetMention };

    const emojiSet = commandData.emojiSets
        ? pickRandom(commandData.emojiSets)
        : ["✨"];

    const intro = fillTemplate(pickRandom(commandData.intros), names);
    const action = fillTemplate(pickRandom(commandData.actions), names);

    const endingsForRarity = commandData.endings[rarity] && commandData.endings[rarity].length
        ? commandData.endings[rarity]
        : commandData.endings.common;

    let outcomeText = fillTemplate(pickRandom(endingsForRarity), names);

    // Plot twists are a small independent roll on top of whatever rarity
    // was already selected — a rare/epic outcome can still twist.
    let plotTwist = null;

    if (commandData.plotTwists && commandData.plotTwists.length) {

        const chance = commandData.plotTwistChance || 1;

        if (rollChance(chance)) {
            plotTwist = fillTemplate(pickRandom(commandData.plotTwists), names);
            outcomeText = plotTwist;
        }

    }

    const npc = NPCManager.rollNPC(commandData);
    const comboLine = pickComboLine(commandData, combo);

    return {

        stages: [
            { stage: 1, text: intro, emoji: pickRandom(emojiSet) },
            { stage: 2, text: action, emoji: pickRandom(emojiSet) },
            { stage: 3, text: outcomeText, emoji: pickRandom(emojiSet) }
        ],

        emojiSet,
        plotTwist,
        npc,
        comboLine

    };

}


// Self-interactions (e.g. /hug @yourself) skip rarity/combo/NPC/plot
// twist entirely — they're a lightweight easter egg, not the full
// cinematic flow. Falls back to a generic line if a command doesn't
// define its own selfInteraction pool.
function buildSelf(commandData, user) {

    const userMention = `**${user.username}**`;

    const pool = commandData.selfInteraction && commandData.selfInteraction.length
        ? commandData.selfInteraction
        : [`{user} interacts with themselves. A little unusual, but okay!`];

    const text = fillTemplate(pickRandom(pool), { user: userMention, target: userMention });

    const emojiSet = commandData.emojiSets ? pickRandom(commandData.emojiSets) : ["✨"];

    return { text, emoji: pickRandom(emojiSet) };

}


module.exports = { build, buildSelf };
