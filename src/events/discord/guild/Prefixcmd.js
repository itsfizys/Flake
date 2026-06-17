import {
        ContainerBuilder,
        TextDisplayBuilder,
        ButtonBuilder,
        ButtonStyle,
        MessageFlags,
        SeparatorBuilder,
        SeparatorSpacingSize,
        ActionRowBuilder,
} from 'discord.js';
import { config } from '#config';
import { db } from '#dbManager';
import { CommandContext } from '#context';
import { validateCommand, canBotSendMessages, logger } from '#utils';
import { emoji } from '#emoji';

const regexCache = new Map();

const getMentionRegex = (id) => {
        if (!id) return null;
        if (!regexCache.has(id)) regexCache.set(id, new RegExp(`^<@!?${id}>\\s*$`));
        return regexCache.get(id);
};

const getMentionPrefixRegex = (id) => {
        if (!id) return null;
        const key = `p_${id}`;
        if (!regexCache.has(key)) regexCache.set(key, new RegExp(`^<@!?${id}>\\s+`));
        return regexCache.get(key);
};

const errorContainer = new ContainerBuilder();
const errorTitle = new TextDisplayBuilder();
const errorDescription = new TextDisplayBuilder();

const mentionContainer = new ContainerBuilder();
const mentionTitle = new TextDisplayBuilder();
const mentionSeparator = new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true);
const mentionContent = new TextDisplayBuilder();
const mentionButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
                .setLabel('Support')
                .setURL(config.links?.supportServer || 'https://discord.gg')
                .setStyle(ButtonStyle.Link),
);

const sendDM = async (user, title, description, client) => {
        if (!user || !title || !description || !client) return false;
        try {
                const dmCooldown = await client.commandHandler
                        ?.isOnCooldown({ name: 'errorDM', cooldown: 600 }, user.id, user.id)
                        .catch(() => false);
                if (dmCooldown) return false;

                const dmContainer = new ContainerBuilder();
                dmContainer.setAccentColor(config.colors?.error || 0xed4245);
                dmContainer
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`### ${emoji?.cross || '❌'} ${title}`),
                        )
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(description));

                await user.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2 });

                if (client.commandHandler) {
                        await client.commandHandler
                                .setCooldown({ name: 'errorDM', cooldown: 600 }, user.id, user.id)
                                .catch(() => {});
                }
                return true;
        } catch (error) {
                logger.debug('PrefixCmd', `Failed to DM user ${user.id}: ${error.message}`);
                return false;
        }
};

const sendError = async (message, title, description, client) => {
        if (!message || !title || !description) return;
        try {
                if (!canBotSendMessages(message.channel)) {
                        return await sendDM(message.author, title, description, client);
                }

                errorContainer.components.length = 0;
                errorContainer.setAccentColor(config.colors?.error || 0xed4245);
                errorTitle.data.content = `### ${emoji?.cross || '❌'} ${title}`;
                errorDescription.data.content = description;
                errorContainer
                        .addTextDisplayComponents(errorTitle)
                        .addTextDisplayComponents(errorDescription);

                await message
                        .reply({ components: [errorContainer], flags: MessageFlags.IsComponentsV2 })
                        .catch(async () => {
                                await sendDM(message.author, title, description, client);
                        });
        } catch (error) {
                logger.debug('PrefixCmd', `Failed to send error: ${error.message}`);
        }
};

const sendCooldown = async (cooldown, message) => {
        if (!cooldown || !message || !canBotSendMessages(message.channel)) return;
        try {
                const timestamp = Math.floor((Date.now() + cooldown) / 1000);
                let content = `**Cooldown** - Ends <t:${timestamp}:R>`;

                const cooldownContainer = new ContainerBuilder();
                cooldownContainer.setAccentColor(config.colors?.warn || 0xfee75c);
                cooldownContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(content),
                );

                const reply = await message.reply({
                        components: [cooldownContainer],
                        flags: MessageFlags.IsComponentsV2,
                });
                setTimeout(() => reply.delete().catch(() => {}), cooldown);
        } catch {}
};

const parseMentionPrefix = (content, clientId) => {
        if (!content || !clientId) return null;
        try {
                const regex = getMentionPrefixRegex(clientId);
                if (!regex) return null;
                const match = content.match(regex);
                if (!match) return null;
                const parts = content.slice(match[0].length).trim().split(/\s+/);
                return parts.length > 0 ? { parts, type: 'mention' } : null;
        } catch {
                return null;
        }
};

