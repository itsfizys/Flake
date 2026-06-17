/**
 * Command class
 * Base class for all bot commands (prefix and slash)
 */
export class Command {
	/**
	 * Creates a new Command instance
	 * @param {Object} [options={}] - Command configuration options
	 * @param {string} options.name - Command name
	 * @param {string} [options.description] - Command description
	 * @param {string} [options.usage] - Usage syntax
	 * @param {Array<string>} [options.aliases] - Command aliases
	 * @param {string} [options.category] - Command category
	 * @param {number} [options.cooldown] - Cooldown in seconds
	 * @param {Array<string>} [options.examples] - Usage examples
	 * @param {Array} [options.permissions] - Required bot permissions
	 * @param {Array} [options.userPermissions] - Required user permissions
	 * @param {boolean} [options.ownerOnly] - Owner-only command
	 * @param {boolean} [options.voiceRequired] - User must be in voice
	 * @param {boolean} [options.sameVoiceChannel] - Same voice as bot required
	 * @param {boolean} [options.enabledSlash] - Enable as slash command
	 * @param {boolean} [options.shouldNotDefer] - Should not defer
	 * @param {Object} [options.slashData] - Slash command data
	 */
	constructor(options = {}) {
		this.name = options.name;
		this.description = options.description || 'No description provided';
		this.usage = options.usage || this.name;
		this.aliases = options.aliases || [];
		this.category = options.category || 'Miscellaneous';
		this.cooldown = options.cooldown || 3;
		this.examples = options.examples || [];

		this.permissions = options.permissions || [];
		this.userPermissions = options.userPermissions || [];
		this.ownerOnly = options.ownerOnly || false;
		this.voiceRequired = options.voiceRequired || false;
		this.sameVoiceChannel = options.sameVoiceChannel || false;
		this.enabledSlash = options.enabledSlash || false;
		this.shouldNotDefer = options.shouldNotDefer || false;
		this.slashData = options.slashData || null;
	}

	/**
	 * Executes the command
	 * Must be overridden in command implementations
	 * @async
	 * @param {CommandContext} context - The command execution context
	 * @throws {Error} If not implemented
	 */
	async execute(context) {
		throw new Error(`Prefix command ${this.name} doesn't provide an execute method!`);
	}

	/**
	 * Handles autocomplete for slash command options
	 * @async
	 * @param {CommandContext} context - The autocomplete context
	 */
	async autocomplete(context) {}
}
