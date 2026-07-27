const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    MessageFlags
} = require("discord.js");

const ShopManager = require("../../shop-engine/engine/ShopManager");
const PurchaseManager = require("../../shop-engine/engine/PurchaseManager");
const { getRarityEmoji, stockLine, getItemImageAttachment } = require("../../shop-engine/utils/shopHelpers");
const { withThumbnail } = require("../../utils/embedFactory");

const SEPARATOR = "━━━━━━━━━━━━━━━━━━━━━━━━━━";
const SESSION_TIMEOUT_MS = 300000; // 5 minutes

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shop")
        .setDescription("🕊️ Visit the Whisper Marketplace"),

    async execute(interaction) {
        await interaction.deferReply();

        const stats = ShopManager.getPlayerStats(interaction.user.id, interaction.user.username);
        const { embed, files } = this.buildHubEmbed(stats);
        const rows = this.buildHubComponents();

        const reply = await interaction.editReply({ embeds: [embed], components: rows, files });

        // Per-invocation session state: which merchant/page the user is browsing.
        const session = { merchantKey: null, page: 0 };

        const collector = reply.createMessageComponentCollector({ time: SESSION_TIMEOUT_MS });

        collector.on("collect", async (i) => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: "❌ This shop is not for you.", flags: MessageFlags.Ephemeral });
            }

            try {
                if (i.customId === "shop_close") {
                    await i.update({ content: "🕊️ Marketplace closed. Visit again soon!", embeds: [], components: [], files: [] });
                    collector.stop("closed");
                    return;
                }

                if (i.customId === "shop_back") {
                    session.merchantKey = null;
                    session.page = 0;
                    const freshStats = ShopManager.getPlayerStats(i.user.id, i.user.username);
                    const { embed: hubEmbed, files: hubFiles } = this.buildHubEmbed(freshStats);
                    await i.update({ embeds: [hubEmbed], components: this.buildHubComponents(), files: hubFiles });
                    return;
                }

                if (i.customId.startsWith("shop_merchant_")) {
                    session.merchantKey = i.customId.replace("shop_merchant_", "");
                    session.page = 0;
                    await this.renderMerchant(i, session);
                    return;
                }

                if (i.customId === "shop_prev") {
                    session.page = Math.max(0, session.page - 1);
                    await this.renderMerchant(i, session);
                    return;
                }

                if (i.customId === "shop_next") {
                    session.page += 1;
                    await this.renderMerchant(i, session);
                    return;
                }

                if (i.customId === "shop_buy_select") {
                    const itemId = i.values[0];
                    await this.handlePurchase(i, session, itemId);
                    return;
                }
            } catch (err) {
                console.error("[shop] collector error:", err);
                if (!i.replied && !i.deferred) {
                    await i.reply({ content: "⚠️ Something went wrong with the marketplace. Please try again.", flags: MessageFlags.Ephemeral }).catch(() => {});
                }
            }
        });

        collector.on("end", (_collected, reason) => {
            if (reason === "closed") return;
            interaction.editReply({ components: [] }).catch(() => {});
        });
    },

    // ---------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------

    buildHubEmbed(stats) {
        const embed = new EmbedBuilder()
            .setColor(0x2C2F33)
            .setTitle("🕊️ Whisper Marketplace")
            .setDescription(
                "Welcome, traveler.\n\n" +
                "The marketplace is filled with merchants from every corner\n" +
                "of the Whisper Realm. Browse their wares, discover rare\n" +
                "collectibles, and prepare for the adventures ahead.\n\n" +
                `${SEPARATOR}\n\n` +
                `💰 Coins: **${stats.coins.toLocaleString()}**\n` +
                `🎒 Items Owned: **${stats.itemsOwned}**\n` +
                `⭐ Kingdom Reputation: **${stats.reputation}**\n\n` +
                `${SEPARATOR}\n\n` +
                "Choose a shop below."
            )
            .setFooter({ text: "WhisperBot • Marketplace" })
            .setTimestamp();

        return withThumbnail(embed, "shop");
    },

    buildHubComponents() {
        const merchants = Object.values(ShopManager.getMerchants());
        const rows = [];

        for (let i = 0; i < merchants.length; i += 3) {
            const chunk = merchants.slice(i, i + 3);
            const row = new ActionRowBuilder();
            chunk.forEach(merchant => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`shop_merchant_${merchant.key}`)
                        .setLabel(merchant.name)
                        .setEmoji(merchant.emoji)
                        .setStyle(ButtonStyle.Secondary)
                );
            });
            rows.push(row);
        }

        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("shop_close").setLabel("Close").setEmoji("❌").setStyle(ButtonStyle.Danger)
        ));

        return rows;
    },

    async renderMerchant(i, session) {
        const merchant = ShopManager.getMerchant(session.merchantKey);
        if (!merchant) {
            await i.update({ content: "❌ Merchant not found.", embeds: [], components: [], files: [] });
            return;
        }

        const stats = ShopManager.getPlayerStats(i.user.id, i.user.username);
        const { items, page, totalPages } = ShopManager.getMerchantItemsPage(session.merchantKey, session.page);
        session.page = page; // clamp back into session in case it was out of range

        const embed = new EmbedBuilder()
            .setColor(merchant.color)
            .setTitle(`${merchant.emoji} ${merchant.name}`)
            .setDescription(
                `${merchant.greeting}\n\n` +
                `*${merchant.description}*\n\n` +
                `${SEPARATOR}\n\n` +
                `💰 Your Coins: **${stats.coins.toLocaleString()}**\n` +
                `⭐ Kingdom Reputation: **${stats.reputation}**\n\n` +
                `${SEPARATOR}\n\n` +
                this.formatItems(items)
            )
            .setFooter({ text: `Page ${page + 1}/${totalPages} • ${merchant.name}` })
            .setTimestamp();

        const firstItemWithImage = items.find(item => item.image);
        const attachment = getItemImageAttachment(firstItemWithImage);
        const attachments = [];

        if (attachment) {
            embed.setThumbnail(`attachment://${attachment.name}`);
            attachments.push(attachment);
        }

        const rows = this.buildMerchantComponents(items, page, totalPages);

        await i.update({ embeds: [embed], components: rows, files: attachments });
    },

    buildMerchantComponents(items, page, totalPages) {
        const navRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("shop_back").setLabel("⬅ Back").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("shop_prev").setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
            new ButtonBuilder().setCustomId("shop_next").setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
            new ButtonBuilder().setCustomId("shop_close").setLabel("❌ Close").setStyle(ButtonStyle.Danger)
        );

        const rows = [navRow];

        const purchasable = items.filter(item => item.current_stock > 0);
        if (purchasable.length > 0) {
            const select = new StringSelectMenuBuilder()
                .setCustomId("shop_buy_select")
                .setPlaceholder("🛒 Select an item to buy")
                .addOptions(purchasable.map(item => ({
                    label: `${item.name} — ${item.price.toLocaleString()} coins`,
                    description: item.description.slice(0, 100),
                    value: item.id,
                    emoji: item.emoji
                })));
            rows.push(new ActionRowBuilder().addComponents(select));
        }

        return rows;
    },

    formatItems(items) {
        if (!items || items.length === 0) {
            return "*No items available at this time.*";
        }

        return items.map(item => {
            return `${item.emoji} **${item.name}** ${getRarityEmoji(item.rarity)}\n` +
                   `*${item.description}*\n` +
                   `💰 ${item.price.toLocaleString()} coins • ${stockLine(item)}\n`;
        }).join("\n");
    },

    // ---------------------------------------------------------------------
    // Purchasing
    // ---------------------------------------------------------------------

    async handlePurchase(i, session, itemId) {
        const result = await PurchaseManager.purchase(i.user.id, i.user.username, itemId, 1);

        if (!result.success) {
            const message = {
                not_found: "❌ That item no longer exists.",
                invalid_quantity: "❌ Invalid quantity.",
                insufficient_funds: "❌ You don't have enough coins for that.",
                out_of_stock: "❌ That item just sold out — someone beat you to it!",
                payment_failed: "⚠️ Payment failed. You were not charged.",
                inventory_failed: "⚠️ Could not add the item to your inventory. You were not charged."
            }[result.reason] || "⚠️ Purchase failed. Please try again.";

            await i.reply({ content: message, flags: MessageFlags.Ephemeral });
            return;
        }

        await i.reply({
            content: `✅ Purchased **${result.item.name}** ${result.item.emoji} for **${result.totalPrice.toLocaleString()} coins**. ` +
                      `Balance: **${result.newBalance.toLocaleString()} coins**.`,
            flags: MessageFlags.Ephemeral
        });

        // Refresh the underlying shop message so stock/coins reflect the purchase.
        const merchant = ShopManager.getMerchant(session.merchantKey);
        if (!merchant) return;

        const stats = ShopManager.getPlayerStats(i.user.id, i.user.username);
        const { items, page, totalPages } = ShopManager.getMerchantItemsPage(session.merchantKey, session.page);

        const embed = new EmbedBuilder()
            .setColor(merchant.color)
            .setTitle(`${merchant.emoji} ${merchant.name}`)
            .setDescription(
                `${merchant.greeting}\n\n` +
                `*${merchant.description}*\n\n` +
                `${SEPARATOR}\n\n` +
                `💰 Your Coins: **${stats.coins.toLocaleString()}**\n` +
                `⭐ Kingdom Reputation: **${stats.reputation}**\n\n` +
                `${SEPARATOR}\n\n` +
                this.formatItems(items)
            )
            .setFooter({ text: `Page ${page + 1}/${totalPages} • ${merchant.name}` })
            .setTimestamp();

        const firstItemWithImage = items.find(item => item.image);
        const attachment = getItemImageAttachment(firstItemWithImage);
        const attachments = [];

        if (attachment) {
            embed.setThumbnail(`attachment://${attachment.name}`);
            attachments.push(attachment);
        }

        const rows = this.buildMerchantComponents(items, page, totalPages);

        await i.message.edit({ embeds: [embed], components: rows, files: attachments }).catch(() => {});
    }
};
