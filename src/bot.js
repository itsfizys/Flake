import { Bot } from '#classes/client';
import { logger } from '#utils';

const client = new Bot();
let isShuttingDown = false;

const shutdown = async (signal) => {
	if (isShuttingDown) return;
	isShuttingDown = true;
	logger.info('Shutdown', `Received ${signal}, shutting down gracefully`);
	try {
		await client.cleanup();
		logger.success('Shutdown', 'Bot shut down successfully');
		process.exit(0);
	} catch (error) {
		logger.error('Shutdown', 'Shutdown error:', error);
		process.exit(1);
	}
};

process.on('unhandledRejection', (reason) => {
	logger.error('Process', 'Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error, origin) => {
	logger.error('Process', `Uncaught Exception at ${origin}:`, error);
	// don't shutdown on uncaught exceptions
});

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

const main = async () => {
	try {
		await client.init();
	} catch (error) {
		logger.error('Main', 'Initialization failed:', error);
		await shutdown('initFailure');
	}
};

main();

export { client };
