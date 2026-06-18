import { Command } from '#command';
import {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
} from 'discord.js';
import { db } from '#dbManager';
import { emoji } from '#emoji';

class UpiCommand extends Command {
        constructor() {
                super({
                        name: 'upi',
                        description: 'View your saved UPI ID',
                        cooldown: 5,
                        enabledSlash: true,
                        shouldNotDefer: true,
                        slashData: {
                                name: 'upi',
                                description: 'View your saved UPI ID',
                        },
                });
        }

        async execute({ ctx }) {
                const upiId = await db.user.getAddress(ctx.user.id, 'upi');

                if (!upiId) {
                        return ctx.reply({
                                components: [this._msgContainer(`**No UPI ID saved. Use \`/setupi\` first.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const customId = `upi_qr:${upiId}`;
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
                        content: `\`${upiId}\``,
                        components,
                });
        }

        _msgContainer(text) {
                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
        }
}

export default new UpiCommand();
