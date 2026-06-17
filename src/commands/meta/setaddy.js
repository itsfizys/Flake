import { Command } from '#command';
import {
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
        ApplicationCommandOptionType,
} from 'discord.js';
import { resolveChain, CHAINS, validateAddress } from '#utils';
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

class SetAddyCommand extends Command {
        constructor() {
                super({
                        name: 'setaddy',
                        description: 'Save a wallet address for a chain',
                        cooldown: 5,
                        enabledSlash: true,
                        slashData: {
                                name: 'setaddy',
                                description: 'Save a wallet address for a chain',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'crypto',
                                                description: 'Chain to save the address for',
                                                required: true,
                                                autocomplete: true,
                                        },
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'address',
                                                description: 'Wallet address',
                                                required: true,
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
                const address    = ctx.options.getString('address').trim();

                const chainCfg = resolveChain(chainInput);
                if (!chainCfg) {
                        return ctx.reply({
                                components: [this._msgContainer(`**\`${chainInput}\` is not a recognised coin.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                if (!validateAddress(address, chainCfg.addressType)) {
                        return ctx.reply({
                                components: [this._msgContainer(`**That doesn't look like a valid \`${chainCfg.symbol}\` address.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                await db.user.setAddress(ctx.user.id, chainCfg.key, address);

                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `## ${chainCfg.emoji}  ${chainCfg.name}  \`${chainCfg.symbol}\`\n` +
                                        `-# Address saved\n\`\`\`${address}\`\`\``,
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

export default new SetAddyCommand();
