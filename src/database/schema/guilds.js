import mongoose from 'mongoose';

const guildSchema = new mongoose.Schema(
        {
                _id: { type: String },
                prefixes: { type: [String], default: ['.'] },
                ignoredChannels: { type: [String], default: [] },
                isCustomProfile: { type: Boolean, default: false },
                avatarUpdatedAt: { type: Date, default: null },
                bannerUpdatedAt: { type: Date, default: null },
                bioUpdatedAt: { type: Date, default: null },
        },
        {
                timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
        },
);

export const Guild = mongoose.models.Guild || mongoose.model('Guild', guildSchema);
