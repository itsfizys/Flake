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
import {
        resolveChain,
        getBalance,
        getTransactions,
        truncateAddress,
        formatRawValue,
        formatUSD,
        utxoTxDirection,
        utxoTxAmount,
        getPrice,
} from '#utils';
import { emoji } from '#emoji';

function detectChain(address) {
        const a = (address || '').trim();
        if (/^0x[0-9a-fA-F]{40}$/.test(a)) return resolveChain('eth');
        if (/^(tz1|tz2|tz3|KT1)[a-zA-Z0-9]{33}$/.test(a)) return resolveChain('xtz');
        if (a.toLowerCase().startsWith('addr1')) return resolveChain('ada');
        if (/^G[A-Z2-7]{55}$/.test(a)) return resolveChain('xlm');
        if (/^r[a-zA-Z0-9]{24,33}$/.test(a)) return resolveChain('xrp');
        if (/^T[a-zA-Z0-9]{33}$/.test(a) && a.length === 34) return resolveChain('trx');
        if (/^bc1[a-z0-9]{6,87}$/i.test(a)) return resolveChain('btc');
        if (/^ltc1[a-z0-9]{6,87}$/i.test(a)) return resolveChain('ltc');
        if (/^[13][a-zA-Z0-9]{25,33}$/.test(a)) return resolveChain('btc');
        if (/^[LM][a-zA-Z0-9]{26,33}$/.test(a)) return resolveChain('ltc');
        if (/^D[a-zA-Z0-9]{25,33}$/.test(a)) return resolveChain('doge');
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return resolveChain('sol');
        return null;
}

function emojiImageUrl(emojiStr) {
        const m = (emojiStr || '').match(/<a?:.+?:(\d+)>/);
        return m ? `https://cdn.discordapp.com/emojis/${m[1]}.png` : null;
}

function getTxCounterpart(tx, address) {
        const addr = (address || '').toLowerCase();
        if (tx.type === 'evm' || tx.type === 'xrp' || tx.type === 'tron') {
                const from = (tx.from || '').toLowerCase();
                return from === addr ? tx.to : tx.from;
        }
        if (tx.type === 'utxo') {
                const fromSelf = (tx.inputs || []).some(i => i.coin?.address?.toLowerCase() === addr);
                if (fromSelf) {
                        return (tx.outputs || []).find(o => o.address?.toLowerCase() !== addr)?.address
                                || tx.outputs?.[0]?.address;
                }
                return (tx.inputs || []).find(i => i.coin?.address?.toLowerCase() !== addr)?.coin?.address
                        || tx.inputs?.[0]?.coin?.address;
        }
        return null;
}

function getTxValueUSD(tx, address, chainCfg, price) {
        if (!price) return 0;
        try {
                if (tx.type === 'evm' || tx.type === 'xrp' || tx.type === 'tron') {
                        const raw = tx.value;
                        if (!raw || raw === '0') return 0;
                        const amount = parseFloat(formatRawValue(raw.toString(), chainCfg.decimals));
                        return amount * price;
                }
                if (tx.type === 'utxo') {
                        const dir = utxoTxDirection(tx, address);
                        const amount = parseFloat(utxoTxAmount(tx, address, dir === 'out' ? 'out' : 'in'));
                        return amount * price;
                }
        } catch {}
        return 0;
}

