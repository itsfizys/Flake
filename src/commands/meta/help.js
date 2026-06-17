import { Command } from '#command';
import {
        ContainerBuilder,
        SectionBuilder,
        ThumbnailBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        MessageFlags,
} from 'discord.js';

const SECTIONS = [
        {
                title: '### Wallet',
                commands: ['setaddy', 'addy', 'bal', 'mybal'],
                descriptions: {
                        setaddy: 'save an address for a chain',
                        addy:    'show a saved address with a QR button',
                        bal:     'look up any wallet by address',
                        mybal:   'detailed view of your saved wallet',
                },
        },
        {
                title: '### Market',
                commands: ['price', 'tx'],
                descriptions: {
                        price: 'live price and 24h change',
                        tx:    'transaction lookup, chain auto detected',
                },
        },
        {
                title: '### Alerts',
                commands: ['alert'],
                descriptions: {
                        alert: 'toggle DM alerts on confirmed incoming transactions',
                },
        },
];

class HelpCommand extends Command {
        constructor() {
                super({
                        name: 'help',
                        description: 'View all available commands',
                        cooldown: 5,
                        enabledSlash: true,
                        shouldNotDefer: true,
                        slashData: {
                                name: 'help',
                                description: 'View all available commands',
                        },
                });
        }

        async execute({ ctx }) {
                const client = ctx.client;

                // Fetch registered commands and build a name→id map
                let cmdMap = {};
                try {
                        const registered = client.application?.commands?.cache?.size
                                ? client.application.commands.cache
                                : await client.application.commands.fetch();
                        registered.forEach(cmd => { cmdMap[cmd.name] = cmd.id; });
                } catch {}

                const mention = (name) =>
                        cmdMap[name] ? `</${name}:${cmdMap[name]}>` : `\`/${name}\``;

                const botAvatarUrl = client.user.displayAvatarURL({ size: 256, extension: 'png' });
                const botName = client.user.username;

                const container = new ContainerBuilder().setAccentColor(0xffffff);

                // Header with bot avatar thumbnail
                container.addSectionComponents(
                        new SectionBuilder()
                                .addTextDisplayComponents(
                                        new TextDisplayBuilder().setContent(
                                                `# ${botName}\n-# Multi-chain crypto wallet, prices and transaction alerts.`,
                                        ),
                                )
                                .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatarUrl)),
                );

                container.addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                );

                // Command sections
                const sectionLines = SECTIONS.map(section => {
                        const lines = section.commands.map(
                                name => `${mention(name)}  ${section.descriptions[name]}`,
                        );
                        return `${section.title}\n${lines.join('\n')}`;
                }).join('\n');

                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(sectionLines),
                );

                container.addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                );

                container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`-# Supports **150+** coins`),
                );

                return ctx.reply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                });
        }
}

export default new HelpCommand();