const parseGuildPrefix = async (content, guildId, guildPrefixes) => {
        if (!content || !guildPrefixes || guildPrefixes.length === 0) return null;
        try {
                const lowerContent = content.toLowerCase();
                for (let i = 0; i < guildPrefixes.length; i++) {
                        const prefix = guildPrefixes[i];
                        if (lowerContent.startsWith(prefix.toLowerCase())) {
                                const parts = content.slice(prefix.length).trim().split(/\s+/);
                                return parts.length > 0 ? { parts, type: 'guild', prefix } : null;
                        }
                }
                return null;
        } catch {
                return null;
        }
};

const parseCommand = async (message, client, guildPrefixes) => {
        if (!message || !client || !message.content) return null;
        try {
                const content = message.content.trim();
                return (
                        parseMentionPrefix(content, client.user?.id) ||
                        (await parseGuildPrefix(content, message.guild?.id, guildPrefixes))
                );
        } catch {
                return null;
        }
};

const handleMentionOnly = async (message, client, guildPrefixes) => {
        if (!message || !client || !client.user || !guildPrefixes || guildPrefixes.length === 0)
                return false;
        try {
                const mentionRegex = getMentionRegex(client.user.id);
                if (!mentionRegex || !mentionRegex.test(message.content.trim())) return false;

                const mentionCooldown = await client.commandHandler
                        ?.isOnCooldown(
                                { name: 'botmention', cooldown: 30 },
                                message.author.id,
                                message.guild.id,
                        )
                        .catch(() => false);
                if (mentionCooldown) return true;
                if (!canBotSendMessages(message.channel)) return true;

                mentionContainer.components.length = 0;
                mentionContainer.setAccentColor(config.colors?.bot || 0x5865f2);
                mentionTitle.data.content = `## ${client.user.username}`;
                mentionContent.data.content =
                        `${emoji?.code || '📝'} **Server Prefixes**\n\n` +
                        `-# ${guildPrefixes.map((p) => `\`${p}\``).join(' • ')}` +
                        `\n\n-# Use \`${guildPrefixes[0]}help\` for commands\n`;
                mentionContainer
                        .addTextDisplayComponents(mentionTitle)
                        .addSeparatorComponents(mentionSeparator)
                        .addTextDisplayComponents(mentionContent)
                        .addActionRowComponents(mentionButtons);

                await message
                        .reply({ components: [mentionContainer], flags: MessageFlags.IsComponentsV2 })
                        .catch(() => {});

                if (client.commandHandler) {
                        await client.commandHandler
                                .setCooldown(
                                        { name: 'botmention', cooldown: 30 },
                                        message.author.id,
                                        message.guild.id,
                                )
                                .catch(() => {});
                }
                return true;
        } catch {
                return false;
        }
};

const getCommand = (parts, commandHandler) => {
        if (!parts || parts.length === 0 || !commandHandler) return { command: null, args: [] };
        try {
                const firstPart = parts[0].toLowerCase();
                const arrayCommands = commandHandler.arrayCommands?.get(firstPart);
                if (arrayCommands?.length > 0) {
                        for (let i = 0; i < arrayCommands.length; i++) {
                                const cmd = arrayCommands[i];
                                const nameLength = cmd.name.length;
                                if (parts.length < nameLength) continue;
                                let matches = true;
                                for (let j = 0; j < nameLength; j++) {
                                        if (parts[j].toLowerCase() !== cmd.name[j].toLowerCase()) {
                                                matches = false;
                                                break;
                                        }
                                }
                                if (matches) return { command: cmd, args: parts.slice(nameLength) };
                        }
                }
                const aliasedName = commandHandler.aliases?.get(firstPart);
                if (aliasedName) {
                        const command = commandHandler.commands?.get(aliasedName);
                        if (command) return { command, args: parts.slice(1) };
                }
                const directCommand = commandHandler.commands?.get(firstPart);
                if (directCommand) return { command: directCommand, args: parts.slice(1) };
                return { command: null, args: [] };
        } catch {
                return { command: null, args: [] };
        }
};

