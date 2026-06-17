/**
 * In-memory LRU-style key-value store backed by a Map.
 * Evicts the oldest entry when capacity is exceeded.
 */
export class Rei {
	/**
	 * @param {number} [max=50000] - Maximum number of entries before eviction begins.
	 */
	constructor(max = 50000) {
		this.$ = new Map();
		this.max = max;
	}

	/**
	 * Stores a value. Evicts the oldest entry if at capacity.
	 * @param {string} k
	 * @param {*} v
	 * @returns {this}
	 */
	set(k, v) {
		const m = this.$;
		if (m.size >= this.max && !m.has(k)) {
			const first = m.keys().next().value;
			m.delete(first);
		}
		m.set(k, v);
		return this;
	}

	/** @param {string} k @returns {*} */
	get(k) {
		return this.$.get(k);
	}

	/** @param {string} k @returns {boolean} */
	has(k) {
		return this.$.has(k);
	}

	/** @param {string} k @returns {boolean} */
	del(k) {
		return this.$.delete(k);
	}

	/** @param {string} k @returns {boolean} */
	delete(k) {
		return this.$.delete(k);
	}

	/** Removes all entries. @returns {this} */
	clear() {
		this.$.clear();
		return this;
	}

	/** Non-promoting read — identical to `get` (no LRU promotion in this implementation). @param {string} k @returns {*} */
	peek(k) {
		return this.$.get(k);
	}

	/**
	 * Bulk-sets entries from an array of [key, value] pairs.
	 * @param {Array<[string, *]>} arr
	 * @returns {this}
	 */
	mset(arr) {
		// Delegate to this.set() so max-capacity eviction and side-effects are honoured.
		const len = arr.length;
		for (let i = 0; i < len; i++) {
			this.set(arr[i][0], arr[i][1]);
		}
		return this;
	}

	/** Alias for {@link mset}. */
	setMany(arr) {
		return this.mset(arr);
	}

	/**
	 * Bulk-gets values for an array of keys. Missing keys return `undefined`.
	 * @param {string[]} keys
	 * @returns {Array<*>}
	 */
	mget(keys) {
		const m = this.$;
		const len = keys.length;
		const out = new Array(len);
		for (let i = 0; i < len; i++) {
			out[i] = m.get(keys[i]);
		}
		return out;
	}

	/** Alias for {@link mget}. */
	getMany(keys) {
		return this.mget(keys);
	}

	/**
	 * Bulk-deletes entries by key.
	 * @param {string[]} keys
	 * @returns {this}
	 */
	mdel(keys) {
		const m = this.$;
		const len = keys.length;
		for (let i = 0; i < len; i++) {
			m.delete(keys[i]);
		}
		return this;
	}

	/** Alias for {@link mdel}. */
	deleteMany(keys) {
		return this.mdel(keys);
	}

	/** @param {string} k @returns {boolean} */
	exists(k) {
		return this.$.has(k);
	}

	/** @param {string} k @returns {boolean} */
	peekHas(k) {
		return this.$.has(k);
	}

	/**
	 * Returns the stored value, or `d` if the key doesn't exist.
	 * @param {string} k
	 * @param {*} d - Default value.
	 * @returns {*}
	 */
	getOr(k, d) {
		const v = this.$.get(k);
		return v === undefined ? d : v;
	}

	/**
	 * Sets a value only if the key does not already exist.
	 * @param {string} k
	 * @param {*} v
	 * @returns {0|1} 1 if set, 0 if key already existed.
	 */
	setnx(k, v) {
		// Delegate to this.set() so max-capacity eviction is honoured.
		if (!this.$.has(k)) {
			this.set(k, v);
			return 1;
		}
		return 0;
	}

	/**
	 * Sets a value only if the key does not already exist.
	 * @param {string} k
	 * @param {*} v
	 * @returns {boolean} `true` if set, `false` if key already existed.
	 */
	setNX(k, v) {
		// Delegate to this.set() so max-capacity eviction is honoured.
		if (!this.$.has(k)) {
			this.set(k, v);
			return true;
		}
		return false;
	}

