import mongoose from "mongoose";

const GeneratedContentSchema = new mongoose.Schema({
    email: { type: String, required: true, index: true },
    prompt: { type: String, required: true },
    imageBase64: { type: String, required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession' },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

GeneratedContentSchema.index({ email: 1, createdAt: -1 });

const GeneratedContent = mongoose.model("GeneratedContent", GeneratedContentSchema);

export default GeneratedContent;
