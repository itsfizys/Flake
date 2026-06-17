import {
	InteractionType,
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	MessageFlags,
} from 'discord.js';
import { config } from '#config';
import { validateCommand, canBotSendMessages, logger } from '#utils';
import { CommandContext } from '#context';
import { db } from '#dbManager';
import { emoji } from '#emoji';

const errorContainer = new ContainerBuilder();
const errorTitle = new TextDisplayBuilder();
const errorSeparator = new SeparatorBuilder()
	.setSpacing(SeparatorSpacingSize.Small)
	.setDivider(true);
const errorDescription = new TextDisplayBuilder();

const sendError = async (interaction, title, description, forceEphemeral = false) => {
	if (!interaction || !title || !description) return;

	errorContainer.components.length = 0;
	errorContainer.setAccentColor(config.colors?.error || 0xed4245);
	errorTitle.data.content = `## ${emoji?.cross || '❌'} ${title}`;
	errorDescription.data.content = description;
	errorContainer
		.addTextDisplayComponents(errorTitle)
		.addSeparatorComponents(errorSeparator)
		.addTextDisplayComponents(errorDescription);

	try {
		const canSend = interaction.channel ? canBotSendMessages(interaction.channel) : false;
		const flags =
			!canSend || forceEphemeral
				? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
				: MessageFlags.IsComponentsV2;

		const reply = { components: [errorContainer], flags };

		if (interaction.deferred || interaction.replied) {
			await interaction.followUp(reply).catch(() => {});
		} else {
			await interaction.reply(reply).catch(() => {});
		}
	} catch (error) {
		logger.error('InteractionCreate', `Failed to send error: ${error.message}`);
	}
};

const sendCooldown = async (interaction, cooldown) => {
	if (!interaction || !cooldown) return;

	try {
		const timestamp = Math.floor((Date.now() + cooldown) / 1000);

		let content = `**Cooldown** - Ends <t:${timestamp}:R>`;

		const cooldownContainer = new ContainerBuilder();
		cooldownContainer.setAccentColor(config.colors?.warn || 0xfee75c);
		cooldownContainer.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(content),
		);
		await interaction
			.reply({
				components: [cooldownContainer],
				flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
			})
			.catch(() => {});
	} catch (error) {
		logger.error('InteractionCreate', `Failed to send cooldown: ${error.message}`);
	}
};

const getCommandFile = (interaction, client) => {
	if (!interaction || !client || !client.commandHandler) return null;

	try {
		const { commandName } = interaction;
		const subCommandGroup = interaction.options?.getSubcommandGroup(false);
		const subCommandName = interaction.options?.getSubcommand(false);

		if (subCommandGroup && subCommandName) {
			const cmd = client.commandHandler.slashCommandFiles.get(
				`${commandName}:${subCommandGroup}:${subCommandName}`,
			);
			if (cmd) return cmd;
		}
		if (subCommandName) {
			const cmd = client.commandHandler.slashCommandFiles.get(
				`${commandName}:${subCommandName}`,
			);
			if (cmd) return cmd;
		}
		return client.commandHandler.slashCommandFiles.get(commandName);
	} catch (error) {
		logger.error('InteractionCreate', `Error getting command file: ${error.message}`);
		return null;
	}
};

