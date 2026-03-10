import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
async function test(modelName) {
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const res = await model.embedContent("Hello world");
        console.log("SUCCESS:", modelName, res.embedding.values.length);
    } catch (e) { console.log("FAILED:", modelName, e.message); }
}
async function run() {
    await test("text-embedding-004");
    await test("models/text-embedding-004");
    await test("gemini-embedding-001");
    await test("embedding-001");
}
run();
