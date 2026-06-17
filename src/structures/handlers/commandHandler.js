import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '#utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Default button interaction cooldown in milliseconds. */
const BTN_COOLDOWN_MS = 3_000;

/**
 * Loads, indexes, and manages all bot commands.
 *
 * Maintains separate maps for prefix commands, aliases, array-name commands,
 * slash commands, categories, and file paths. Also handles command and
 * button cooldowns via the cache.
 */
export class CommandHandler {
	/** @param {import('#classes/client').Bot} client */
	constructor(client) {
		this.client = client;
		/** @type {Map<string, import('#classes/Command').Command>} Prefix commands keyed by name. */
		this.commands = new Map();
		/** @type {Map<string, string>} Alias → command name. */
		this.aliases = new Map();
		/** @type {Map<string, import('#classes/Command').Command[]>} First word → commands with array names. */
		this.arrayCommands = new Map();
		/** @type {Map<string, Object>} Finalised slash command data keyed by top-level name. */
		this.slashCommands = new Map();
		/** @type {Map<string, import('#classes/Command').Command>} Commands with slash enabled, keyed by slash name. */
		this.slashCommandFiles = new Map();
		/** @type {Map<string, import('#classes/Command').Command[]>} Category name → commands. */
		this.categories = new Map();
		/** @type {Map<string, string>} Command name → absolute file path. */
		this.commandPaths = new Map();
	}

	/**
	 * Clears all maps and recursively loads commands from `dirPath`.
	 * @param {string} [dirPath='../../commands'] - Path relative to this file.
	 * @returns {Promise<void>}
	 */
	async loadCommands(dirPath = '../../commands') {
		logger.info('CommandHandler', 'Loading commands...');
		this.commands.clear();
		this.aliases.clear();
		this.arrayCommands.clear();
		this.slashCommands.clear();
		this.slashCommandFiles.clear();
		this.categories.clear();
		this.commandPaths.clear();

		const commandsAbsolutePath = path.join(__dirname, dirPath);

		try {
			await this._recursivelyLoadCommands(commandsAbsolutePath);
			this._finalizeSlashCommands();
			logger.success(
				'CommandHandler',
				`Loaded ${this.commands.size} prefix and ${this.slashCommandFiles.size} slash commands.`,
			);
		} catch (error) {
			logger.error('CommandHandler', 'Failed to load commands', error);
		}
	}

	/**
	 * Walks `dirPath` recursively and loads every `.js` file as a command.
	 * The directory name relative to the commands root becomes the category.
	 * @param {string} dirPath
	 * @param {string} [relativePath='']
	 * @returns {Promise<void>}
	 */
	async _recursivelyLoadCommands(dirPath, relativePath = '') {
		try {
			const entries = fs.readdirSync(dirPath, { withFileTypes: true });

			const loadPromises = entries.map(async (entry) => {
				const fullPath = path.join(dirPath, entry.name);
				const currentRelativePath = relativePath
					? path.join(relativePath, entry.name)
					: entry.name;

				if (entry.isDirectory()) {
					await this._recursivelyLoadCommands(fullPath, currentRelativePath);
				} else if (entry.isFile() && entry.name.endsWith('.js')) {
					const category = relativePath || 'default';

					if (!this.categories.has(category)) {
						this.categories.set(category, []);
					}
					await this._loadCommandFile(fullPath, category);
				}
			});

			await Promise.all(loadPromises);
		} catch (error) {
			logger.error('CommandHandler', `Failed to read directory: ${dirPath}`, error);
			throw error;
		}
	}

