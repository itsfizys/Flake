import util from 'util';
import { config as conf } from '#config';

const config = {
	logLevel: 'debug',
	defaultContext: 'APP',
	timezone: 'Asia/Kolkata',
	colors: {
		info: '#2F6FD6',
		success: '#0FA37F',
		warning: '#C47A00',
		error: '#C2362B',
		debug: '#6B6B6B',
	},
	textColors: {
		message: '#D8DEE9',
		timestamp: '#7A7A7A',
		dimmed: '#4C4C4C',
		badge: '#E5E9F0',
	},
};

/**
 * Returns a function that wraps text in the given hex foreground colour using ANSI escape codes.
 * @param {string} hex - Hex colour string (e.g. `'#2F6FD6'`).
 * @returns {(t: string) => string}
 */
const rgb = (hex) => {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return (t) => `\x1b[38;2;${r};${g};${b}m${t}\x1b[0m`;
};

/**
 * Returns a function that wraps text with ANSI background + foreground colours,
 * adding a single space of padding on each side.
 * @param {string} bgHex - Background hex colour.
 * @param {string} fgHex - Foreground hex colour.
 * @returns {(t: string) => string}
 */
const bg = (bgHex, fgHex) => {
	const br = parseInt(bgHex.slice(1, 3), 16);
	const bgc = parseInt(bgHex.slice(3, 5), 16);
	const bb = parseInt(bgHex.slice(5, 7), 16);
	const fr = parseInt(fgHex.slice(1, 3), 16);
	const fg = parseInt(fgHex.slice(3, 5), 16);
	const fb = parseInt(fgHex.slice(5, 7), 16);
	return (t) => `\x1b[48;2;${br};${bgc};${bb}m\x1b[38;2;${fr};${fg};${fb}m ${t} \x1b[0m`;
};

/** Pre-built colouriser functions for common text roles. */
const text = {
	message: rgb(config.textColors.message),
	timestamp: rgb(config.textColors.timestamp),
	dimmed: rgb(config.textColors.dimmed),
};

/**
 * Structured console logger with coloured, badged output.
 *
 * Log format per line: `HH:MM:SS [CONTEXT] message`
 *
 * Supports five levels (`debug` < `info` < `success` < `warn` < `error`) and
 * filters output based on `config.logLevel`. Errors/warnings go to `console.warn`;
 * everything else to `console.log`. Stack traces are printed in dimmed colour below
 * the main line when an `Error` is passed as the last argument.
 */
class Logger {
	constructor() {
		/** @type {Object.<string, number>} Numeric severity for each level name. */
		this.levels = { debug: 0, info: 1, success: 2, warn: 3, error: 4 };
		this.consoleLogLevel = this.levels[config.logLevel] ?? 1;

		/** Coloured badge renderers keyed by level name. */
		this.badges = {
			info: bg(config.colors.info, config.textColors.badge),
			success: bg(config.colors.success, config.textColors.badge),
			warn: bg(config.colors.warning, config.textColors.badge),
			error: bg(config.colors.error, config.textColors.badge),
			debug: bg(config.colors.debug, config.textColors.badge),
		};
	}

	/**
	 * Returns the current time formatted as `HH:MM:SS` in the configured timezone.
	 * @returns {string}
	 */
	_time() {
		return new Date().toLocaleTimeString('en-IN', {
			timeZone: config.timezone,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		});
	}

	/**
	 * Returns the current date and time as a full locale string in the configured timezone.
	 * @returns {string}
	 */
	_fullTime() {
		return new Date().toLocaleString('en-IN', {
			timeZone: config.timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		});
	}

	/**
	 * Parses variadic log arguments into a structured object.
	 * Accepts an optional leading string as the context badge and an optional
	 * trailing `Error` instance whose stack is printed separately.
	 * @param {any[]} args
	 * @returns {{ context: string, msg: string, error: Error|null }}
	 */
	_parse(args) {
		let context = config.defaultContext;
		let error = null;
		const a = [...args];

		if (a[a.length - 1] instanceof Error) error = a.pop();
		if (typeof a[0] === 'string') context = a.shift();

		return { context, msg: a.length ? util.format(...a) : '', error };
	}

	/**
	 * Core log method. Skips output if `level` is below the configured threshold,
	 * or if level is `'debug'` and `conf.debug` is falsy.
	 * @param {'debug'|'info'|'success'|'warn'|'error'} level
	 * @param {...any} args - Optional leading context string, message parts, optional trailing Error.
	 */
	_log(level, ...args) {
		if (!conf.debug && level === 'debug') return;
		if (this.levels[level] < this.consoleLogLevel) return;

		const { context, msg, error } = this._parse(args);

		const line =
			`${text.timestamp(this._time())} ` +
			`${this.badges[level](context)} ` +
			`${text.message(msg)}`;

		(level === 'error' || level === 'warn' ? console.warn : console.log)(line);

		if (error) {
			const out = error.stack || error.message || util.inspect(error);
			console.log(text.dimmed(out));
		}
	}

	/** @param {...any} a */
	info(...a) {
		this._log('info', ...a);
	}
	/** @param {...any} a */
	success(...a) {
		this._log('success', ...a);
	}
	/** @param {...any} a */
	warn(...a) {
		this._log('warn', ...a);
	}
	/** @param {...any} a */
	error(...a) {
		this._log('error', ...a);
	}
	/** @param {...any} a */
	debug(...a) {
		this._log('debug', ...a);
	}
}

export const logger = new Logger();
