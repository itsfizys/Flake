import mongoose from 'mongoose';

const blacklistSchema = new mongoose.Schema(
        {
                _id: { type: String },
                blacklistedBy: { type: String, default: 'papa' },
                reason: { type: String, default: 'idl' },
                type: { type: String, enum: ['user', 'guild'], default: 'user' },
        },
        {
                timestamps: { createdAt: 'createdAt', updatedAt: false },
        },
);

export const Blacklist = mongoose.models.Blacklist || mongoose.model('Blacklist', blacklistSchema);
