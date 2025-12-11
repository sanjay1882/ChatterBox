import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    role: { type: String, required: true },
    parts: [{ text: String }],
    timestamp: { type: Date, default: Date.now }
});

const SharedSessionSchema = new mongoose.Schema({
    originalSessionId: String,
    originalUserEmail: String,
    title: String,
    messages: [messageSchema],
    sharedAt: { type: Date, default: Date.now }
});

const SharedSession = mongoose.model("SharedSession", SharedSessionSchema);
export default SharedSession;