	/**
	 * Increments a numeric value by `d`. Initialises to `d` if the key doesn't exist.
	 * @param {string} k
	 * @param {number} [d=1]
	 * @returns {number} New value.
	 */
	incr(k, d = 1) {
		// Use this.set() so eviction is honoured.
		// Use +v (Number coercion) instead of (v | 0) to avoid 32-bit integer truncation.
		const v = this.$.get(k);
		if (v === undefined) {
			this.set(k, d);
			return d;
		}
		const n = +v + d;
		this.set(k, n);
		return n;
	}

	/** @param {string} k @param {number} d @returns {number} */
	incrby(k, d) {
		return this.incr(k, d);
	}

	/**
	 * Decrements a numeric value by `d`.
	 * @param {string} k
	 * @param {number} [d=1]
	 * @returns {number} New value.
	 */
	decr(k, d = 1) {
		return this.incr(k, -d);
	}

	/** @param {string} k @param {number} d @returns {number} */
	decrby(k, d) {
		return this.incr(k, -d);
	}

	/**
	 * Returns and removes a value atomically.
	 * @param {string} k
	 * @returns {*} The removed value, or `undefined` if missing.
	 */
	pop(k) {
		const m = this.$;
		const v = m.get(k);
		if (v !== undefined) m.delete(k);
		return v;
	}

	/**
	 * Returns all keys, optionally filtered by a glob-style pattern (`*` wildcard).
	 * @param {string} [pattern='*']
	 * @returns {string[]}
	 */
	keys(pattern) {
		const m = this.$;
		if (!pattern || pattern === '*') {
			return Array.from(m.keys());
		}
		// Escape all regex metacharacters except '*', then convert '*' to '.*'.
		const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
		const regex = new RegExp(`^${escaped}$`);
		const matches = [];
		for (const k of m.keys()) {
			if (regex.test(k)) matches.push(k);
		}
		return matches;
	}

	/** @returns {Array<*>} */
	values() {
		return Array.from(this.$.values());
	}

	/** @returns {Array<[string, *]>} */
	entries() {
		return Array.from(this.$.entries());
	}

	// ─── Hash (object) operations ────────────────────────────────────────────────

	/**
	 * Sets a field on a hash stored at `k`. Initialises the hash if needed.
	 * @param {string} k - Hash key.
	 * @param {string} f - Field name.
	 * @param {*} v - Field value.
	 * @returns {this}
	 */
	hset(k, f, v) {
		let h = this.$.get(k);
		if (!h || typeof h !== 'object' || Array.isArray(h) || h instanceof Set) {
			h = {};
			// Use this.set() so max-capacity eviction is enforced on new hash creation.
			this.set(k, h);
		}
		h[f] = v;
		return this;
	}

	/**
	 * Gets a single field from a hash.
	 * @param {string} k @param {string} f @returns {*}
	 */
	hget(k, f) {
		const h = this.$.get(k);
		return h && typeof h === 'object' && !Array.isArray(h) && !(h instanceof Set)
			? h[f]
			: undefined;
	}

	/**
	 * Deletes a field from a hash.
	 * @param {string} k @param {string} f @returns {boolean}
	 */
	hdel(k, f) {
		const h = this.$.get(k);
		if (h && typeof h === 'object' && !Array.isArray(h) && !(h instanceof Set)) {
			delete h[f];
			return true;
		}
		return false;
	}

	/**
	 * Returns all fields and values of a hash, or `{}` if none exists.
	 * @param {string} k @returns {Object}
	 */
	hgetall(k) {
		const h = this.$.get(k);
		return h && typeof h === 'object' && !Array.isArray(h) && !(h instanceof Set)
			? h
			: {};
	}

	/**
	 * Merges `obj` into the hash at `k`. Initialises the hash if needed.
	 * @param {string} k @param {Object} obj @returns {this}
	 */
	hmset(k, obj) {
		let h = this.$.get(k);
		if (!h || typeof h !== 'object' || Array.isArray(h) || h instanceof Set) {
			h = {};
			// Use this.set() so max-capacity eviction is enforced on new hash creation.
			this.set(k, h);
		}
		Object.assign(h, obj);
		return this;
	}

