import { logger } from '#utils';

/**
 * Handles registration and teardown of Discord client event listeners.
 * Tracks every registered listener so they can be cleanly removed later.
 */
export default class DiscordHandler {
	/** @param {import('#classes/client').Bot} client */
	constructor(client) {
		this.client = client;
		/**
		 * @type {Map<string, Set<Function>>}
		 * Event name → set of bound listener functions.
		 * A Set (rather than a single Function) is used so that multiple listeners
		 * for the same event name can coexist and be individually removed without
		 * earlier registrations being silently overwritten.
		 */
		this.registeredEvents = new Map();
	}

	/**
	 * Attaches an event listener to the Discord client.
	 * Uses `once` for one-shot events, `on` for persistent ones.
	 * @param {{ name: string, once?: boolean, execute: Function }} event
	 * @returns {Promise<boolean>} `false` if registration failed.
	 */
	async register(event) {
		try {
			const listener = async (...args) => {
				try {
					await event.execute({ eventArgs: args, client: this.client });
				} catch (error) {
					logger.error('DiscordEvent', `Error in Discord event ${event.name}:`, error);
				}
			};

			if (event.once) {
				this.client.once(event.name, listener);
			} else {
				this.client.on(event.name, listener);
			}

			if (!this.registeredEvents.has(event.name)) {
				this.registeredEvents.set(event.name, new Set());
			}
			this.registeredEvents.get(event.name).add(listener);
			return true;
		} catch (error) {
			logger.error(
				'DiscordEvent',
				`Failed to register Discord event: ${event.name}`,
				error,
			);
			return false;
		}
	}

	/**
	 * Removes all listeners for a specific event name and forgets them.
	 * No-ops if the event was never registered.
	 * @param {string} eventName
	 * @returns {Promise<void>}
	 */
	async unregister(eventName) {
		const listeners = this.registeredEvents.get(eventName);
		if (listeners) {
			for (const listener of listeners) {
				this.client.removeListener(eventName, listener);
			}
			this.registeredEvents.delete(eventName);
		}
	}

	/**
	 * Removes all registered event listeners and clears the tracking map.
	 * @returns {Promise<void>}
	 */
	async unregisterAll() {
		for (const [eventName, listeners] of this.registeredEvents) {
			for (const listener of listeners) {
				this.client.removeListener(eventName, listener);
			}
		}
		this.registeredEvents.clear();
	}
}