class BalCommand extends Command {
        constructor() {
                super({
                        name: 'bal',
                        description: 'Check the balance of any crypto wallet',
                        usage: 'bal <address> [chain]',
                        cooldown: 10,
                        enabledSlash: true,
                        slashData: {
                                name: 'bal',
                                description: 'Check the balance of any crypto wallet',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'address',
                                                description: 'Wallet address to look up',
                                                required: true,
                                        },
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'chain',
                                                description: 'Chain symbol (e.g. eth, btc, sol). Auto-detected if omitted.',
                                                required: false,
                                        },
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                const address = ctx.options.getString('address').trim();
                const chainInput = ctx.options.getString('chain');

                const chainCfg = chainInput ? resolveChain(chainInput) : detectChain(address);

                if (!chainCfg) {
                        return ctx.reply({
                                components: [this._errorContainer(
                                        'Unknown Chain',
                                        chainInput
                                                ? `\`${chainInput}\` is not a recognised chain. Try: \`eth\`, \`btc\`, \`sol\`, \`trx\`, etc.`
                                                : `Could not detect the chain for \`${address}\`.\nSpecify it manually with the \`chain\` option.`,
                                )],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                if (!chainCfg.tatumNetwork) {
                        return ctx.reply({
                                components: [this._errorContainer(
                                        'Unsupported Chain',
                                        `**${chainCfg.name}** (\`${chainCfg.symbol}\`) is not yet supported for balance lookups.`,
                                )],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const [balSettled, txSettled, priceSettled] = await Promise.allSettled([
                        getBalance(chainCfg, address),
                        getTransactions(chainCfg, address, 5),
                        getPrice(chainCfg.key),
                ]);

                if (balSettled.status === 'rejected') {
                        return ctx.reply({
                                components: [this._errorContainer(
                                        'Lookup Failed',
                                        `Could not fetch balance for that address.\n\`${balSettled.reason?.message || 'Unknown error'}\``,
                                )],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const balData  = balSettled.value;
                const txs      = txSettled.status === 'fulfilled' ? (txSettled.value || []) : [];
                const { price = 0, change24h = 0 } = priceSettled.status === 'fulfilled' ? priceSettled.value : {};

                const balanceNum  = parseFloat(balData.balance  || 0);
                const incomingNum = parseFloat(balData.incoming || 0);
                const pendingNum  = parseFloat(balData.pendingIn || 0);

                const balanceUSD  = formatUSD(balanceNum  * price);
                const receivedUSD = formatUSD(incomingNum * price);
                const pendingUSD  = formatUSD(pendingNum  * price);
                const priceStr    = price ? formatUSD(price) : 'N/A';
                const change24Abs = Math.abs(change24h).toFixed(2);
                const changeArrow = change24h >= 0 ? emoji.arrowup : emoji.arrowdown;

                const imageUrl = emojiImageUrl(chainCfg.emoji);

                const container = new ContainerBuilder().setAccentColor(0xffffff);

                const headerText = `## ${chainCfg.emoji} ${chainCfg.name} \`${chainCfg.symbol}\`\n\`\`\`${address}\`\`\``;
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
                                `Balance : **${balanceUSD}**     Unconfirmed : **${pendingUSD}**     Received : **${receivedUSD}**\n` +
                                `Price : **${priceStr}**     24h : **${changeArrow} ${change24Abs}%**     Txs : **${txs.length}**`,
                        ),
                );

                if (txs.length > 0) {
                        container.addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        );

                        const txLines = txs.map(tx => {
                                const counterpart = getTxCounterpart(tx, address);
                                const displayAddr = counterpart
                                        ? truncateAddress(counterpart, 8, 8)
                                        : truncateAddress(tx.hash, 8, 8);
                                const txUrl = chainCfg.txExplorer
                                        ? `${chainCfg.txExplorer}${tx.hash}`
                                        : `${chainCfg.explorer}${address}`;
                                const usdStr = formatUSD(getTxValueUSD(tx, address, chainCfg, price));

                                let dirEmoji = emoji.minus;
                                if (tx.type === 'utxo') {
                                        const dir = utxoTxDirection(tx, address);
                                        dirEmoji = dir === 'in' ? emoji.plus : emoji.minus;
                                } else if (tx.type === 'evm' || tx.type === 'xrp' || tx.type === 'tron') {
                                        const isIncoming = (tx.to || '').toLowerCase() === address.toLowerCase();
                                        dirEmoji = isIncoming ? emoji.plus : emoji.minus;
                                }

                                return `${dirEmoji}  [\`${displayAddr}\`](${txUrl})  :  **${usdStr}**`;
                        }).join('\n');

                        container.addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `### Recent Activity\n${txLines}`,
                                ),
                        );
                }

                return ctx.reply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                });
        }

        _errorContainer(title, description) {
                return new ContainerBuilder()
                        .setAccentColor(0xed4245)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ❌ ${title}`))
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
        }
}

export default new BalCommand();
