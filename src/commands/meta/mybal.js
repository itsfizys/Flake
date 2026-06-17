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
        CHAINS,
} from '#utils';
import { emoji } from '#emoji';
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

class MyBalCommand extends Command {
        constructor() {
                super({
                        name: 'mybal',
                        description: 'Check the balance of your saved wallet address',
                        cooldown: 10,
                        enabledSlash: true,
                        slashData: {
                                name: 'mybal',
                                description: 'Check the balance of your saved wallet address',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'crypto',
                                                description: 'Coin to check (uses your saved address)',
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
                const chainCfg  = resolveChain(chainInput);

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

                const detectedCfg = detectChain(address);

                if (!detectedCfg) {
                        return ctx.reply({
                                components: [this._msgContainer(`**That doesn't look like a valid \`${chainCfg.symbol}\` address.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                if (!detectedCfg.tatumNetwork) {
                        return ctx.reply({
                                components: [this._msgContainer(`**\`${chainCfg.symbol}\` is a token — balance lookups aren't supported yet.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const [balSettled, txSettled, priceSettled] = await Promise.allSettled([
                        getBalance(detectedCfg, address),
                        getTransactions(detectedCfg, address, 50),
                        getPrice(detectedCfg.key),
                ]);

                if (balSettled.status === 'rejected') {
                        return ctx.reply({
                                components: [this._msgContainer(`**Could not fetch balance for your saved \`${chainCfg.symbol}\` address.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const balData  = balSettled.value;
                const allTxs   = txSettled.status === 'fulfilled' ? (txSettled.value || []) : [];
                const txs      = allTxs.slice(0, 5);
                const txCount  = allTxs.length === 50 ? '50+' : allTxs.length.toString();
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

                const displayCfg = chainCfg;
                const imageUrl   = emojiImageUrl(displayCfg.emoji);

                const container = new ContainerBuilder().setAccentColor(0xffffff);

                const headerText = `## ${displayCfg.emoji} ${displayCfg.name} \`${displayCfg.symbol}\`\n\`\`\`${address}\`\`\``;
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
                                `Price : **${priceStr}**     24h : **${changeArrow} ${change24Abs}%**     Txs : **${txCount}**`,
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
                                const txUrl = detectedCfg.txExplorer
                                        ? `${detectedCfg.txExplorer}${tx.hash}`
                                        : `${detectedCfg.explorer}${address}`;
                                const usdStr = formatUSD(getTxValueUSD(tx, address, detectedCfg, price));

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

        _msgContainer(text) {
                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
        }
}

export default new MyBalCommand();
