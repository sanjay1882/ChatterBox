import mongoose from "mongoose";

const partSchema = new mongoose.Schema({
    text: String,
    inlineData: {
        mimeType: String,
        data: String
    }
}, { _id: false });

const messageSchema = new mongoose.Schema({
    role: { type: String, required: true },
    parts: [partSchema],
    timestamp: { type: Date, default: Date.now }
});

const ChatSessionSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        index: true // Indexed for fast lookup by user
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
    isWebSearchEnabled: {
        type: Boolean,
        default: false
    },
    isShared: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true // Automatically manages createdAt and updatedAt
});

// Compound index for efficient sorting by update time per user
ChatSessionSchema.index({ email: 1, updatedAt: -1 });

const ChatSession = mongoose.model("ChatSession", ChatSessionSchema);

export default ChatSession;
