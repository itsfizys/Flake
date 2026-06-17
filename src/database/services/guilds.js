import { GuildRepository } from '#dbRepo/guilds';
import { config } from '#config';
import { logger } from '#utils';

/**
 * Business-logic layer for guild settings.
 * Delegates persistence to {@link GuildRepository} and ensures guilds
 * exist before any read/write via {@link ensureGuild}.
 */
export class GuildService {
	constructor() {
		this.repo = new GuildRepository();
	}

	/**
	 * Returns the guild record, or `null` if it doesn't exist.
	 * @param {string} guildId
	 * @returns {Promise<Object|null>}
	 */
	async getGuild(guildId) {
		return await this.repo.findById(guildId);
	}

	/**
	 * Returns the guild record, creating a default one if absent.
	 * @param {string} guildId
	 * @returns {Promise<Object>}
	 */
	async ensureGuild(guildId) {
		return await this.repo.findOrCreate(guildId);
	}

	/**
	 * Returns the guild's command prefixes. Falls back to the global default if none are set.
	 * @param {string} guildId
	 * @returns {Promise<string[]>}
	 */
	async getPrefixes(guildId) {
		const guild = await this.ensureGuild(guildId);
		return Array.isArray(guild.prefixes) && guild.prefixes.length > 0
			? guild.prefixes
			: [config.prefix];
	}

	/**
	 * Replaces the guild's prefix list.
	 * @param {string} guildId
	 * @param {string[]} prefixes
	 * @returns {Promise<void>}
	 */
	async setPrefixes(guildId, prefixes) {
		await this.ensureGuild(guildId);
		await this.repo.update(guildId, { prefixes });
	}

	/**
	 * Returns the list of channel IDs where commands are ignored.
	 * @param {string} guildId
	 * @returns {Promise<string[]>}
	 */
	async getIgnoredChannels(guildId) {
		const guild = await this.ensureGuild(guildId);
		return Array.isArray(guild.ignoredChannels) ? guild.ignoredChannels : [];
	}

	/**
	 * Replaces the guild's ignored-channels list.
	 * @param {string} guildId
	 * @param {string[]} channels
	 * @returns {Promise<void>}
	 */
	async setIgnoredChannels(guildId, channels) {
		await this.ensureGuild(guildId);
		await this.repo.update(guildId, { ignoredChannels: channels });
	}

	/**
	 * @param {string} guildId
	 * @param {string} channelId
	 * @returns {Promise<boolean>} `true` if commands in this channel should be ignored.
	 */
	async isChannelIgnored(guildId, channelId) {
		const ignored = await this.getIgnoredChannels(guildId);
		return ignored.includes(channelId);
	}

	/**
	 * Returns all guild rows from the database.
	 * @returns {Promise<Object[]>}
	 */
	async getAllGuilds() {
		return await this.repo.findAll();
	}

	/**
	 * Applies a partial settings update, silently ignoring unrecognised keys.
	 * @param {string} guildId
	 * @param {Object} settings - May include `prefixes` and/or `ignoredChannels`.
	 * @returns {Promise<number>} Number of fields actually updated.
	 */
	async updateSettings(guildId, settings) {
		await this.ensureGuild(guildId);

		const allowedKeys = ['prefixes', 'ignoredChannels'];
		const updates = {};

		for (const key of allowedKeys) {
			if (settings[key] === undefined) continue;
			updates[key] = settings[key];
		}

		if (Object.keys(updates).length === 0) return 0;

		await this.repo.update(guildId, updates);
		return Object.keys(updates).length;
	}

	/**
	 * @param {string} guildId
	 * @returns {Promise<Date|null>} Timestamp of the last avatar update, or `null`.
	 */
	async getAvatarUpdatedAt(guildId) {
		const guild = await this.ensureGuild(guildId);
		return guild.avatarUpdatedAt;
	}

	/**
	 * Stamps `avatarUpdatedAt` with the current time.
	 * @param {string} guildId
	 * @returns {Promise<true>}
	 */
	async setAvatarUpdatedAt(guildId) {
		await this.ensureGuild(guildId);
		await this.repo.update(guildId, { avatarUpdatedAt: new Date() });
		return true;
	}

	/**
	 * @param {string} guildId
	 * @returns {Promise<Date|null>}
	 */
	async getBannerUpdatedAt(guildId) {
		const guild = await this.ensureGuild(guildId);
		return guild.bannerUpdatedAt;
	}

	/**
	 * Stamps `bannerUpdatedAt` with the current time.
	 * @param {string} guildId
	 * @returns {Promise<true>}
	 */
	async setBannerUpdatedAt(guildId) {
		await this.ensureGuild(guildId);
		await this.repo.update(guildId, { bannerUpdatedAt: new Date() });
		return true;
	}

	/**
	 * @param {string} guildId
	 * @returns {Promise<Date|null>}
	 */
	async getBioUpdatedAt(guildId) {
		const guild = await this.ensureGuild(guildId);
		return guild.bioUpdatedAt;
	}

	/**
	 * Stamps `bioUpdatedAt` with the current time.
	 * @param {string} guildId
	 * @returns {Promise<true>}
	 */
	async setBioUpdatedAt(guildId) {
		await this.ensureGuild(guildId);
		await this.repo.update(guildId, { bioUpdatedAt: new Date() });
		return true;
	}

	/**
	 * @param {string} guildId
	 * @returns {Promise<boolean>} `true` if the guild is using a custom profile.
	 */
	async getCustomProfileStatus(guildId) {
		const guild = await this.ensureGuild(guildId);
		return guild.isCustomProfile;
	}

	/**
	 * @param {string} guildId
	 * @param {boolean} status
	 * @returns {Promise<void>}
	 */
	async setCustomProfileStatus(guildId, status) {
		await this.ensureGuild(guildId);
		await this.repo.update(guildId, { isCustomProfile: status });
	}

	/**
	 * Permanently removes a guild record from the database.
	 * Logs an error and returns early if `guildId` is falsy.
	 * @param {string} guildId
	 * @returns {Promise<void>}
	 */
	async deleteGuild(guildId) {
		if (!guildId) {
			logger.error('GuildService', 'Cannot delete guild: no guildId provided');
			return;
		}

		await this.repo.delete(guildId);
	}
}
