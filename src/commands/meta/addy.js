import { Command } from '#command';
import {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
        ApplicationCommandOptionType,
} from 'discord.js';
import { resolveChain, CHAINS } from '#utils';
import { db } from '#dbManager';

const FEATURED = ['btc', 'eth', 'ltc', 'sol', 'trx', 'xrp'];

const ALL_CHOICES = Object.entries(CHAINS).map(([key, chain]) => ({
        name: `${chain.name} (${chain.symbol})`,
        value: key,
}));

const FEATURED_CHOICES = FEATURED.map(key => ({
        name: `${CHAINS[key].name} (${CHAINS[key].symbol})`,
        value: key,
}));

class AddyCommand extends Command {
        constructor() {
                super({
                        name: 'addy',
                        description: 'View your saved wallet address for a coin',
                        cooldown: 5,
                        enabledSlash: true,
                        shouldNotDefer: true,
                        slashData: {
                                name: 'addy',
                                description: 'View your saved wallet address for a coin',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'crypto',
                                                description: 'Coin to view your saved address for',
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
                const chainCfg = resolveChain(chainInput);

                if (!chainCfg) {
                        return ctx.reply({
                                components: [this._msgContainer(`**\`${chainInput}\` is not a recognised coin.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const address = await db.user.getAddress(ctx.user.id, chainCfg.key);

                if (!address) {
                        return ctx.reply({
                                components: [this._msgContainer(`**No \`${chainCfg.symbol}\` address saved. Use \`/setaddy\`.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const customId = `addy_qr:${address}`;
                const showButton = customId.length <= 100;

                const components = showButton
                        ? [
                                new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                                .setCustomId(customId)
                                                .setLabel('Generate QR')
                                                .setStyle(ButtonStyle.Secondary),
                                ),
                          ]
                        : [];

                return ctx.reply({
                        content: `\`${address}\``,
                        components,
                });
        }

        _msgContainer(text) {
                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
        }
}

export default new AddyCommand();
