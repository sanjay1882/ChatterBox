import mongoose from "mongoose";

const UserHistorySchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    history: [
        {
            role: { type: String, required: true },
            parts: [{ text: String }],
            timestamp: { type: Date, default: Date.now }
        }
    ]
});

const ChatHistory = mongoose.model("ChatHistory", UserHistorySchema);

export default ChatHistory;
