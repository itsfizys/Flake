import { REST } from '@discordjs/rest';
import { Client, GatewayIntentBits, Options } from 'discord.js';
import { config } from '#config';
import { db } from '#dbManager';
import { CommandHandler } from '#handlers/commandHandler';
import { EventLoader } from '#handlers/eventLoader';
import { logger } from '#utils';
import { CacheManager } from '#classes/cache';

/**
 * Central bot client extending discord.js {@link Client}.
 *
 * Wires together the cache, database, command handler, and event loader,
 * and exposes lifecycle methods for startup and teardown.
 */
export class Bot extends Client {
        constructor() {
                const clientOptions = {
                        intents: [
                                GatewayIntentBits.Guilds,
                                GatewayIntentBits.GuildMessages,
                                GatewayIntentBits.MessageContent,
                                GatewayIntentBits.GuildMembers,
                        ],
                        partials: [],
                        allowedMentions: { parse: [], repliedUser: false },
                        makeCache: Options.cacheWithLimits({
                                MessageManager: {
                                        maxSize: 0,
                                        keepOverLimit: (msg) => msg.author?.id === msg.client.user?.id,
                                },
                                ThreadManager: 0,
                                ThreadMemberManager: 0,
                                UserManager: {
                                        maxSize: 10,
                                        keepOverLimit: (user) => user.id === user.client.user?.id,
                                },
                                GuildMemberManager: {
                                        maxSize: 50,
                                        keepOverLimit: (member) => member.voice?.channelId != null,
                                },
                                ReactionManager: 0,
                                ReactionUserManager: 0,
                                PresenceManager: 0,
                                VoiceStateManager: {
                                        maxSize: 50,
                                        keepOverLimit: (vs) => vs.channelId != null,
                                },
                                StageInstanceManager: 0,
                                GuildBanManager: 0,
                                GuildInviteManager: 0,
                                ApplicationCommandManager: 0,
                                BaseGuildEmojiManager: 0,
                                GuildStickerManager: 0,
                                AutoModerationRuleManager: 0,
                                GuildScheduledEventManager: 0,
                        }),
                        sweepers: {
                                messages: {
                                        interval: 180,
                                        lifetime: 180,
                                        filter: () => (msg) => msg.author?.id !== msg.client.user?.id,
                                },
                                users: {
                                        interval: 300,
                                        filter: () => (user) => user.id !== user.client.user?.id,
                                },
                                guildMembers: {
                                        interval: 300,
                                        filter: () => (member) =>
                                                member.voice?.channelId == null && member.id !== member.client.user?.id,
                                },
                                threadMembers: {
                                        interval: 300,
                                        filter: () => () => true,
                                },
                                threads: {
                                        interval: 300,
                                        filter: () => () => true,
                                },
                        },
                        failIfNotExists: false,
                        rest: {
                                timeout: 15000,
                                retries: 2,
                                hashLifetime: 300000,
                                hashSweepInterval: 300000,
                        },
                        ws: {
                                large_threshold: 50,
                        },
                };

                super(clientOptions);
                this.cache = new CacheManager(config.cache);
                /** Shorthand alias for {@link cache}. */
                this.c = this.cache;
                this.logger = logger;
                this.config = config;
                this.commandHandler = new CommandHandler(this);
                this.eventHandler = new EventLoader(this);
                this.rest = new REST({ version: '10' }).setToken(config.token);
                /** Initialised during {@link init}. @type {import('#db/Manager').DatabaseManager|null} */
                this.db = null;
        }

        /**
         * Bootstraps the bot: initialises the cache, database, events, commands, then logs in.
         * Optionally flushes the cache on startup depending on config.
         * @throws {Error} Re-throws any initialisation error after logging it.
         * @returns {Promise<void>}
         */
        async init() {
                try {
                        await this.c.init();
                        if (this.config.cache.flushOnStart) {
                                await this.c.clear();
                                this.logger.info('Bot', 'Cache flushed on startup');
                        }

                        this.db = await db.init();
                        this.logger.info('Bot', 'Database initialized');

                        await this.eventHandler.loadAllEvents();
                        await this.commandHandler.loadCommands();
                        await this.login(config.token);
                } catch (error) {
                        this.logger.error('Bot', 'Failed to initialize bot:', error);
                        throw error;
                }
        }

        /**
         * Gracefully shuts down the bot: flushes or disconnects the cache,
         * closes all database connections, and destroys the Discord client.
         * @throws {Error} Re-throws any cleanup error after logging it.
         * @returns {Promise<void>}
         */
        async cleanup() {
                this.logger.warn('Bot', 'Starting cleanup...');
                try {
                        if (this.config.cache.flushOnShutdown) {
                                await this.c.clear();
                                this.logger.info('Bot', 'Cache flushed on shutdown');
                        } else {
                                await this.c.disconnect();
                        }

                        if (this.db) {
                                await this.db.closeAll();
                        }

                        this.destroy();
                        this.logger.success('Bot', 'Cleanup completed');
                } catch (error) {
                        this.logger.error('Bot', 'Cleanup error:', error);
                        throw error;
                }
        }
}
