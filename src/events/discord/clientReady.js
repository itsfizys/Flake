import { logger } from '#utils';
import { ActivityType } from 'discord.js';
import { Routes } from 'discord-api-types/v10';

export default {
        name: 'clientReady',
        once: true,
        async execute({ client }) {
                logger.success('Bot', `Logged in as ${client.user.tag}`);

                client.user.setPresence({
                        activities: [{ name: 'lost in sound, found at 11 ✨️', type: ActivityType.Custom }],
                        status: 'idle',
                });

                logger.info('Bot', `Serving ${client.guilds.cache.size} guilds`);

                const slashData = client.commandHandler.getSlashCommandsData();

                if (slashData.length > 0) {
                        try {
                                await client.rest.put(Routes.applicationCommands(client.user.id), {
                                        body: slashData,
                                });
                                logger.success('Bot', `Registered ${slashData.length} slash command(s) globally.`);
                        } catch (error) {
                                logger.error('Bot', 'Failed to register slash commands', error);
                        }
                } else {
                        logger.info('Bot', 'No slash commands to register.');
                }
        },
};
