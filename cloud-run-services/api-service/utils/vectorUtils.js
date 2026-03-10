import { GoogleGenerativeAI } from "@google/generative-ai";
import getContextModel from "../models/ContextChunk.js";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// gemini-embedding-001 is the valid embedding model (text-embedding-004 returns 404 on v1beta)
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

/**
 * Generate embedding for a given text using Gemini
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function getEmbedding(text) {
    try {
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.warn("Embedding failed:", error.message);
        return [];
    }
}

/**
 * Calculate Cosine Similarity between two vectors
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Score between -1 and 1
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA?.length || !vecB?.length || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
}

/**
 * Find relevant context for a query
 * @param {string} userEmail
 * @param {string} queryText
 * @param {number} limit
 * @returns {Promise<string[]>} Array of relevant text chunks
 */
export async function findRelevantContext(userEmail, queryText, limit = 5) {
    try {
        const queryEmbedding = await getEmbedding(queryText);
        if (!queryEmbedding.length) return [];

        const ContextChunk = getContextModel(userEmail);
        const chunks = await ContextChunk.find({}).lean();

        const scoredChunks = chunks.map(chunk => ({
            text: chunk.text,
            createdAt: chunk.createdAt,
            score: cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        scoredChunks.sort((a, b) => b.score - a.score);

        return scoredChunks
            .filter(item => item.score > 0.5)
            .slice(0, limit)
            .map(item => ({ text: item.text, createdAt: item.createdAt }));

    } catch (error) {
        console.error("Error finding relevant context:", error);
        return [];
    }
}

/**
 * Save a new memory chunk with embedding
 */
export async function saveContextChunk(userEmail, text, source = "chat") {
    try {
        if (!text || text.length < 10) return;
        const embedding = await getEmbedding(text);
        if (embedding.length) {
            const ContextChunk = getContextModel(userEmail);
            await ContextChunk.create({ text, embedding, source });
            console.log(`[VectorDB] Saved context chunk (${source}) for ${userEmail}`);
        }
    } catch (error) {
        console.error("Error saving context chunk:", error);
    }
}
