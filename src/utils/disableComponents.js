import { logger } from '#utils';
import { ComponentType, ButtonStyle, MessageFlags } from 'discord.js';

/**
 * Edits a message to disable all interactive components.
 * Link buttons are left enabled since they can't be interacted with in the usual sense.
 * Silently ignores Discord errors for unknown messages, channels, or missing access.
 * @param {import('discord.js').Message} msg
 * @returns {Promise<void>}
 */
export async function disableComponents(msg) {
	try {
		if (!msg?.components?.length) return;

		const disabled = msg.components.map((c) => {
			const j = c.toJSON();

			if (c.type === ComponentType.ActionRow) {
				j.components = c.components.map((s) => {
					const sj = s.toJSON();
					return sj.type === ComponentType.Button && sj.style === ButtonStyle.Link
						? sj
						: { ...sj, disabled: true };
				});
			} else if ([ComponentType.Container, ComponentType.Section].includes(c.type)) {
				j.components = _disableNested(c.components);

				if (c.accessory?.type === ComponentType.Button) {
					const aj = c.accessory.toJSON();
					j.accessory = aj.style === ButtonStyle.Link ? aj : { ...aj, disabled: true };
				}
			}

			return j;
		});

		await msg.edit({
			components: disabled,
			flags: MessageFlags.IsComponentsV2,
		});
	} catch (err) {
		// 10008 = unknown message, 10003 = unknown channel, 50001 = missing access
		if (![10008, 10003, 50001].includes(err.code)) {
			logger.error('Utils', 'disableComponents error', err);
		}
	}
}

/**
 * Recursively disables buttons inside Container and Section components.
 * Link buttons are preserved as-is.
 * @param {import('discord.js').Component[]} comps
 * @returns {Object[]} Serialised component data with buttons disabled.
 */
export function _disableNested(comps) {
	return comps.map((c) => {
		const j = c.toJSON();

		if (c.type === ComponentType.ActionRow) {
			j.components = c.components.map((s) => {
				const sj = s.toJSON();
				return sj.type === ComponentType.Button && sj.style === ButtonStyle.Link
					? sj
					: { ...sj, disabled: true };
			});
		} else if ([ComponentType.Container, ComponentType.Section].includes(c.type)) {
			j.components = _disableNested(c.components);

			if (c.accessory?.type === ComponentType.Button) {
				const aj = c.accessory.toJSON();
				j.accessory = aj.style === ButtonStyle.Link ? aj : { ...aj, disabled: true };
			}
		}

		return j;
	});
}