	/**
	 * Imports a single command file and registers it in all relevant maps.
	 * Supports both string and array `command.name` values.
	 * @param {string} filePath - Absolute path to the command file.
	 * @param {string} category
	 * @returns {Promise<void>}
	 */
	async _loadCommandFile(filePath, category) {
		try {
			const commandModule = await import(`file://${filePath}`);

			if (!commandModule?.default) {
				logger.warn(
					'CommandHandler',
					`Invalid command file: ${path.basename(filePath)} is missing a default export.`,
				);
				return;
			}

			const command = commandModule.default;
			command.category = category;

			if (Array.isArray(command.name)) {
				const firstPart = command.name[0].toLowerCase();

				if (command.name.length > 1) {
					if (!this.arrayCommands.has(firstPart)) {
						this.arrayCommands.set(firstPart, []);
					}
					this.arrayCommands.get(firstPart).push(command);
				}

				const arrayKey = command.name.join(':').toLowerCase();
				this.commands.set(arrayKey, command);
				this.commandPaths.set(arrayKey, filePath);
			} else {
				const cmdName = command.name.toLowerCase();
				this.commandPaths.set(cmdName, filePath);
				this.commands.set(cmdName, command);
			}

			if (command.aliases?.length) {
				if (Array.isArray(command.name)) {
					const arrayKey = command.name.join(':').toLowerCase();
					command.aliases.forEach((alias) =>
						this.aliases.set(alias.toLowerCase(), arrayKey),
					);
				} else {
					const cmdName = command.name.toLowerCase();
					command.aliases.forEach((alias) =>
						this.aliases.set(alias.toLowerCase(), cmdName),
					);
				}
			}

			if (command.enabledSlash && command.slashData) {
				const slashKey = Array.isArray(command.slashData.name)
					? command.slashData.name.join(':')
					: command.slashData.name;
				this.slashCommandFiles.set(slashKey, command);
			}

			this.categories.get(category)?.push(command);
		} catch (error) {
			logger.error(
				'CommandHandler',
				`Failed to load command file: ${path.basename(filePath)}`,
				error,
			);
		}
	}

	/**
	 * Builds the final slash command tree from all loaded slash-enabled commands.
	 * Handles top-level commands, subcommand groups (depth 2), and nested subcommands (depth 3).
	 * Called automatically at the end of {@link loadCommands}.
	 */
	_finalizeSlashCommands() {
		for (const command of this.slashCommandFiles.values()) {
			const { name, description, options, defaultMemberPermissions } = command.slashData;

			if (Array.isArray(name)) {
				if (name.length === 2) {
					const [main, sub] = name;
					let mainCmd = this.slashCommands.get(main);

					if (!mainCmd) {
						mainCmd = {
							name: main,
							description: `${main} commands`,
							options: [],
						};
						if (defaultMemberPermissions) {
							mainCmd.default_member_permissions = defaultMemberPermissions.toString();
						}
						this.slashCommands.set(main, mainCmd);
					}

					const hasSubcommands = options?.some((opt) => opt.type === 1);

					if (hasSubcommands) {
						let groupObj = mainCmd.options.find(
							(opt) => opt.name === sub && opt.type === 2,
						);

						if (!groupObj) {
							groupObj = {
								name: sub,
								description: description || `${sub} commands`,
								type: 2,
								options: [],
							};
							mainCmd.options.push(groupObj);
						}

						options.forEach((opt) => {
							if (opt.type === 1) {
								groupObj.options.push(opt);
							}
						});
					} else {
						mainCmd.options.push({
							name: sub,
							description,
							options: options || [],
							type: 1,
						});
					}
				} else if (name.length === 3) {
					const [main, group, sub] = name;
					let mainCmd = this.slashCommands.get(main);

					if (!mainCmd) {
						mainCmd = {
							name: main,
							description: `${main} commands`,
							options: [],
						};
						if (defaultMemberPermissions) {
							mainCmd.default_member_permissions = defaultMemberPermissions.toString();
						}
						this.slashCommands.set(main, mainCmd);
					}

					let groupObj = mainCmd.options.find(
						(opt) => opt.name === group && opt.type === 2,
					);

					if (!groupObj) {
						groupObj = {
							name: group,
							description: `${group} group under ${main}`,
							type: 2,
							options: [],
						};
						mainCmd.options.push(groupObj);
					}

					groupObj.options.push({
						name: sub,
						description,
						options: options || [],
						type: 1,
					});
				} else {
					logger.warn(
						'CommandHandler',
						`Unsupported slashData.name depth for command: ${command.name}`,
					);
				}
			} else {
				const cmdData = {
					name,
					description,
					options: options || [],
				};
				if (defaultMemberPermissions) {
					cmdData.default_member_permissions = defaultMemberPermissions.toString();
				}
				this.slashCommands.set(name, cmdData);
			}
		}
	}

	/**
	 * Returns the finalised slash command payload array ready for Discord API registration.
	 * @returns {Object[]}
	 */
	getSlashCommandsData() {
		return Array.from(this.slashCommands.values());
	}

	/**
	 * Writes a cooldown entry to cache.
	 * Also clears any existing cooldown-notified flag so the user can be notified again.
	 * @param {import('#classes/Command').Command} command
	 * @param {string} userId
	 * @param {string} guildId
	 * @returns {Promise<void>}
	 */
	async setCooldown(command, userId, guildId) {
		const commandKey = Array.isArray(command.name)
			? command.name.join(':').toLowerCase()
			: command.name.toLowerCase();

		const cooldown = command.cooldown;

		if (cooldown) {
			const cooldownKey = `cd:${commandKey}:${userId}:${guildId}`;
			await this.client.c.set(cooldownKey, Date.now() + cooldown * 1000, cooldown);
			await this.client.c.del(`cdn:${cooldownKey}`);
		}
	}

