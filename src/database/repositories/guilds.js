import { Guild } from '#dbSchema/guilds';
import { config } from '#config';
import { client } from '#src/bot';

const CACHE_TTL = 18000;
const CACHE_PREFIX = 'guild:';

export class GuildRepository {
        /**
         * Fetches a guild by ID. Returns the cached record if available.
         * @param {string} guildId
         * @returns {Promise<Object|null>}
         */
        async findById(guildId) {
                if (!guildId) return null;

                const cacheKey = `${CACHE_PREFIX}${guildId}`;
                const cached = await client.c.get(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const guild = await Guild.findById(guildId).lean();
                const result = guild ? this._normalise(guild) : null;
                if (result) {
                        await client.c.set(cacheKey, result, CACHE_TTL);
                }

                return result;
        }

        /**
         * Returns the guild record, creating a default one if absent.
         * @param {string} guildId
         * @returns {Promise<Object>}
         */
        async findOrCreate(guildId) {
                if (!guildId) throw new Error('Invalid guildId');

                let guild = await this.findById(guildId);
                if (!guild) {
                        const doc = await Guild.findByIdAndUpdate(
                                guildId,
                                { $setOnInsert: { prefixes: [config.prefix], ignoredChannels: [] } },
                                { upsert: true, new: true },
                        ).lean();
                        guild = this._normalise(doc);

                        await Promise.all([
                                client.c.set(`${CACHE_PREFIX}${guildId}`, guild, CACHE_TTL),
                                this._invalidateListCaches(),
                        ]);
                }

                return guild;
        }

        /**
         * Applies a partial update to a guild document.
         * @param {string} guildId
         * @param {Object} data
         * @returns {Promise<void>}
         */
        async update(guildId, data) {
                if (!guildId) return;

                await Guild.findByIdAndUpdate(guildId, { $set: data });
                await this._invalidateGuildCaches(guildId);
        }

        /**
         * Deletes a guild document and purges its cache entries.
         * @param {string} guildId
         * @returns {Promise<void>}
         */
        async delete(guildId) {
                if (!guildId) return;

                await Guild.findByIdAndDelete(guildId);
                await this._invalidateGuildCaches(guildId);
        }

        /**
         * Returns all guild documents.
         * @returns {Promise<Object[]>}
         */
        async findAll() {
                const cacheKey = `${CACHE_PREFIX}all`;
                const cached = await client.c.get(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const result = (await Guild.find().lean()).map(this._normalise);
                await client.c.set(cacheKey, result, 1800);

                return result;
        }

        /** @private */
        _normalise(doc) {
                if (!doc) return null;
                const { _id, __v, ...rest } = doc;
                return { id: _id, ...rest };
        }

        /** @private */
        async _invalidateGuildCaches(guildId) {
                await client.c.mdel([`${CACHE_PREFIX}${guildId}`, `${CACHE_PREFIX}all`]);
        }

        /** @private */
        async _invalidateListCaches() {
                await client.c.mdel([`${CACHE_PREFIX}all`]);
        }
}
