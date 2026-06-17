import { Command } from '#command';
import {
        ContainerBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        MessageFlags,
        ApplicationCommandOptionType,
} from 'discord.js';
import {
        resolveChain,
        getTransaction,
        getPrice,
        formatRawValue,
        formatBalance,
        formatUSD,
        truncateAddress,
        CHAINS,
} from '#utils';

const FEATURED = ['btc', 'eth', 'ltc', 'sol', 'trx', 'xrp'];

const ALL_CHOICES = Object.entries(CHAINS).map(([key, chain]) => ({
        name: `${chain.name} (${chain.symbol})`,
        value: key,
}));

const FEATURED_CHOICES = FEATURED.map(key => ({
        name: `${CHAINS[key].name} (${CHAINS[key].symbol})`,
        value: key,
}));

function formatAmount(raw, type, chainCfg) {
        if (raw == null || raw === '0') return `0 ${chainCfg.symbol}`;
        let decimal;
        if (type === 'evm') {
                decimal = formatRawValue(raw.toString(), chainCfg.decimals);
        } else {
                decimal = raw.toString();
        }
        const num = parseFloat(decimal);
        if (isNaN(num) || num === 0) return `0 ${chainCfg.symbol}`;
        return `${formatBalance(decimal, 8)} ${chainCfg.symbol}`;
}

function formatFee(raw, type, chainCfg) {
        if (raw == null) return null;
        let decimal;
        if (type === 'evm') {
                decimal = formatRawValue(raw.toString(), chainCfg.decimals);
        } else {
                decimal = raw.toString();
        }
        const num = parseFloat(decimal);
        if (isNaN(num)) return null;
        return `${formatBalance(decimal, 8)} ${chainCfg.symbol}`;
}

function statusLabel(status) {
        if (status === 'Confirmed') return '`Confirmed`';
        if (status === 'Failed')    return '`Failed`';
        return '`Pending`';
}

class TxCommand extends Command {
        constructor() {
                super({
                        name: 'tx',
                        description: 'Look up a transaction by hash',
                        cooldown: 8,
                        enabledSlash: true,
                        slashData: {
                                name: 'tx',
                                description: 'Look up a transaction by hash',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'hash',
                                                description: 'Transaction hash',
                                                required: true,
                                        },
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'chain',
                                                description: 'Chain the transaction is on',
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
                const hash       = ctx.options.getString('hash').trim();
                const chainInput = ctx.options.getString('chain');
                const chainCfg   = resolveChain(chainInput);

                if (!chainCfg) {
                        return ctx.reply({
                                components: [this._msgContainer(`**\`${chainInput}\` is not a recognised chain.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                if (!chainCfg.tatumNetwork) {
                        return ctx.reply({
                                components: [this._msgContainer(`**Transaction lookup isn't supported for \`${chainCfg.symbol}\` yet.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const [txSettled, priceSettled] = await Promise.allSettled([
                        getTransaction(chainCfg, hash),
                        getPrice(chainCfg.key),
                ]);

                if (txSettled.status === 'rejected') {
                        return ctx.reply({
                                components: [this._msgContainer(`**Could not find that transaction on \`${chainCfg.symbol}\`.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const tx    = txSettled.value;
                const price = priceSettled.status === 'fulfilled' ? (priceSettled.value?.price ?? 0) : 0;

                const amountStr  = formatAmount(tx.amount, tx.type, chainCfg);
                const feeStr     = formatFee(tx.fee, tx.type, chainCfg);
                const amountNum  = parseFloat(
                        tx.type === 'evm'
                                ? formatRawValue((tx.amount || '0').toString(), chainCfg.decimals)
                                : (tx.amount || '0'),
                );
                const amountUSD  = price && !isNaN(amountNum) ? `  **${formatUSD(amountNum * price)}**` : '';

                const txUrl      = chainCfg.txExplorer ? `${chainCfg.txExplorer}${tx.hash}` : null;
                const hashShort  = truncateAddress(tx.hash, 10, 8);
                const hashLine   = txUrl
                        ? `[\`${hashShort}\`](${txUrl})`
                        : `\`${hashShort}\``;

                const timeStr    = tx.timestamp
                        ? `<t:${tx.timestamp}:F>`
                        : 'Unknown';

                const fromStr    = tx.from ? `\`${truncateAddress(tx.from, 10, 8)}\`` : '`Unknown`';
                const toStr      = tx.to   ? `\`${truncateAddress(tx.to,   10, 8)}\`` : '`Unknown`';

                const sep = () =>
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);

                const container = new ContainerBuilder().setAccentColor(0xffffff);

                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `## ${chainCfg.emoji}  ${chainCfg.name}  \`${chainCfg.symbol}\``,
                        ),
                );

                container.addSeparatorComponents(sep());

                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `**Transaction**\u2003${statusLabel(tx.status)}\n` +
                                `${hashLine}\n` +
                                `**Time**\u2003${timeStr}`,
                        ),
                );

                container.addSeparatorComponents(sep());

                const amountLine = `**Amount**\u2003\`${amountStr}\`${amountUSD}`;
                const feeLine    = feeStr ? `\n**Fee**\u2003\`${feeStr}\`` : '';
                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(amountLine + feeLine),
                );

                container.addSeparatorComponents(sep());

                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `**From**\u2003${fromStr}\n` +
                                `**To**\u2003\u2003${toStr}`,
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

export default new TxCommand();
