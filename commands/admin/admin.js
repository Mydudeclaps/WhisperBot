const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder
} = require("discord.js");

const { isBotAdmin } = require("../../services/adminService");

const { logAdminAction } = require("../../utils/adminLogger");

const {
    getCoins,
    setCoins,
    addCoins
} = require("../../services/coinService");

const {
    addItem,
    removeItem,
    clearInventory,
    getInventory
} = require("../../services/inventoryService");

const {
    getStats,
    resetStats
} = require("../../social-engine/models/SocialStats");


module.exports = {

    data: new SlashCommandBuilder()
        .setName("admin")
        .setDescription("Admin tools for managing player coins, inventory, and stats")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // ── /admin coins ──────────────────────────────────────────
        .addSubcommandGroup(group =>
            group
                .setName("coins")
                .setDescription("Manage a player's coin balance")
                .addSubcommand(sub =>
                    sub
                        .setName("add")
                        .setDescription("Add coins to a player")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                        .addIntegerOption(opt => opt.setName("amount").setDescription("Amount to add").setRequired(true).setMinValue(1))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("remove")
                        .setDescription("Remove coins from a player")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                        .addIntegerOption(opt => opt.setName("amount").setDescription("Amount to remove").setRequired(true).setMinValue(1))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("set")
                        .setDescription("Set a player's coins to an exact amount")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                        .addIntegerOption(opt => opt.setName("amount").setDescription("Exact coin amount").setRequired(true).setMinValue(0))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("view")
                        .setDescription("View a player's coin balance")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                )
        )

        // ── /admin inventory ──────────────────────────────────────
        .addSubcommandGroup(group =>
            group
                .setName("inventory")
                .setDescription("Manage a player's inventory")
                .addSubcommand(sub =>
                    sub
                        .setName("give")
                        .setDescription("Give an item to a player")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                        .addStringOption(opt => opt.setName("item").setDescription("Item name/id").setRequired(true))
                        .addIntegerOption(opt => opt.setName("quantity").setDescription("Quantity").setRequired(true).setMinValue(1))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("remove")
                        .setDescription("Remove an item from a player")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                        .addStringOption(opt => opt.setName("item").setDescription("Item name/id").setRequired(true))
                        .addIntegerOption(opt => opt.setName("quantity").setDescription("Quantity").setRequired(true).setMinValue(1))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("clear")
                        .setDescription("Clear a player's entire inventory")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                        .addBooleanOption(opt => opt.setName("confirm").setDescription("Confirm this destructive action").setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("view")
                        .setDescription("View a player's inventory")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                )
        )

        // ── /admin stats ──────────────────────────────────────────
        .addSubcommandGroup(group =>
            group
                .setName("stats")
                .setDescription("Manage a player's social stats")
                .addSubcommand(sub =>
                    sub
                        .setName("view")
                        .setDescription("View a player's social stats")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("reset")
                        .setDescription("Reset a player's social stats")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                        .addBooleanOption(opt => opt.setName("confirm").setDescription("Confirm this destructive action").setRequired(true))
                )
        )

        // ── /admin reset ──────────────────────────────────────────
        .addSubcommandGroup(group =>
            group
                .setName("reset")
                .setDescription("Reset player data")
                .addSubcommand(sub =>
                    sub
                        .setName("coins")
                        .setDescription("Reset a player's coins to 0")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                        .addBooleanOption(opt => opt.setName("confirm").setDescription("Confirm this destructive action").setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("inventory")
                        .setDescription("Clear a player's inventory")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                        .addBooleanOption(opt => opt.setName("confirm").setDescription("Confirm this destructive action").setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("stats")
                        .setDescription("Reset a player's social stats")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                        .addBooleanOption(opt => opt.setName("confirm").setDescription("Confirm this destructive action").setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName("all")
                        .setDescription("⚠️ Hard reset ALL data for a player (coins, inventory, stats)")
                        .addUserOption(opt => opt.setName("user").setDescription("Player").setRequired(true))
                        .addBooleanOption(opt => opt.setName("confirm").setDescription("Confirm this destructive action").setRequired(true))
                )
        ),


    async execute(interaction) {


        if (!isBotAdmin(interaction.member)) {

            return interaction.reply({
                content: "❌ You do not have permission to use this command.",
                flags: MessageFlags.Ephemeral
            });

        }


        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();

        if (group === "coins") return handleCoins(interaction, sub);
        if (group === "inventory") return handleInventory(interaction, sub);
        if (group === "stats") return handleStats(interaction, sub);
        if (group === "reset") return handleReset(interaction, sub);

        return interaction.reply({
            content: "❌ Unknown admin command.",
            flags: MessageFlags.Ephemeral
        });

    }

};


// ── Coins ────────────────────────────────────────────────────────

async function handleCoins(interaction, sub) {

    const target = interaction.options.getUser("user");

    if (sub === "view") {

        const balance = getCoins(target.id);

        return interaction.reply({
            embeds: [successEmbed(`💰 ${target.username} has **${balance}** coins.`)],
            flags: MessageFlags.Ephemeral
        });

    }

    const amount = interaction.options.getInteger("amount");

    if (sub === "add") {

        const newBalance = addCoins(target.id, target.username, amount);

        await logAdminAction(interaction, "Coins Add", target, `+${amount} coins → new balance: ${newBalance}`);

        return interaction.reply({
            embeds: [successEmbed(`✅ Added **${amount}** coins to ${target.username}.\nNew balance: **${newBalance}**`)],
            flags: MessageFlags.Ephemeral
        });

    }

    if (sub === "remove") {

        const current = getCoins(target.id);

        if (amount > current) {

            return interaction.reply({
                embeds: [errorEmbed(`❌ ${target.username} only has **${current}** coins — can't remove **${amount}**.`)],
                flags: MessageFlags.Ephemeral
            });

        }

        const newBalance = addCoins(target.id, target.username, -amount);

        await logAdminAction(interaction, "Coins Remove", target, `-${amount} coins → new balance: ${newBalance}`);

        return interaction.reply({
            embeds: [successEmbed(`✅ Removed **${amount}** coins from ${target.username}.\nNew balance: **${newBalance}**`)],
            flags: MessageFlags.Ephemeral
        });

    }

    if (sub === "set") {

        const oldBalance = getCoins(target.id);
        const newBalance = setCoins(target.id, target.username, amount);

        await logAdminAction(interaction, "Coins Set", target, `${oldBalance} → ${newBalance}`);

        return interaction.reply({
            embeds: [successEmbed(`✅ Set ${target.username}'s coins to **${newBalance}**.\n(was ${oldBalance})`)],
            flags: MessageFlags.Ephemeral
        });

    }

}


// ── Inventory ────────────────────────────────────────────────────

async function handleInventory(interaction, sub) {

    const target = interaction.options.getUser("user");

    if (sub === "view") {

        const items = getInventory(target.id);

        if (!items.length) {

            return interaction.reply({
                embeds: [successEmbed(`📦 ${target.username}'s inventory is empty.`)],
                flags: MessageFlags.Ephemeral
            });

        }

        const list = items
            .map(row => `• **${row.item}** × ${row.amount}`)
            .join("\n");

        return interaction.reply({
            embeds: [successEmbed(`📦 ${target.username}'s inventory:\n${list}`)],
            flags: MessageFlags.Ephemeral
        });

    }

    if (sub === "clear") {

        if (!interaction.options.getBoolean("confirm")) {

            return interaction.reply({
                embeds: [errorEmbed("❌ You must pass `confirm:true` to clear a player's inventory.")],
                flags: MessageFlags.Ephemeral
            });

        }

        clearInventory(target.id);

        await logAdminAction(interaction, "Inventory Clear", target, "Entire inventory cleared");

        return interaction.reply({
            embeds: [successEmbed(`✅ Cleared ${target.username}'s inventory.`)],
            flags: MessageFlags.Ephemeral
        });

    }

    const item = interaction.options.getString("item");
    const quantity = interaction.options.getInteger("quantity");

    if (sub === "give") {

        addItem(target.id, item, quantity);

        await logAdminAction(interaction, "Inventory Give", target, `+${quantity} × ${item}`);

        return interaction.reply({
            embeds: [successEmbed(`✅ Gave **${quantity} × ${item}** to ${target.username}.`)],
            flags: MessageFlags.Ephemeral
        });

    }

    if (sub === "remove") {

        removeItem(target.id, item, quantity);

        await logAdminAction(interaction, "Inventory Remove", target, `-${quantity} × ${item}`);

        return interaction.reply({
            embeds: [successEmbed(`✅ Removed **${quantity} × ${item}** from ${target.username}.`)],
            flags: MessageFlags.Ephemeral
        });

    }

}


// ── Stats ────────────────────────────────────────────────────────

async function handleStats(interaction, sub) {

    const target = interaction.options.getUser("user");

    if (sub === "view") {

        const stats = getStats(target.id);

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle(`📊 Social Stats — ${target.username}`)
            .addFields(
                { name: "Total Interactions", value: String(stats.totalInteractions), inline: true },
                { name: "Combos Triggered", value: String(stats.combosTriggered), inline: true },
                { name: "Highest Combo", value: String(stats.highestCombo), inline: true },
                { name: "NPC Interactions", value: String(stats.npcInteractions), inline: true },
                { name: "Plot Twists Witnessed", value: String(stats.plotTwistsWitnessed), inline: true },
                { name: "Achievements Unlocked", value: String(stats.achievementsUnlocked.length), inline: true },
                { name: "Titles Unlocked", value: String(stats.titlesUnlocked.length), inline: true },
                { name: "Active Title", value: stats.activeTitle || "None", inline: true },
                { name: "Favorite Command", value: stats.favoriteCommand || "None", inline: true }
            );

        return interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });

    }

    if (sub === "reset") {

        if (!interaction.options.getBoolean("confirm")) {

            return interaction.reply({
                embeds: [errorEmbed("❌ You must pass `confirm:true` to reset a player's stats.")],
                flags: MessageFlags.Ephemeral
            });

        }

        resetStats(target.id);

        await logAdminAction(interaction, "Stats Reset", target, "Social stats reset to defaults");

        return interaction.reply({
            embeds: [successEmbed(`✅ Reset ${target.username}'s social stats.`)],
            flags: MessageFlags.Ephemeral
        });

    }

}


// ── Reset ────────────────────────────────────────────────────────

async function handleReset(interaction, sub) {

    const target = interaction.options.getUser("user");
    const confirmed = interaction.options.getBoolean("confirm");

    if (!confirmed) {

        return interaction.reply({
            embeds: [errorEmbed("❌ You must pass `confirm:true` for this destructive action.")],
            flags: MessageFlags.Ephemeral
        });

    }

    if (sub === "coins") {

        setCoins(target.id, target.username, 0);

        await logAdminAction(interaction, "Reset Coins", target, "Coins reset to 0");

        return interaction.reply({
            embeds: [successEmbed(`✅ Reset ${target.username}'s coins to 0.`)],
            flags: MessageFlags.Ephemeral
        });

    }

    if (sub === "inventory") {

        clearInventory(target.id);

        await logAdminAction(interaction, "Reset Inventory", target, "Inventory cleared");

        return interaction.reply({
            embeds: [successEmbed(`✅ Cleared ${target.username}'s inventory.`)],
            flags: MessageFlags.Ephemeral
        });

    }

    if (sub === "stats") {

        resetStats(target.id);

        await logAdminAction(interaction, "Reset Stats", target, "Social stats reset to defaults");

        return interaction.reply({
            embeds: [successEmbed(`✅ Reset ${target.username}'s social stats.`)],
            flags: MessageFlags.Ephemeral
        });

    }

    if (sub === "all") {

        setCoins(target.id, target.username, 0);
        clearInventory(target.id);
        resetStats(target.id);

        await logAdminAction(interaction, "Reset ALL", target, "Coins, inventory, and stats all reset");

        return interaction.reply({
            embeds: [successEmbed(`⚠️ Hard reset complete for ${target.username}.\nCoins, inventory, and stats have all been cleared.`)],
            flags: MessageFlags.Ephemeral
        });

    }

}


// ── Embed helpers ────────────────────────────────────────────────

function successEmbed(description) {

    return new EmbedBuilder()
        .setColor(0x2ECC71)
        .setDescription(description);

}


function errorEmbed(description) {

    return new EmbedBuilder()
        .setColor(0xE74C3C)
        .setDescription(description);

}
