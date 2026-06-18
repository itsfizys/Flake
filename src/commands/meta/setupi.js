import { Command } from '#command';
import {
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
        ApplicationCommandOptionType,
} from 'discord.js';
import { db } from '#dbManager';
import { emoji } from '#emoji';

const UPI_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z]{2,}$/;

class SetUpiCommand extends Command {
        constructor() {
                super({
                        name: 'setupi',
                        description: 'Save your UPI ID',
                        cooldown: 5,
                        enabledSlash: true,
                        slashData: {
                                name: 'setupi',
                                description: 'Save your UPI ID',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'upi',
                                                description: 'Your UPI ID (e.g. name@upi)',
                                                required: true,
                                        },
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                const upiId = ctx.options.getString('upi').trim();

                if (!UPI_REGEX.test(upiId)) {
                        return ctx.reply({
                                components: [this._msgContainer(`**That doesn't look like a valid UPI ID.**\n-# Expected format: \`name@upi\``)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                await db.user.setAddress(ctx.user.id, 'upi', upiId);

                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `## ${emoji.upi}  UPI\n-# ID saved\n\`\`\`${upiId}\`\`\``,
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

export default new SetUpiCommand();
