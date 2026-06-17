import mongoose from 'mongoose';
import { logger } from '#utils';
import { config } from '#config';

/**
 * Initialises the MongoDB connection via Mongoose.
 * Idempotent — returns immediately if already connected.
 * @throws {Error} If MONGODB_URI / DATABASE_URL is not set in config.
 * @returns {Promise<void>}
 */
export const initDatabase = async () => {
        if (mongoose.connection.readyState === 1) return;

        const uri = config.database.url;

        if (!uri) {
                throw new Error('MONGODB_URI (or DATABASE_URL) is required');
        }

        await mongoose.connect(uri);
        logger.success('Database', 'MongoDB connection initialized');
};

/**
 * Gracefully closes the MongoDB connection.
 * @returns {Promise<void>}
 */
export const closeDatabase = async () => {
        if (mongoose.connection.readyState !== 0) {
                await mongoose.connection.close();
                logger.info('Database', 'MongoDB connection closed');
        }
};
