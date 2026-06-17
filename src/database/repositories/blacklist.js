import { Blacklist } from '#dbSchema/blacklist';
import { client } from '#src/bot';

const CACHE_TTL = 36000;
const CACHE_PREFIX = 'blacklist:';

export class BlacklistRepository {
        /**
         * Fetches a blacklist entry by ID.
         * @param {string} id
         * @returns {Promise<Object|null>}
         */
        async findById(id) {
                if (!id) return null;

                const cacheKey = `${CACHE_PREFIX}${id}`;
                const cached = await client.c.get(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const entry = await Blacklist.findById(id).lean();
                const result = entry ? this._normalise(entry) : null;
                if (result) {
                        await client.c.set(cacheKey, result, CACHE_TTL);
                }

                return result;
        }

        /**
         * Returns whether an ID is blacklisted.
         * @param {string} id
         * @returns {Promise<boolean>}
         */
        async exists(id) {
                if (!id) return false;

                const cacheKey = `${CACHE_PREFIX}exists:${id}`;
                const cached = await client.c.get(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const entry = await this.findById(id);
                const result = !!entry;

                await client.c.set(cacheKey, result, CACHE_TTL);
                return result;
        }

        /**
         * Inserts a new blacklist entry.
         * @param {{ id: string, type: string, [key: string]: any }} data
         * @returns {Promise<void>}
         */
        async create(data) {
                if (!data?.id) return;

                await Blacklist.findByIdAndUpdate(
                        data.id,
                        { $setOnInsert: { blacklistedBy: data.blacklistedBy, reason: data.reason, type: data.type } },
                        { upsert: true, new: true },
                );

                await Promise.all([
                        client.c.set(`${CACHE_PREFIX}${data.id}`, data, CACHE_TTL),
                        client.c.set(`${CACHE_PREFIX}exists:${data.id}`, true, CACHE_TTL),
                        this._invalidateListCaches(data.type),
                ]);
        }

        /**
         * Deletes an entry by ID and clears all related caches.
         * @param {string} id
         * @returns {Promise<void>}
         */
        async delete(id) {
                if (!id) return;

                const entry = await this.findById(id);
                await Blacklist.findByIdAndDelete(id);
                await this._invalidateCaches(id, entry?.type);
        }

        /**
         * Returns all blacklist entries.
         * @returns {Promise<Object[]>}
         */
        async findAll() {
                const cacheKey = `${CACHE_PREFIX}all`;
                const cached = await client.c.get(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const result = (await Blacklist.find().lean()).map(this._normalise);
                await client.c.set(cacheKey, result, 600);

                return result;
        }

        /**
         * Returns all entries matching type.
         * @param {string} type
         * @returns {Promise<Object[]>}
         */
        async findByType(type) {
                if (!type) return [];

                const cacheKey = `${CACHE_PREFIX}type:${type}`;
                const cached = await client.c.get(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const result = (await Blacklist.find({ type }).lean()).map(this._normalise);
                await client.c.set(cacheKey, result, CACHE_TTL);
                return result;
        }

        /**
         * Deletes all entries of a given type.
         * @param {string} type
         * @returns {Promise<void>}
         */
        async deleteByType(type) {
                if (!type) return;

                await Blacklist.deleteMany({ type });
                await this._invalidateTypeCaches(type);
        }

        /** @private */
        _normalise(doc) {
                if (!doc) return null;
                const { _id, __v, ...rest } = doc;
                return { id: _id, ...rest };
        }

        /** @private */
        async _invalidateCaches(id, type) {
                const keys = [
                        `${CACHE_PREFIX}${id}`,
                        `${CACHE_PREFIX}exists:${id}`,
                        `${CACHE_PREFIX}all`,
                ];
                if (type) keys.push(`${CACHE_PREFIX}type:${type}`);
                await client.c.mdel(keys);
        }

        /** @private */
        async _invalidateListCaches(type) {
                const keys = [`${CACHE_PREFIX}all`];
                if (type) keys.push(`${CACHE_PREFIX}type:${type}`);
                await client.c.mdel(keys);
        }

        /** @private */
        async _invalidateTypeCaches(type) {
                const pattern = `${CACHE_PREFIX}*`;
                const keys = await client.c.keys(pattern);
                await client.c.mdel(keys);
        }
}
