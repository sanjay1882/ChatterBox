import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    role: { type: String, required: true },
    parts: [{ text: String }],
    timestamp: { type: Date, default: Date.now }
});

const ChatSessionSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        index: true
    },
    title: {
        type: String,
        default: "New Chat"
    },
    messages: [messageSchema],
    isDeleted: {
        type: Boolean,
        default: false
    },
    isTemporary: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update 'updatedAt' on save
ChatSessionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Function to get a model for a specific user's collection
const getSessionModel = (email) => {
    // Sanitize email to create a valid collection name (replace special chars)
    const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
    const collectionName = `sessions_${safeEmail}`;

    // Check if model already exists to avoid OverwriteModelError
    if (mongoose.models[collectionName]) {
        return mongoose.models[collectionName];
    }

    return mongoose.model(collectionName, ChatSessionSchema, collectionName);
};

export default getSessionModel;
