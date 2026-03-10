import mongoose from "mongoose";

const contextChunkSchema = new mongoose.Schema({
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    source: { type: String, default: "chat" },
    createdAt: { type: Date, default: Date.now }
});

contextChunkSchema.index({ createdAt: -1 });

const getContextModel = (email) => {
    const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
    const collectionName = `context_${safeEmail}`;

    if (mongoose.models[collectionName]) {
        return mongoose.models[collectionName];
    }
    return mongoose.model(collectionName, contextChunkSchema, collectionName);
};

export default getContextModel;
