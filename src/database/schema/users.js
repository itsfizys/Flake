import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
        {
                _id: { type: String },
                addresses: {
                        type: Map,
                        of: String,
                        default: {},
                },
        },
        {
                timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
        },
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
