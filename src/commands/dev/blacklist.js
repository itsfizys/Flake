import { Command } from '#command';
import { logger } from '#utils';
import emoji from '#emoji';
import { db } from '#dbManager';

class BlacklistCommand extends Command {
	constructor() {
		super({
			name: 'blacklist',
			description: 'Manage user and guild blacklists',
			usage: 'blacklist <add|remove|check|list> [id] [reason]',
			aliases: ['bl'],
			category: 'developer',
			examples: [
				'blacklist add 123456789 Spamming',
				'bl remove 123456789',
				'bl check 123456789',
				'bl list',
				'bl list user',
				'bl list guild',
			],
			ownerOnly: true,
			enabledSlash: false,
		});
	}

	async execute({ ctx }) {
		const action = ctx.args[0]?.toLowerCase();

		if (!action) {
			return ctx.reply(`**Usage:** \`${this.usage}\``);
		}

		switch (action) {
			case 'add':
				return this.handleAdd(ctx);
			case 'remove':
			case 'rm':
				return this.handleRemove(ctx);
			case 'check':
				return this.handleCheck(ctx);
			case 'list':
				return this.handleList(ctx);
			default:
				return ctx.reply(`**Invalid action!** Use: add, remove, check, or list`);
		}
	}
	async handleAdd(ctx) {
		const type = ctx.args[1]?.toLowerCase();
		const id = ctx.args[2];
		const reason = ctx.args.slice(3).join(' ') || 'No reason provided';

		if (!type || (type !== 'user' && type !== 'guild'))
			return ctx.reply('Provide type: user | guild');

		if (!id) return ctx.reply('Provide ID');

		if (await db.blacklist.checkBlacklist(id)) return ctx.reply('Already blacklisted');

		try {
			if (type === 'user') await db.blacklist.blacklistUser(id, ctx.user.id, reason);
			else await db.blacklist.blacklistGuild(id, ctx.user.id, reason);

			return ctx.reply(`Added ${type} ${id}`);
		} catch {
			return ctx.reply('Failed');
		}
	}

	async handleRemove(ctx) {
		const id = ctx.args[1];

		if (!id) {
			return ctx.reply(`**Missing ID!** Provide a user or guild ID.`);
		}

		if (!(await db.blacklist.checkBlacklist(id))) {
			return ctx.reply(`**Not Blacklisted!** This ID is not in the blacklist.`);
		}

		try {
			await db.blacklist.unblacklist(id);
			return ctx.reply(`**Removed!** ID \`${id}\` has been removed from the blacklist.`);
		} catch (error) {
			logger.error('Blacklist', `Failed to remove ${id} from blacklist`, error);
			return ctx.reply(`**Error!** Failed to remove from blacklist.`);
		}
	}

	async handleCheck(ctx) {
		const id = ctx.args[1];

		if (!id) {
			return ctx.reply(`**Missing ID!** Provide a user or guild ID.`);
		}

		const entry = await db.blacklist.getBlacklist(id);

		if (!entry) {
			return ctx.reply(` **Not Blacklisted!** ID \`${id}\` is not in the blacklist.`);
		}

		return ctx.reply(
			`${emoji.get('info')} **Blacklist Entry**\n` +
				`**ID:** ${entry.id}\n` +
				`**Type:** ${entry.type}\n` +
				`**Reason:** ${entry.reason}\n` +
				`**Blacklisted By:** <@${entry.blacklistedBy}>\n` +
				`**Date:** <t:${Math.floor(new Date(entry.created_at).getTime() / 1000)}:F>`,
		);
	}

	async handleList(ctx) {
		const type = ctx.args[1]?.toLowerCase();

		if (type && type !== 'user' && type !== 'guild') {
			return ctx.reply(`**Invalid type!** Use: user or guild`);
		}

		const entries = await db.blacklist.getAllBlacklist(type);

		if (!entries || entries.length === 0) {
			return ctx.reply(`**No Entries!** No ${type || 'blacklisted'} entries found.`);
		}

		const typeFilter = type ? ` ${type}` : '';
		let response = `${emoji.get('info')} **Blacklist${typeFilter} (${entries.length})**\n\n`;

		entries.slice(0, 10).forEach((entry) => {
			response += `**${entry.type}** \`${entry.id}\` - ${entry.reason}\n`;
		});

		if (entries.length > 10) {
			response += `\n*...and ${entries.length - 10} more*`;
		}

		return ctx.reply(response);
	}
}

export default new BlacklistCommand();
