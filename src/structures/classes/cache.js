import { Rei, ReiT } from '#classes/rei';
import { logger } from '#utils';

/**
 * In-memory cache manager backed by {@link ReiT}.
 */
export class CacheManager {
        /**
         * @param {Object} config
         * @param {number} [config.maxSize=50000] - Max entries for the in-memory store.
         * @param {boolean} [config.flushOnStart] - Clear cache on bot startup.
         * @param {boolean} [config.flushOnShutdown] - Clear cache on bot shutdown.
         */
        constructor(config) {
                this.config = config;
                this.memory = new ReiT(config.maxSize || 50000);
                this.connected = true;
        }

        /** @returns {Promise<this>} */
        async init() {
                logger.info('Cache', 'Cache manager initialized with memory storage');
                return this;
        }

        async set(k, v, ttl) {
                this.memory.set(k, v, ttl);
                return true;
        }

        async setnxex(k, v, ttl) {
                if (this.memory.has(k)) return false;
                this.memory.set(k, v, ttl);
                return true;
        }

        async get(k) {
                return this.memory.get(k);
        }

        async has(k) {
                return this.memory.has(k);
        }

        async del(k) {
                this.memory.del(k);
                return true;
        }

        async mset(arr) {
                this.memory.mset(arr);
                return true;
        }

        async mget(keys) {
                return this.memory.mget(keys);
        }

        async mdel(keys) {
                this.memory.mdel(keys);
                return true;
        }

        async incr(k, d = 1) {
                return this.memory.incr(k, d);
        }

        async decr(k, d = 1) {
                return this.memory.decr(k, d);
        }

        async keys(pattern = '*') {
                return this.memory.keys(pattern);
        }

        async hset(k, f, v) {
                this.memory.hset(k, f, v);
                return true;
        }

        async hget(k, f) {
                return this.memory.hget(k, f);
        }

        async hdel(k, f) {
                this.memory.hdel(k, f);
                return true;
        }

        async hgetall(k) {
                return this.memory.hgetall(k);
        }

        async hmset(k, obj) {
                this.memory.hmset(k, obj);
                return true;
        }

        async hincrby(k, f, d = 1) {
                return this.memory.hincrby(k, f, d);
        }

        async sadd(k, ...members) {
                this.memory.sadd(k, ...members);
                return true;
        }

        async smembers(k) {
                return this.memory.smembers(k);
        }

        async sismember(k, m) {
                return this.memory.sismember(k, m);
        }

        async srem(k, ...members) {
                this.memory.srem(k, ...members);
                return true;
        }

        async lpush(k, ...values) {
                return this.memory.lpush(k, ...values);
        }

        async rpush(k, ...values) {
                return this.memory.rpush(k, ...values);
        }

        async lpop(k) {
                return this.memory.lpop(k);
        }

        async rpop(k) {
                return this.memory.rpop(k);
        }

        async lrange(k, start, stop) {
                return this.memory.lrange ? this.memory.lrange(k, start, stop) : [];
        }

        async llen(k) {
                return this.memory.llen ? this.memory.llen(k) : 0;
        }

        async expire(k, ttl) {
                return this.memory.expire ? this.memory.expire(k, ttl) : true;
        }

        async ttl(k) {
                return this.memory.ttl ? this.memory.ttl(k) : -1;
        }

        async clear() {
                this.memory.clear ? this.memory.clear() : null;
                return true;
        }

        async disconnect() {
                return true;
        }
}