	/**
	 * Checks whether a user is on cooldown for a command.
	 * Cleans up the cache entry if the cooldown has already expired.
	 * @param {import('#classes/Command').Command} command
	 * @param {string} userId
	 * @param {string} guildId
	 * @returns {Promise<number|null>} Remaining ms, or `null` if not on cooldown.
	 */
	async isOnCooldown(command, userId, guildId) {
		const cooldown = command.cooldown;
		if (!cooldown) return null;

		const commandKey = Array.isArray(command.name)
			? command.name.join(':').toLowerCase()
			: command.name.toLowerCase();

		const cooldownKey = `cd:${commandKey}:${userId}:${guildId}`;
		const cooldownValue = await this.client.c.get(cooldownKey);

		if (!cooldownValue) return null;

		const remaining = cooldownValue - Date.now();

		if (remaining > 0) {
			return remaining;
		} else {
			await this.client.c.del(cooldownKey);
			await this.client.c.del(`cdn:${cooldownKey}`);
			return null;
		}
	}

	/**
	 * Returns `true` the first time this is called for an active cooldown window,
	 * preventing repeated "you're on cooldown" messages for a single cooldown period.
	 * @param {import('#classes/Command').Command} command
	 * @param {string} userId
	 * @param {string} guildId
	 * @returns {Promise<boolean>}
	 */
	async shouldNotifyAboutCooldown(command, userId, guildId) {
		const commandKey = Array.isArray(command.name)
			? command.name.join(':').toLowerCase()
			: command.name.toLowerCase();

		const cooldownKey = `cd:${commandKey}:${userId}:${guildId}`;
		const hasNotified = await this.client.c.get(`cdn:${cooldownKey}`);

		if (!hasNotified) {
			await this.client.c.set(`cdn:${cooldownKey}`, 1, command.cooldown);
			return true;
		}

		return false;
	}

	/**
	 * Records a button cooldown in cache. The cache TTL is set 1 second longer
	 * than the cooldown to avoid a race condition on expiry.
	 * @param {string} customId - The button's custom ID.
	 * @param {string} userId
	 * @param {string} guildId
	 * @param {number} [ms=BTN_COOLDOWN_MS]
	 * @returns {Promise<void>}
	 */
	async setButtonCooldown(customId, userId, guildId, ms = BTN_COOLDOWN_MS) {
		const key = `cd:btn:${customId}:${userId}:${guildId}`;
		await this.client.c.set(key, Date.now() + ms, Math.ceil(ms / 1000) + 1);
	}

	/**
	 * Checks whether a button is on cooldown. Cleans up expired entries.
	 * @param {string} customId
	 * @param {string} userId
	 * @param {string} guildId
	 * @returns {Promise<number|null>} Remaining ms, or `null` if not on cooldown.
	 */
	async isButtonOnCooldown(customId, userId, guildId) {
		const key = `cd:btn:${customId}:${userId}:${guildId}`;
		const val = await this.client.c.get(key);
		if (!val) return null;
		const remaining = val - Date.now();
		if (remaining > 0) return remaining;
		await this.client.c.del(key);
		return null;
	}

	/**
	 * Atomically checks and sets a button cooldown in a single cache operation.
	 * Uses SET NX EX (Redis) or an equivalent single-step primitive (memory) so
	 * there is no read-then-write race between the existence check and the write.
	 * Returns the remaining cooldown if already active, or `null` when a fresh
	 * cooldown was successfully installed.
	 * @param {string} customId
	 * @param {string} userId
	 * @param {string} guildId
	 * @param {number} [ms=BTN_COOLDOWN_MS]
	 * @returns {Promise<number|null>}
	 */
	async checkAndSetButtonCooldown(customId, userId, guildId, ms = BTN_COOLDOWN_MS) {
		const key = `cd:btn:${customId}:${userId}:${guildId}`;
		const ttlSeconds = Math.ceil(ms / 1000) + 1;
		const expiry = Date.now() + ms;
		const wasSet = await this.client.c.setnxex(key, expiry, ttlSeconds);
		if (wasSet) return null;
		const val = await this.client.c.get(key);
		if (!val) return null;
		const remaining = val - Date.now();
		return remaining > 0 ? remaining : null;
	}
}