export default {
        name: 'messageCreate',
        async execute({ eventArgs, client }) {
                if (!eventArgs || !eventArgs[0] || !client) return;

                const [message] = eventArgs;

                try {
                        if (!message || message.author?.bot || !message.guild || !message.content) return;

                        let isUserBlacklisted = false;
                        let isGuildBlacklisted = false;
                        let guildPrefixes = [];

                        try {
                                [isUserBlacklisted, isGuildBlacklisted, guildPrefixes] = await Promise.all([
                                        db.blacklist?.checkBlacklist(message.author.id).catch(() => false),
                                        db.blacklist?.checkBlacklist(message.guild.id).catch(() => false),
                                        db.guild?.getPrefixes(message.guild.id).catch(() => []),
                                ]);
                        } catch (error) {
                                logger.error('MessageCreate', `Database check failed: ${error.message}`);
                                return;
                        }

                        if (isUserBlacklisted || isGuildBlacklisted) return;

                        if (await handleMentionOnly(message, client, guildPrefixes)) return;

                        const commandInfo = await parseCommand(message, client, guildPrefixes);
                        if (!commandInfo) return;

                        const { command, args } = getCommand(commandInfo.parts, client.commandHandler);
                        if (!command) return;

                        if (!canBotSendMessages(message.channel)) {
                                return await sendDM(
                                        message.author,
                                        'Missing Bot Permissions',
                                        `I don't have permission to send messages in <#${message.channel.id}>. Please grant me the **Send Messages** and **View Channel** permissions in that channel.`,
                                        client,
                                );
                        }

                        const isIgnored = await db.guild
                                ?.isChannelIgnored(message.guild.id, message.channel.id)
                                .catch(() => false);

                        if (isIgnored) {
                                if (client.commandHandler) {
                                        const ignoreNotifCooldown = await client.commandHandler
                                                .isOnCooldown(
                                                        { name: 'ignoreNotif', cooldown: 30 },
                                                        message.author.id,
                                                        message.guild.id,
                                                )
                                                .catch(() => false);

                                        if (!ignoreNotifCooldown) {
                                                message
                                                        .reply(`${emoji?.info || 'ℹ️'} Commands disabled in this channel`)
                                                        .then((m) => setTimeout(() => m.delete().catch(() => {}), 3e3))
                                                        .catch(() => {});

                                                await client.commandHandler
                                                        .setCooldown(
                                                                { name: 'ignoreNotif', cooldown: 30 },
                                                                message.author.id,
                                                                message.guild.id,
                                                        )
                                                        .catch(() => {});
                                        }
                                }
                                return;
                        }

                        if (command.cooldown && client.commandHandler) {
                                try {
                                        const cooldown = await client.commandHandler.isOnCooldown(
                                                command,
                                                message.author.id,
                                                message.guild.id,
                                        );
                                        if (cooldown) {
                                                const shouldNotify = await client.commandHandler
                                                        .shouldNotifyAboutCooldown(command, message.author.id, message.guild.id)
                                                        .catch(() => true);

                                                if (shouldNotify) await sendCooldown(cooldown, message);
                                                return;
                                        }
                                        await client.commandHandler.setCooldown(
                                                command,
                                                message.author.id,
                                                message.guild.id,
                                        );
                                } catch (error) {
                                        logger.error('MessageCreate', `Cooldown check failed: ${error.message}`);
                                }
                        }

                        try {
                                const ctx = new CommandContext({ client, message, args });
                                const permissionValidation = await validateCommand(ctx, command);
                                if (!permissionValidation.valid) {
                                        if (permissionValidation.cannotReply) {
                                                return await sendDM(
                                                        message.author,
                                                        permissionValidation.error?.title || 'Permission Error',
                                                        permissionValidation.error?.description || 'You cannot use this command.',
                                                        client,
                                                );
                                        }
                                        return sendError(
                                                message,
                                                permissionValidation.error?.title || 'Permission Error',
                                                permissionValidation.error?.description || 'You cannot use this command.',
                                                client,
                                        );
                                }
                                await command.execute({ ctx });
                        } catch (error) {
                                const displayName = Array.isArray(command.name)
                                        ? command.name.join(' ')
                                        : command.name;
                                logger.error(
                                        'MessageCreate',
                                        `Error executing ${displayName}: ${error.message}`,
                                        error,
                                );
                                sendError(
                                        message,
                                        'Command Error',
                                        'An error occurred while executing the command.',
                                        client,
                                );
                        }
                } catch (error) {
                        logger.error('MessageCreate', `Fatal error: ${error.message}`, error);
                }
        },
};
