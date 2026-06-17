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
} from '#utils';

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

function detectChainFromHash(hash) {
        if (/^0x[0-9a-fA-F]{64}$/.test(hash))         return 'eth';
        if (/^[1-9A-HJ-NP-Za-km-z]{80,}$/.test(hash)) return 'sol';
        if (/^[A-F0-9]{64}$/.test(hash))               return 'xrp';
        if (/^[0-9a-f]{64}$/.test(hash))               return 'btc';
        return null;
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
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                const hash     = ctx.options.getString('hash').trim();
                const detected = detectChainFromHash(hash);

                if (!detected) {
                        return ctx.reply({
                                components: [this._msgContainer(`**Could not identify the chain from that hash.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const chainCfg = resolveChain(detected);

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
                const hashLine   = txUrl
                        ? `[\`${tx.hash}\`](${txUrl})`
                        : `\`${tx.hash}\``;

                const timeStr    = tx.timestamp
                        ? `<t:${tx.timestamp}:F>`
                        : 'Unknown';

                const addrBase   = chainCfg.explorer ?? null;
                const fmtAddr    = (addr) => {
                        if (!addr) return '`Unknown`';
                        const short = truncateAddress(addr, 10, 8);
                        return addrBase
                                ? `[\`${short}\`](${addrBase}${addr})`
                                : `\`${short}\``;
                };
                const fromStr    = fmtAddr(tx.from);
                const toStr      = fmtAddr(tx.to);

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