const handleChatInputCommand = async (interaction, client) => {
	if (!interaction || !client) return;

	try {
		if (!interaction.inGuild()) {
			return sendError(
				interaction,
				'Server Only',
				'Commands can only be used in a server.',
				true,
			);
		}

		if (!interaction.guild || !interaction.user || !interaction.channel) {
			return sendError(
				interaction,
				'Invalid Context',
				'Unable to process this interaction.',
				true,
			);
		}

		if (!canBotSendMessages(interaction.channel)) {
			return sendError(
				interaction,
				'Missing Bot Permissions',
				"I don't have permission to send messages in this channel. Please grant me the **Send Messages** and **View Channel** permissions before using commands.",
				true,
			);
		}

		const userId = interaction.user.id;
		const guildId = interaction.guild.id;
		const channelId = interaction.channel.id;

		let isUserBlacklisted = false;
		let isGuildBlacklisted = false;
		let isChannelIgnored = false;

		try {
			[isUserBlacklisted, isGuildBlacklisted, isChannelIgnored] = await Promise.all([
				db.blacklist?.checkBlacklist(userId).catch(() => false),
				db.blacklist?.checkBlacklist(guildId).catch(() => false),
				db.guild?.isChannelIgnored(guildId, channelId).catch(() => false),
			]);
		} catch (error) {
			logger.error('InteractionCreate', `Database check failed: ${error.message}`);
		}

		if (isUserBlacklisted || isGuildBlacklisted) {
			return interaction
				.reply({
					content: 'You or this server is blacklisted.',
					flags: MessageFlags.Ephemeral,
				})
				.catch(() => {});
		}

		if (isChannelIgnored) {
			return interaction
				.reply({
					content: '**Ignored Channel** Commands are disabled in this channel.',
					flags: MessageFlags.Ephemeral,
				})
				.catch(() => {});
		}

		const commandToExecute = getCommandFile(interaction, client);
		if (!commandToExecute) {
			logger.warn(
				'InteractionCreate',
				`No command file found for: /${interaction.commandName}`,
			);
			return sendError(
				interaction,
				'Command Error',
				'This command seems to be outdated or improperly configured.',
				true,
			);
		}

		if (commandToExecute.cooldown && client.commandHandler) {
			try {
				const cooldown = await client.commandHandler.isOnCooldown(
					commandToExecute,
					userId,
					guildId,
				);
				if (cooldown) {
					return await sendCooldown(interaction, cooldown);
				}
				await client.commandHandler.setCooldown(commandToExecute, userId, guildId);
			} catch (error) {
				logger.error('InteractionCreate', `Cooldown check failed: ${error.message}`);
			}
		}

		try {
			const ctx = new CommandContext({ client, interaction });
			const permissionValidation = await validateCommand(ctx, commandToExecute);
			if (!permissionValidation.valid) {
				return sendError(
					interaction,
					permissionValidation.error?.title || 'Permission Error',
					permissionValidation.error?.description || 'You cannot use this command.',
					true,
				);
			}
			if (commandToExecute.shouldNotDefer) {
				await commandToExecute.execute({ ctx });
			} else {
				await interaction.deferReply();
				await commandToExecute.execute({ ctx });
			}
		} catch (error) {
			logger.error(
				'InteractionCreate',
				`Error executing: ${commandToExecute.slashData?.name || 'unknown'}`,
				error,
			);
			await sendError(
				interaction,
				'Command Error',
				'An unexpected error occurred while running the command.',
				true,
			);
		}
	} catch (error) {
		logger.error(
			'InteractionCreate',
			`Fatal error in command handler: ${error.message}`,
			error,
		);
	}
};

const handleAutocomplete = async (interaction, client) => {
	if (!interaction || !client) return;

	try {
		const commandToExecute = getCommandFile(interaction, client);
		if (!commandToExecute?.autocomplete) return;
		await commandToExecute.autocomplete({ interaction, client });
	} catch (error) {
		logger.error(
			'InteractionCreate',
			`Autocomplete error for '${interaction.commandName}': ${error.message}`,
		);
	}
};

export default {
	name: 'interactionCreate',
	async execute({ eventArgs, client }) {
		if (!eventArgs || !eventArgs[0] || !client) return;

		const [interaction] = eventArgs;

		try {
			if (interaction.type === InteractionType.ApplicationCommand) {
				await handleChatInputCommand(interaction, client);
			} else if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
				await handleAutocomplete(interaction, client);
			}
		} catch (error) {
			logger.error('InteractionCreate', `Fatal error: ${error.message}`, error);
		}
	},
};
