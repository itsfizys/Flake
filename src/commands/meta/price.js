import { Command } from '#command';
import {
        ContainerBuilder,
        SectionBuilder,
        ThumbnailBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        MessageFlags,
        ApplicationCommandOptionType,
} from 'discord.js';
import { resolveChain, getPrice, formatUSD, CHAINS } from '#utils';
import { emoji } from '#emoji';

const FEATURED = ['btc', 'eth', 'ltc', 'sol', 'trx', 'xrp'];

const ALL_CHOICES = Object.entries(CHAINS).map(([key, chain]) => ({
        name: `${chain.name} (${chain.symbol})`,
        value: key,
}));

const FEATURED_CHOICES = FEATURED.map(key => ({
        name: `${CHAINS[key].name} (${CHAINS[key].symbol})`,
        value: key,
}));

function emojiImageUrl(emojiStr) {
        const m = (emojiStr || '').match(/<a?:.+?:(\d+)>/);
        return m ? `https://cdn.discordapp.com/emojis/${m[1]}.png` : null;
}

class PriceCommand extends Command {
        constructor() {
                super({
                        name: 'price',
                        description: 'Get live market price for a cryptocurrency',
                        cooldown: 5,
                        enabledSlash: true,
                        slashData: {
                                name: 'price',
                                description: 'Get live market price for a cryptocurrency',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'crypto',
                                                description: 'Coin to check the price of',
                                                required: true,
                                                autocomplete: true,
                                        },
                                ],
                        },
                });
        }

        async autocomplete({ interaction }) {
                const focused = interaction.options.getFocused().toLowerCase().trim();
                const matches = focused
                        ? ALL_CHOICES.filter(c =>
                                c.name.toLowerCase().includes(focused) ||
                                c.value.toLowerCase().includes(focused),
                          ).slice(0, 25)
                        : FEATURED_CHOICES;
                await interaction.respond(matches);
        }

        async execute({ ctx }) {
                const chainInput = ctx.options.getString('crypto');
                const chainCfg   = resolveChain(chainInput);

                if (!chainCfg) {
                        return ctx.reply({
                                components: [this._msgContainer(`**\`${chainInput}\` is not a recognised coin.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const { price, change24h } = await getPrice(chainCfg.key);

                if (!price) {
                        return ctx.reply({
                                components: [this._msgContainer(`**No price data available for \`${chainCfg.symbol}\`.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const priceStr    = formatUSD(price);
                const change24Abs = Math.abs(change24h).toFixed(2);
                const changeArrow = change24h >= 0 ? emoji.arrowup : emoji.arrowdown;

                const imageUrl  = emojiImageUrl(chainCfg.emoji);
                const container = new ContainerBuilder().setAccentColor(0xffffff);

                const headerText =
                        `## ${chainCfg.emoji}  ${chainCfg.name}  \`${chainCfg.symbol}\`\n` +
                        `-# Live market data`;

                if (imageUrl) {
                        container.addSectionComponents(
                                new SectionBuilder()
                                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
                                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(imageUrl)),
                        );
                } else {
                        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText));
                }

                container.addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                );

                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `**Price**\u2003\u2003\`${priceStr}\`\n` +
                                `**24h Change**\u2003\u2003${changeArrow} ${change24Abs}%`,
                        ),
                );

                return ctx.reply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                });
        }

        _msgContainer(text) {
                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
        }
}

export default new PriceCommand();
