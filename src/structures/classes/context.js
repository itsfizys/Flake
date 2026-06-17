/**
 * Command Context class
 * Unified context for both prefix and slash commands
 * Provides consistent API regardless of invocation method
 */
export class CommandContext {
	/**
	 * Creates a new CommandContext
	 * @param {Object} options - Context options
	 * @param {Bot} options.client - The bot client
	 * @param {Message} [options.message] - Discord message (for prefix commands)
	 * @param {Interaction} [options.interaction] - Discord interaction (for slash commands)
	 * @param {Array<string>} [options.args] - Command arguments (for prefix commands)
	 */
	constructor({ client, message, interaction, args }) {
		this.client = client;
		this.message = message;
		this.interaction = interaction;
		this.args = args || [];
		this.isSlash = !!interaction;
		this.isPrefix = !!message;
		this.isInteraction = this.isSlash;
		this.options = this.isSlash ? interaction.options : null;
	}

	/**
	 * Gets the user who invoked the command
	 * @returns {User} Discord user object
	 */
	get user() {
		return this.isSlash ? this.interaction.user : this.message.author;
	}

	/**
	 * Alias for user property
	 * @returns {User} Discord user object
	 */
	get author() {
		return this.isSlash ? this.interaction.user : this.message.author;
	}

	/**
	 * Gets the guild member who invoked the command
	 * @returns {GuildMember} Discord guild member object
	 */
	get member() {
		return this.isSlash ? this.interaction.member : this.message.member;
	}

	/**
	 * Gets the guild where command was invoked
	 * @returns {Guild} Discord guild object
	 */
	get guild() {
		return this.isSlash ? this.interaction.guild : this.message.guild;
	}

	/**
	 * Gets the channel where command was invoked
	 * @returns {Channel} Discord channel object
	 */
	get channel() {
		return this.isSlash ? this.interaction.channel : this.message.channel;
	}

	/**
	 * Gets the command name
	 * @returns {string} Command name
	 */
	get commandName() {
		return this.isSlash
			? this.interaction.commandName
			: this.message.content.split(/\s+/)[0];
	}

	/**
	 * Whether a reply has been sent
	 * @returns {boolean} True if replied
	 */
	get replied() {
		return this.isSlash ? this.interaction.replied : !!this._replyMessage;
	}

	/**
	 * Whether the reply has been deferred
	 * @returns {boolean} True if deferred
	 */
	get deferred() {
		return this.isSlash ? this.interaction.deferred : this._deferred;
	}

	/**
	 * Checks if command was invoked in a guild
	 * @returns {boolean} True if in guild
	 */
	inGuild() {
		return this.isSlash ? this.interaction.inGuild() : !!this.message.guild;
	}

	/**
	 * Replies to the command
	 * @async
	 * @param {Object} options - Reply options (Discord message options)
	 * @returns {Promise<Message>} The reply message
	 */
	async reply(options) {
		if (this.isSlash) {
			if (this.interaction.deferred) {
				return await this.interaction.editReply(options);
			}
			return await this.interaction.reply(options);
		}
		this._replyMessage = await this.message.reply(options);
		return this._replyMessage;
	}

	/**
	 * Edits the reply
	 * @async
	 * @param {Object} options - Edit options
	 * @returns {Promise<Message>} The edited message
	 * @throws {Error} If no initial reply exists for prefix commands
	 */
	async editReply(options) {
		if (this.isSlash) {
			return await this.interaction.editReply(options);
		}
		if (!this._replyMessage) {
			throw new Error('Cannot edit reply: no initial reply found');
		}
		return await this._replyMessage.edit(options);
	}

	/**
	 * Defers the reply (shows thinking state)
	 * @async
	 * @param {Object} [options={}] - Defer options
	 * @param {boolean} [options.fetchReply=false] - Whether to fetch the reply after deferring]
	 * @returns {Promise<void>}
	 */
	async deferReply(options = {}) {
		if (this.isSlash) {
			if (this.interaction.deferred) return;
			return await this.interaction.deferReply(options);
		}
		this._deferred = true;
		if (options.fetchReply) {
			this._replyMessage = await this.message.channel.sendTyping();
		}
	}

	/**
	 * Sends a follow-up message
	 * @async
	 * @param {Object} options - Message options
	 * @returns {Promise<Message>} The follow-up message
	 */
	async followUp(options) {
		if (this.isSlash) {
			return await this.interaction.followUp(options);
		}
		return await this.message.channel.send(options);
	}

	/**
	 * Deletes the reply
	 * @async
	 * @returns {Promise<void>}
	 */
	async deleteReply() {
		if (this.isSlash) {
			return await this.interaction.deleteReply();
		}
		if (this._replyMessage) {
			return await this._replyMessage.delete();
		}
	}

	/**
	 * Fetches the reply message
	 * @async
	 * @returns {Promise<Message|null>} The reply message or null
	 */
	async fetchReply() {
		if (this.isSlash) {
			return await this.interaction.fetchReply();
		}
		return this._replyMessage || null;
	}

	/**
	 * Sends a typing indicator
	 * @async
	 * @returns {Promise<void>}
	 */
	async sendTyping() {
		if (this.isSlash) {
			if (!this.deferred && !this.replied) {
				return await this.deferReply();
			}
			return;
		}
		return await this.message.channel.sendTyping();
	}
}