	/**
	 * Gets multiple fields from a hash. Returns `undefined` for missing fields.
	 * @param {string} k
	 * @param {string[]} fields
	 * @returns {Array<*>}
	 */
	hmget(k, fields) {
		const h = this.$.get(k);
		if (!h || typeof h !== 'object' || Array.isArray(h) || h instanceof Set) {
			return fields.map(() => undefined);
		}
		const len = fields.length;
		const out = new Array(len);
		for (let i = 0; i < len; i++) {
			out[i] = h[fields[i]];
		}
		return out;
	}

	/**
	 * Increments a numeric hash field by `d`. Initialises to `d` if missing.
	 * @param {string} k @param {string} f @param {number} [d=1]
	 * @returns {number} New field value.
	 */
	hincrby(k, f, d = 1) {
		let h = this.$.get(k);
		if (!h || typeof h !== 'object' || Array.isArray(h) || h instanceof Set) {
			h = {};
			// Use this.set() so max-capacity eviction is enforced on new hash creation.
			this.set(k, h);
		}
		const v = h[f];
		const n = (v === undefined ? 0 : v | 0) + d;
		h[f] = n;
		return n;
	}

	// ─── Set operations ───────────────────────────────────────────────────────────

	/**
	 * Adds one or more members to the set at `k`.
	 * @param {string} k @param {...*} members @returns {this}
	 */
	sadd(k, ...members) {
		let s = this.$.get(k);
		if (!s || !(s instanceof Set)) {
			s = new Set();
			// Use this.set() so max-capacity eviction is enforced on new Set creation.
			this.set(k, s);
		}
		const len = members.length;
		for (let i = 0; i < len; i++) {
			s.add(members[i]);
		}
		return this;
	}

	/**
	 * Returns all members of the set at `k`, or `[]` if none exists.
	 * @param {string} k @returns {Array<*>}
	 */
	smembers(k) {
		const s = this.$.get(k);
		return s instanceof Set ? Array.from(s) : [];
	}

	/**
	 * @param {string} k @param {*} m @returns {boolean}
	 */
	sismember(k, m) {
		const s = this.$.get(k);
		return s instanceof Set ? s.has(m) : false;
	}

	/**
	 * Removes one or more members from the set at `k`.
	 * @param {string} k @param {...*} members @returns {this}
	 */
	srem(k, ...members) {
		const s = this.$.get(k);
		if (s instanceof Set) {
			const len = members.length;
			for (let i = 0; i < len; i++) {
				s.delete(members[i]);
			}
		}
		return this;
	}

	// ─── List operations ──────────────────────────────────────────────────────────

	/**
	 * Prepends values to the list at `k`.
	 * @param {string} k @param {...*} values @returns {number} New list length.
	 */
	lpush(k, ...values) {
		let arr = this.$.get(k);
		if (!Array.isArray(arr)) {
			arr = [];
			// Use this.set() so max-capacity eviction is enforced on new list creation.
			this.set(k, arr);
		}
		arr.unshift(...values);
		return arr.length;
	}

	/**
	 * Appends values to the list at `k`.
	 * @param {string} k @param {...*} values @returns {number} New list length.
	 */
	rpush(k, ...values) {
		let arr = this.$.get(k);
		if (!Array.isArray(arr)) {
			arr = [];
			// Use this.set() so max-capacity eviction is enforced on new list creation.
			this.set(k, arr);
		}
		arr.push(...values);
		return arr.length;
	}

	/**
	 * Removes and returns the first element of the list at `k`.
	 * @param {string} k @returns {*}
	 */
	lpop(k) {
		const arr = this.$.get(k);
		return Array.isArray(arr) ? arr.shift() : undefined;
	}

	/**
	 * Removes and returns the last element of the list at `k`.
	 * @param {string} k @returns {*}
	 */
	rpop(k) {
		const arr = this.$.get(k);
		return Array.isArray(arr) ? arr.pop() : undefined;
	}

