import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function check(modelName, type = 'generate') {
    console.log(`Checking ${modelName}...`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        if (type === 'embed') {
            await model.embedContent("Hello world");
        } else {
            await model.generateContent("Hello");
        }
        console.log(`SUCCESS: ${modelName} is working.`);
    } catch (e) {
        console.log(`FAILED: ${modelName} - ${e.message.split(']')[1] || e.message}`);
    }
}

async function run() {
    await check("text-embedding-004", 'embed');
    await check("models/text-embedding-004", 'embed');
    await check("embedding-001", 'embed');

    await check("gemini-1.5-flash");
    await check("gemini-1.5-flash-001");
    await check("gemini-1.5-flash-002");
    await check("gemini-2.0-flash-exp");
    await check("gemini-2.5-flash");
}

run();
