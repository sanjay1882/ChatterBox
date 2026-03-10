import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy to init? No, need listModels on standard client if available, but SDK might not expose it easily on the instance. 
        // Actually, listModels is not on the instance, it's on the class or via rest.
        // The SDK has a genAI.getGenerativeModel...
        // Wait, current SDK might not have listModels helper directly on genAI?
        // Let's rely on documentation: use the API directly or check if SDK supports it.
        // SDK v0.24.1 likely supports `genAI.getGenerativeModel` etc.
        // Actually, let's just try to instantiate the models we WANT and see if they work.

        console.log("Checking text-embedding-004...");
        try {
            const em = genAI.getGenerativeModel({ model: "text-embedding-004" });
            const result = await em.embedContent("Hello world");
            console.log("SUCCESS: text-embedding-004 is working.");
        } catch (e) {
            console.log("FAILED: text-embedding-004", e.message);
        }

        console.log("Checking gemini-1.5-flash...");
        try {
            const gm = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await gm.generateContent("Hello");
            console.log("SUCCESS: gemini-1.5-flash is working.");
        } catch (e) {
            console.log("FAILED: gemini-1.5-flash", e.message);
        }

        console.log("Checking gemini-2.5-flash...");
        try {
            const gm2 = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await gm2.generateContent("Hello");
            console.log("SUCCESS: gemini-2.5-flash is working.");
        } catch (e) {
            console.log("FAILED: gemini-2.5-flash (Expected)", e.message);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