	/**
	 * Returns a slice of the list. Use `stop = -1` to include all remaining elements.
	 * @param {string} k @param {number} start @param {number} stop @returns {Array<*>}
	 */
	lrange(k, start, stop) {
		const arr = this.$.get(k);
		if (!Array.isArray(arr)) return [];
		const end = stop === -1 ? arr.length : stop + 1;
		return arr.slice(start, end);
	}

	/**
	 * @param {string} k @returns {number} Length of the list, or 0 if absent.
	 */
	llen(k) {
		const arr = this.$.get(k);
		return Array.isArray(arr) ? arr.length : 0;
	}

	// ─── Meta ─────────────────────────────────────────────────────────────────────

	/** Total number of top-level entries. @type {number} */
	get size() {
		return this.$.size;
	}

	/** @type {number} */
	get length() {
		return this.$.size;
	}

	/** @returns {number} */
	dbsize() {
		return this.$.size;
	}

	/** Clears all entries. `@returns` {this} */
	flushdb() {
		return this.clear();
	}

	/** Clears all entries. `@returns` {this} */
	flushall() {
		return this.clear();
	}
}

/**
 * Extends {@link Rei} with TTL (time-to-live) support via `setTimeout`.
 * Keys expire automatically after the specified duration.
 */
export class ReiT extends Rei {
	/**
	 * @param {number} [max=5000] - Maximum number of entries before eviction begins.
	 */
	constructor(max = 5000) {
		super(max);
		/** @type {Map<string, number>} Stores expiry timestamps; named ttlMap to avoid shadowing the ttl(k) method. */
		this.ttlMap = new Map();
		this.intervals = new Map();
	}

	/**
	 * Stores a value with an optional TTL.
	 * @param {string} k
	 * @param {*} v
	 * @param {number} [ttl] - Expiry in seconds.
	 * @returns {this}
	 */
	set(k, v, ttl) {
		// Clear any existing timer for this key before writing the new value.
		// This prevents stale timeouts firing on overwritten or TTL-removed keys.
		const existingTimeout = this.intervals.get(k);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
			this.intervals.delete(k);
			this.ttlMap.delete(k);
		}
		super.set(k, v);
		if (ttl) {
			this.expire(k, ttl);
		}
		return this;
	}

	/**
	 * Sets or resets the expiry for an existing key.
	 * Clears any previously scheduled timeout before setting the new one.
	 * @param {string} k
	 * @param {number} seconds
	 * @returns {this}
	 */
	expire(k, seconds) {
		const existing = this.intervals.get(k);
		if (existing) clearTimeout(existing);

		const timeout = setTimeout(() => {
			this.$.delete(k);
			this.ttlMap.delete(k);
			this.intervals.delete(k);
		}, seconds * 1000);

		this.intervals.set(k, timeout);
		this.ttlMap.set(k, Date.now() + seconds * 1000);
		return this;
	}

	/**
	 * Returns the remaining TTL in seconds. Returns `-1` if no expiry is set,
	 * `-2` if the key has already expired.
	 * @param {string} k @returns {number}
	 */
	ttl(k) {
		const expiry = this.ttlMap.get(k);
		if (!expiry) return -1;
		const remaining = Math.ceil((expiry - Date.now()) / 1000);
		return remaining > 0 ? remaining : -2;
	}

	/** Cancels all pending timeouts and clears all data. @returns {this} */
	clear() {
		for (const timeout of this.intervals.values()) {
			clearTimeout(timeout);
		}
		this.intervals.clear();
		this.ttlMap.clear();
		super.clear();
		return this;
	}

	/**
	 * Deletes a key and cancels its expiry timeout if one exists.
	 * @param {string} k @returns {boolean}
	 */
	del(k) {
		const timeout = this.intervals.get(k);
		if (timeout) {
			clearTimeout(timeout);
			this.intervals.delete(k);
		}
		this.ttlMap.delete(k);
		return super.del(k);
	}

	/** @param {string} k @returns {boolean} */
	delete(k) {
		return this.del(k);
	}
}
