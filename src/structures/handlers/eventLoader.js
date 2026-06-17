import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '#utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Discovers, imports, and registers all event files.
 *
 * Events are organised under `events/<type>/`, where `<type>` corresponds to a
 * handler class in `event-handlers/`. Each handler is responsible for registering
 * events with its own target (e.g. the Discord client, a voice connection, etc.).
 */
export class EventLoader {
	/** @param {import('#classes/client').Bot} client */
	constructor(client) {
		this.client = client;
		/** @type {Map<string, Object[]>} Event type → list of loaded event modules. */
		this.loadedEvents = new Map();
		/** @type {Map<string, Object>} Event type → handler instance. */
		this.handlers = new Map();
		this.eventsPath = path.join(__dirname, '../../events');
		this.handlersPath = path.join(__dirname, 'event-handlers');
	}

	/**
	 * Entry point: loads all handlers then discovers and registers all event files.
	 * @returns {Promise<boolean>} `true` on success, `false` if a top-level error occurs.
	 */
	async loadAllEvents() {
		try {
			await this.loadHandlers();
			await this.loadEventsByType();

			const totalEvents = Array.from(this.loadedEvents.values()).reduce(
				(sum, events) => sum + events.length,
				0,
			);

			logger.success('EventLoader', `Successfully loaded ${totalEvents} events`);
			return true;
		} catch (error) {
			logger.error('EventLoader', 'Failed to load events');
			logger.error('EventLoader', error.message);
			return false;
		}
	}

	/**
	 * Imports every `.js` file in `event-handlers/`, instantiates each default export,
	 * and stores the instance in {@link handlers} keyed by the filename (sans `-handler.js`).
	 * @returns {Promise<void>}
	 */
	async loadHandlers() {
		try {
			if (!fs.existsSync(this.handlersPath)) {
				logger.warn('EventLoader', `Handlers directory not found: ${this.handlersPath}`);
				return;
			}

			const handlerFiles = await fs.promises.readdir(this.handlersPath);

			for (const file of handlerFiles) {
				if (file.endsWith('.js')) {
					const handlerPath = path.join(this.handlersPath, file);
					const handlerModule = await import(`file://${handlerPath}`);

					if (handlerModule?.default) {
						const handler = new handlerModule.default(this.client);
						const handlerName = file.replace('.js', '').replace('-handler', '');
						this.handlers.set(handlerName, handler);
					}
				}
			}
		} catch (error) {
			logger.error('EventLoader', 'Failed to load handlers', error);
		}
	}

	/**
	 * Reads the top-level directories under `events/`. Each directory name is treated as an
	 * event type and must have a matching handler; unmatched types are skipped with a warning.
	 * @returns {Promise<void>}
	 */
	async loadEventsByType() {
		try {
			if (!fs.existsSync(this.eventsPath)) {
				logger.warn('EventLoader', `Events directory not found: ${this.eventsPath}`);
				return;
			}

			const eventTypeEntries = await fs.promises.readdir(this.eventsPath, {
				withFileTypes: true,
			});

			for (const entry of eventTypeEntries) {
				if (entry.isDirectory()) {
					const eventType = entry.name;
					const eventTypePath = path.join(this.eventsPath, eventType);

					if (this.handlers.has(eventType)) {
						await this.recursiveLoadEvents(eventTypePath, eventType);
					} else {
						logger.warn('EventLoader', `No handler found for event type: ${eventType}`);
					}
				}
			}
		} catch (error) {
			logger.error('EventLoader', 'Failed to load events by type', error);
		}
	}

	/**
	 * Recursively walks `dirPath` and loads every `.js` file as an event.
	 * @param {string} dirPath
	 * @param {string} eventType
	 * @returns {Promise<void>}
	 */
	async recursiveLoadEvents(dirPath, eventType) {
		try {
			const entries = await fs.promises.readdir(dirPath, {
				withFileTypes: true,
			});

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);

				if (entry.isDirectory()) {
					await this.recursiveLoadEvents(fullPath, eventType);
				} else if (entry.isFile() && entry.name.endsWith('.js')) {
					await this.loadEventFile(fullPath, eventType);
				}
			}
		} catch (error) {
			logger.error('EventLoader', `Failed to read directory: ${dirPath}`, error);
		}
	}

	/**
	 * Imports a single event file, passes its default export to the appropriate handler
	 * for registration, and records it in {@link loadedEvents}.
	 * @param {string} filePath - Absolute path to the event file.
	 * @param {string} eventType
	 * @returns {Promise<void>}
	 */
	async loadEventFile(filePath, eventType) {
		try {
			const module = await import(`file://${filePath}`);
			if (!module?.default) return;

			const event = module.default;
			const handler = this.handlers.get(eventType);

			// Defensive guard: loadEventsByType already verifies handler existence before
			// calling recursiveLoadEvents → loadEventFile, so this branch is unreachable
			// in normal operation. It is kept intentionally to protect against direct
			// calls to loadEventFile that bypass that pre-check.
			if (!handler) {
				logger.warn('EventLoader', `No handler found for event type: ${eventType}`);
				return;
			}

			await handler.register(event);

			if (!this.loadedEvents.has(eventType)) {
				this.loadedEvents.set(eventType, []);
			}
			this.loadedEvents.get(eventType).push(event);
		} catch (error) {
			logger.error('EventLoader', `Failed to load event: ${filePath}`);
			logger.error('EventLoader', error.message);
		}
	}

	/**
	 * Returns a plain object snapshot of all loaded events grouped by type.
	 * @returns {Object.<string, Object[]>}
	 */
	getLoadedEvents() {
		return Object.fromEntries(this.loadedEvents);
	}

	/**
	 * Returns the names of all registered handler types.
	 * @returns {string[]}
	 */
	getHandlers() {
		return Array.from(this.handlers.keys());
	}

	/**
	 * Reads the `events/` directory and returns the names of all subdirectories
	 * (i.e. the available event types), without importing anything.
	 * @returns {string[]}
	 */
	getAvailableEventTypes() {
		try {
			if (!fs.existsSync(this.eventsPath)) return [];

			return fs
				.readdirSync(this.eventsPath, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name);
		} catch (error) {
			logger.error('EventLoader', 'Failed to get available event types', error);
			return [];
		}
	}
}
