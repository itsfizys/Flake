import { BlacklistRepository } from '#dbRepo/blacklist';

/**
 * Business-logic layer for blacklist management.
 * Wraps {@link BlacklistRepository} with idempotent create/delete helpers
 * and convenience methods for bulk operations by type.
 */
export class BlacklistService {
	constructor() {
		this.repo = new BlacklistRepository();
	}

	/**
	 * @param {string} id - User or guild ID.
	 * @returns {Promise<boolean>} `true` if the ID is currently blacklisted.
	 */
	async checkBlacklist(id) {
		return await this.repo.exists(id);
	}

	/**
	 * @param {string} id
	 * @returns {Promise<Object|null>} The full blacklist entry, or `null` if not found.
	 */
	async getBlacklist(id) {
		return await this.repo.findById(id);
	}

	/**
	 * Blacklists a user. Idempotent — returns the existing entry if already blacklisted.
	 * @param {string} userId
	 * @param {string} blacklistedBy - ID of the operator who issued the blacklist.
	 * @param {string} reason
	 * @returns {Promise<Object>} The new or existing blacklist entry.
	 */
	async blacklistUser(userId, blacklistedBy, reason) {
		if (await this.checkBlacklist(userId)) {
			return await this.getBlacklist(userId);
		}

		const data = {
			id: userId,
			blacklistedBy,
			reason,
			type: 'user',
			createdAt: new Date(),
		};

		await this.repo.create(data);

		return data;
	}

	/**
	 * Blacklists a guild. Idempotent — returns the existing entry if already blacklisted.
	 * @param {string} guildId
	 * @param {string} blacklistedBy - ID of the operator who issued the blacklist.
	 * @param {string} reason
	 * @returns {Promise<Object>} The new or existing blacklist entry.
	 */
	async blacklistGuild(guildId, blacklistedBy, reason) {
		if (await this.checkBlacklist(guildId)) {
			return await this.getBlacklist(guildId);
		}

		const data = {
			id: guildId,
			blacklistedBy,
			reason,
			type: 'guild',
			createdAt: new Date(),
		};

		await this.repo.create(data);

		return data;
	}

	/**
	 * Removes an ID from the blacklist.
	 * @param {string} id
	 * @returns {Promise<boolean>} `false` if the ID was not blacklisted; `true` on success.
	 */
	async unblacklist(id) {
		if (!(await this.checkBlacklist(id))) return false;
		await this.repo.delete(id);

		return true;
	}

	/**
	 * Returns all blacklist entries, optionally filtered by type.
	 * @param {'user'|'guild'} [type] - Omit to return all entries.
	 * @returns {Promise<Object[]>}
	 */
	async getAllBlacklist(type) {
		if (type) {
			return await this.repo.findByType(type);
		}
		return await this.repo.findAll();
	}

	/**
	 * Removes all blacklist entries of the given type.
	 * @param {'user'|'guild'} type
	 * @returns {Promise<void>}
	 */
	async unblacklistType(type) {
		await this.repo.deleteByType(type);
	}

	/**
	 * Removes all blacklisted guilds.
	 * @returns {Promise<void>}
	 */
	async unblacklistGuilds() {
		await this.unblacklistType('guild');
	}

	/**
	 * Removes all blacklisted users.
	 * @returns {Promise<void>}
	 */
	async unblacklistUsers() {
		await this.unblacklistType('user');
	}
}
