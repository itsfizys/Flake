import { Command } from '#command';
import {
	PermissionFlagsBits,
	MessageFlags,
	ButtonStyle,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	ButtonBuilder,
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
} from 'discord.js';
import { db } from '#dbManager';
import { config } from '#config';
import { emoji } from '#emoji';
const { colors } = config;

import { disableComponents, logger } from '#utils';

class PrefixCommand extends Command {
	constructor() {
		super({
			name: 'prefix',
			description: 'Manage server prefixes',
			usage: 'prefix',
			aliases: ['prefixes', 'setprefix'],
			category: 'Configuration',
			cooldown: 120,
			examples: ['prefix', 'prefix add', 'prefix remove'],
			userPermissions: [PermissionFlagsBits.ManageGuild],
			enabledSlash: true,
			slashData: {
				name: 'prefix',
				description: 'Manage server prefixes',
				defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
			},
		});
	}

	async execute({ ctx }) {
		if (!ctx.guild) {
			return ctx.reply('This command is only available in servers');
		}

		const prefixes = await db.guild.getPrefixes(ctx.guild.id);
		const container = this._renderPrefixEditor(prefixes);

		await ctx.reply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});

		const message = await ctx.fetchReply();
		this._startCollector(ctx, message);
	}

	_renderPrefixEditor(prefixes, feedback = null) {
		const container = new ContainerBuilder();
		container.setAccentColor(colors.bot);

		const display = prefixes.map((p) => `\`${p}\``).join(' • ');

		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent('## Server Prefixes'),
		);

		container.addSeparatorComponents(
			new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
		);

		const feedbackText = feedback ? `\n\n${feedback}` : '';
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`${display}${feedbackText}\n\n-# ${prefixes.length} of 10 prefixes`,
			),
		);

		container.addSeparatorComponents(
			new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
		);

		container.addActionRowComponents(
			new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('prefix|edit')
					.setLabel('Edit Prefixes')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('prefix|reset')
					.setLabel('Reset Default')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(prefixes.length === 1 && prefixes[0] === config.prefix),
			),
		);

		return container;
	}

	_startCollector(ctx, message) {
		const collector = message.createMessageComponentCollector({
			time: 300_000,
			filter: (i) => {
				if (i.user.id !== ctx.author.id) {
					i.reply({
						content: `${emoji.cross} Not your command dude, Use ur own command `,
						flags: MessageFlags.Ephemeral,
					});
					return false;
				}
				return true;
			},
		});

		collector.on('collect', async (interaction) => {
			try {
				await this._handleAction(ctx, message, interaction);
			} catch (error) {
				logger.error('Prefix', 'Interaction error', error);
			}
		});

		collector.on('end', async () => {
			try {
				await disableComponents(message);
			} catch {}
		});
	}

	async _handleAction(ctx, msg, i) {
		const [action, param] = i.customId.split('|');

		if (action === 'prefix') {
			if (param === 'edit') {
				await this._handlePrefixModal(ctx, msg, i);
			} else if (param === 'reset') {
				await i.deferUpdate();
				await db.guild.setPrefixes(ctx.guild.id, [config.prefix]);

				const prefixes = await db.guild.getPrefixes(ctx.guild.id);
				await msg.edit({
					components: [
						this._renderPrefixEditor(prefixes, `${emoji.check} Reset to default`),
					],
				});

				setTimeout(async () => {
					try {
						const updatedPrefixes = await db.guild.getPrefixes(ctx.guild.id);
						await msg.edit({
							components: [this._renderPrefixEditor(updatedPrefixes)],
						});
					} catch (e) {
						logger.error('Prefix', 'Clear feedback error', e);
					}
				}, 2000);
			}
		}
	}

	async _handlePrefixModal(ctx, msg, i) {
		const current = await db.guild.getPrefixes(ctx.guild.id);

		const modal = new ModalBuilder()
			.setCustomId(`modal_${i.id}`)
			.setTitle('Edit Server Prefixes');

		modal.addComponents(
			new ActionRowBuilder().addComponents(
				new TextInputBuilder()
					.setCustomId('input')
					.setLabel('Enter prefixes (space-separated)')
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('! ? . >>')
					.setValue(current.join(' '))
					.setRequired(true)
					.setMaxLength(100),
			),
		);

		await i.showModal(modal);

		try {
			const submit = await i.awaitModalSubmit({
				filter: (s) => s.customId === `modal_${i.id}`,
				time: 120_000,
			});

			await submit.deferUpdate();

			const input = submit.fields.getTextInputValue('input').trim();
			const newPrefixes = input
				.split(/\s+/)
				.filter((p) => p.length > 0 && p.length <= 10);

			if (newPrefixes.length === 0) {
				const prefixes = await db.guild.getPrefixes(ctx.guild.id);
				await msg.edit({
					components: [
						this._renderPrefixEditor(
							prefixes,
							`${emoji.cross} Provide at least one valid prefix`,
						),
					],
				});

				setTimeout(async () => {
					try {
						const updatedPrefixes = await db.guild.getPrefixes(ctx.guild.id);
						await msg.edit({
							components: [this._renderPrefixEditor(updatedPrefixes)],
						});
					} catch (e) {
						logger.error('Prefix', 'Clear feedback error', e);
					}
				}, 2000);
				return;
			}

			const unique = [...new Set(newPrefixes)].slice(0, 10);
			await db.guild.setPrefixes(ctx.guild.id, unique);

			const prefixes = await db.guild.getPrefixes(ctx.guild.id);
			await msg.edit({
				components: [
					this._renderPrefixEditor(prefixes, `${emoji.check} Prefixes updated`),
				],
			});

			setTimeout(async () => {
				try {
					const updatedPrefixes = await db.guild.getPrefixes(ctx.guild.id);
					await msg.edit({
						components: [this._renderPrefixEditor(updatedPrefixes)],
					});
				} catch (e) {
					logger.error('Prefix', 'Clear feedback error', e);
				}
			}, 2000);
		} catch (e) {
			if (e.code !== 'InteractionCollectorError') {
				logger.error('Prefix', 'Modal error', e);
			}
		}
	}
}

export default new PrefixCommand();
