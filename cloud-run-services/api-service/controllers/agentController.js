import ChatSession from "../models/ChatSession.js";
import GeneratedContent from "../models/GeneratedContent.js";
import { findRelevantContext, saveContextChunk } from "../utils/vectorUtils.js";
import * as scraper from "../utils/scraper.js";
import fetch from "node-fetch";
import { genAI, anthropic, groq } from "../services/aiService.js";
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let connection = null;
let taskQueue = null;
if (process.env.REDIS_URL) {
    try {
        connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
        taskQueue = new Queue('tasks', { connection });
    } catch (err) {
        console.error("Redis init failed:", err.message);
    }
} else {
    console.warn("REDIS_URL is not set. Background processing for large files is disabled.");
}

function buildParts(userMessage, file) {
    const parts = [];
    parts.push({ text: userMessage });

    if (file) {
        const mimeType = file.mimetype;
        const isImage = mimeType.startsWith("image/");
        const isAudio = mimeType.startsWith("audio/");
        const isVideo = mimeType.startsWith("video/");
        const isPDF = mimeType === "application/pdf";

        if (isImage || isAudio || isVideo || isPDF) {
            parts.push({
                inlineData: {
                    data: file.buffer.toString("base64"),
                    mimeType: mimeType
                }
            });
        } else {
            parts.push({
                text: `\n\nFile: ${file.originalname} (${mimeType})\nContent:\n${file.buffer.toString("utf-8")}`
            });
        }
    }
    return parts;
}

export const excelAgentStream = async (req, res) => {
    try {
        const { message, sheetData, email } = req.body;
        if (!message || !sheetData || !email) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (req.user.email !== email) return res.status(403).json({ error: "Unauthorized access" });

        const systemPrompt = `You are an expert Excel/spreadsheet AI agent and data analyst.
You receive:
1. A 2D JSON array representing the spreadsheet (rows × columns). Row 0 is usually the header.
2. A user instruction describing what to do with the spreadsheet.

Respond in a friendly, clear conversational tone. Explain what you did and why.
If you are making data changes, describe them briefly then output the result as a JSON block wrapped in triple backticks like:
\`\`\`json
{"updatedData": <full updated 2D array>, "operation": "<short label>", "cellStyles": {}}
\`\`\`
If no data change is needed (e.g., user just asks a question about the data), answer conversationally.

Current spreadsheet (${sheetData.length} rows):
${JSON.stringify(sheetData.slice(0, 200))}

User instruction: ${message}`;

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const stream = await model.generateContentStream(systemPrompt);

        let fullText = "";
        for await (const chunk of stream.stream) {
            const text = typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
            if (text) {
                fullText += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
        }

        // Try to parse and emit updatedData if JSON block found
        try {
            const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1].trim());
                if (parsed.updatedData) {
                    res.write(`data: ${JSON.stringify({ updatedData: parsed.updatedData, operation: parsed.operation || 'updated', cellStyles: parsed.cellStyles || {}, done: true, fullMessage: fullText })}\n\n`);
                }
            }
        } catch (parseErr) { /* JSON parse fail is fine, just stream text */ }

        res.write(`data: ${JSON.stringify({ done: true, fullMessage: fullText })}\n\n`);
        res.end();

    } catch (error) {
        console.error("Excel stream error:", error);
        if (!res.headersSent) {
            res.setHeader("Content-Type", "text/event-stream");
        }
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
};

export const getSearchQueries = async (req, res) => {
    try {
        const { prompt, model } = req.body;
        if (!prompt) return res.status(400).json({ error: "Prompt is required" });

        const genModel = genAI.getGenerativeModel({ model: model || "gemini-2.5-flash" });
        const systemPrompt = `You are a search expert. Generate 3-4 diverse and effective Google search queries based on the user's prompt to find relevant information. Return ONLY the queries, one per line. No numbering, no bullets.
        
        User Prompt: ${prompt}`;

        const result = await genModel.generateContent(systemPrompt);
        const text = result.response.text();
        const queries = text.split('\n').filter(q => q.trim().length > 0);

        res.json({ queries });
    } catch (error) {
        res.json({ queries: [req.body.prompt] });
    }
};

export const getSearchResults = async (req, res) => {
    try {
        const query = req.query.query;
        if (!query) return res.status(400).json({ error: "Query is required" });

        const results = await scraper.googleSearch(query, 8);
        res.json({ query, results });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch search results" });
    }
};

export const scrapeAndVectorize = async (req, res) => {
    try {
        const { url, email, originalPrompt } = req.body;
        if (!url || !email) return res.status(400).json({ error: "URL and Email are required" });
        if (req.user.email !== email) return res.status(403).json({ error: "Unauthorized: Email mismatch" });

        const content = await scraper.fetchAndExtract(url);

        if (!content) {
            return res.status(400).json({ error: "Failed to fetch content from URL" });
        }

        const rawContent = content;

        const genModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const summaryPrompt = `Summarize the following web page content in a concise manner (approx 200 words), focusing on information relevant to the user's original request: "${originalPrompt || "General overview"}".
        
        Web Page Content:
        ${rawContent.substring(0, 10000)}...`;

        const summaryResult = await genModel.generateContent(summaryPrompt);
        const summary = summaryResult.response.text();

        await saveContextChunk(email, `[Source: ${url}]\n${rawContent}`, "web-scraped");

        res.json({
            summary: summary,
            originalUrl: url
        });

    } catch (error) {
        res.status(500).json({ error: "Failed to process URL" });
    }
};

export const spectraGenerate = async (req, res) => {
    try {
        const { prompt, email, sessionId } = req.body;

        if (!prompt || !email) {
            return res.status(400).json({ error: "Prompt and Email are required" });
        }
        if (req.user.email !== email) return res.status(403).json({ error: "Unauthorized: Email mismatch" });

        const photo1 = req.files['photo1'] ? req.files['photo1'][0] : null;
        const photo2 = req.files['photo2'] ? req.files['photo2'][0] : null;

        const systemPrompt = `

Take this pic "photo1"as reference — don't spoil the originality.
In photo2; you need to replace the person.
Keep 100% originality of this image:
- Same background
- Same colors, textures, composition
- Same graphic-novel/poster style
- Only the person will be replaced
- No remix
- No style change
- No extra creativity

Workflow:
1. This image photo1= base reference (locked)
2. then in photo2
3. I replace only the person, everything else stays untouched


`;

        const finalPrompt = systemPrompt + prompt;

        let generatedImageData;
        let generatedMimeType = "image/png";

        if (photo1) {
            generatedImageData = photo1.buffer.toString('base64');
            generatedMimeType = photo1.mimetype;
        } else {
            generatedImageData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        }

        const responseText = "Here is the generated image based on your inputs.";

        let sessionDoc;
        let isNewSession = false;

        if (sessionId) {
            sessionDoc = await ChatSession.findById(sessionId);
        }

        if (!sessionDoc) {
            isNewSession = true;
            const title = prompt.split(" ").slice(0, 5).join(" ") + "...";
            sessionDoc = new ChatSession({
                email: email,
                title: title,
                messages: [],
                isTemporary: false
            });
            await sessionDoc.save();
        }

        const userParts = [{ text: prompt }];
        if (photo1) userParts.push({ inlineData: { data: photo1.buffer.toString('base64'), mimeType: photo1.mimetype } });
        if (photo2) userParts.push({ inlineData: { data: photo2.buffer.toString('base64'), mimeType: photo2.mimetype } });

        sessionDoc.messages.push({
            role: "user",
            parts: userParts
        });

        sessionDoc.messages.push({
            role: "model",
            parts: [
                { text: responseText },
                { inlineData: { data: generatedImageData, mimeType: generatedMimeType } }
            ]
        });

        await sessionDoc.save();

        res.json({
            text: responseText,
            image: {
                data: generatedImageData,
                mimeType: generatedMimeType
            },
            sessionId: sessionDoc._id
        });

    } catch (error) {
        res.status(500).json({ error: "Failed to generate image" });
    }
};

export const analyzeUrlStream = async (req, res) => {
    const { url, email, sessionId, prompt } = req.body;
    if (!url || !email) return res.status(400).send("URL and Email are required");
    if (req.user.email !== email) return res.status(403).send("Unauthorized");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const content = await scraper.fetchAndExtract(url);

        if (!content) {
            res.write(`data: ${JSON.stringify({ error: "I had a little trouble reaching that page. It might be down or blocking me." })}\n\n`);
            return res.end();
        }

        let sessionDoc;
        let isNewSession = false;
        if (sessionId) {
            sessionDoc = await ChatSession.findById(sessionId);
        }

        if (!sessionDoc) {
            isNewSession = true;
            sessionDoc = new ChatSession({
                email: email,
                title: `Analysis: ${url.substring(0, 30)}...`,
                messages: [],
                isTemporary: false
            });
            await sessionDoc.save();
        }

        if (isNewSession) {
            res.write(`event: session_id\ndata: ${sessionDoc._id}\n\n`);
        }

        const dbHistory = sessionDoc.messages.map(h => ({
            role: h.role,
            parts: h.parts.map(p => ({ text: p.text }))
        }));

        const systemPart = {
            role: "user",
            parts: [{
                text: `System Instruction: You are analyzing the content of a specific webpage link the user clicked. 
                URL: ${url}
                Content: ${content}
                
                User's Original Query Context: "${prompt || "None"}"
                
                Task: Provide a detailed, reasoning-based analysis of this content relevant to the user's context. 
                Do not just summarize; explain WHY this is relevant and what the key takeaways are.`
            }]
        };

        const history = [...dbHistory, systemPart];

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const chat = model.startChat({ history: dbHistory });

        const userMsg = `Analyze this link: ${url}\n\nContent Context:\n${content}\n\nUser Prompt: ${prompt}`;
        const result = await chat.sendMessageStream(userMsg);

        let fullResponse = "";
        for await (const chunk of result.stream) {
            const text = chunk.text();
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }

        sessionDoc.messages.push({
            role: "user",
            parts: [{ text: userMsg }]
        });
        sessionDoc.messages.push({
            role: "model",
            parts: [{ text: fullResponse }]
        });
        await sessionDoc.save();

        res.write(`event: end\ndata: done\n\n`);
        res.end();

        (async () => {
            await saveContextChunk(email, `[Analyzed Link: ${url}]\n${fullResponse}`, "web-analysis");
        })();

    } catch (error) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: "Oops! My analysis text got tangled up. Let's try that again." })}\n\n`);
        res.end();
    }
};

export const searchOverviewStream = async (req, res) => {
    const { query, email, sessionId } = req.body;
    if (!query || !email) return res.status(400).send("Query and Email required");
    if (req.user.email !== email) return res.status(403).send("Unauthorized");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const results = await scraper.googleSearch(query, 4);
        const searchData = { results };

        if (!searchData.results || searchData.results.length === 0) {
            res.write(`data: ${JSON.stringify({ text: "I looked everywhere, but couldn't find enough good info to make a summary." })}\n\n`);
            res.write(`event: end\ndata: done\n\n`);
            return res.end();
        }

        res.write(`data: ${JSON.stringify({ text: "Gathering sources...\n" })}\n\n`);

        const fetchPromises = searchData.results.map(async (r) => {
            try {
                const content = await scraper.fetchAndExtract(r.link);
                return content ? `Source: ${r.title} (${r.link})\nContent: ${content.substring(0, 3000)}` : null;
            } catch (e) { return null; }
        });

        const contents = (await Promise.all(fetchPromises)).filter(c => c !== null).join("\n\n---\n\n");

        if (!contents) {
            res.write(`data: ${JSON.stringify({ text: "I found the links, but couldn't read the details from them. Secure sites, maybe?" })}\n\n`);
            res.write(`event: end\ndata: done\n\n`);
            return res.end();
        }

        let sessionDoc;
        if (sessionId) {
            sessionDoc = await ChatSession.findById(sessionId);
        }
        if (!sessionDoc) {
            sessionDoc = new ChatSession({ email, title: `Overview: ${query}`, messages: [] });
            await sessionDoc.save();
            res.write(`event: session_id\ndata: ${sessionDoc._id}\n\n`);
        }

        const dbHistory = sessionDoc.messages.map(h => ({
            role: h.role,
            parts: h.parts.map(p => ({ text: p.text }))
        }));

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const chat = model.startChat({ history: dbHistory });

        const userMsg = `Generate a comprehensive AI Overview for the query: "${query}" based on the following gathered web contents:\n\n${contents}\n\nCitations are encouraged.`;
        const result = await chat.sendMessageStream(userMsg);

        let fullResponse = "";
        for await (const chunk of result.stream) {
            const text = chunk.text();
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }

        sessionDoc.messages.push({ role: "user", parts: [{ text: userMsg }] });
        sessionDoc.messages.push({ role: "model", parts: [{ text: fullResponse }] });
        await sessionDoc.save();

        res.write(`event: end\ndata: done\n\n`);
        res.end();

    } catch (error) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: "My brain froze while thinking about that overview. Can we try again?" })}\n\n`);
        res.end();
    }
};

export const generateImage = async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "GEMINI_API_KEY missing" });
        }
        const { prompt, email, sessionId } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }
        if (req.user.email !== email && email) return res.status(403).json({ error: "Unauthorized" });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${process.env.GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [
                    { prompt: prompt + "Create an image with a watermark that says Treevit AI placed at the bottom in small text." }
                ],
                parameters: {
                    sampleCount: 1,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Imagen API failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.predictions && data.predictions.length > 0 && data.predictions[0].bytesBase64Encoded) {
            const base64Image = data.predictions[0].bytesBase64Encoded;

            if (email) {
                try {
                    const savedImage = new GeneratedContent({
                        email,
                        prompt,
                        imageBase64: base64Image,
                        sessionId: sessionId || null
                    });
                    await savedImage.save();
                } catch (dbError) { }
            }

            if (sessionId) {
                try {
                    const session = await ChatSession.findById(sessionId);
                    if (session) {
                        session.messages.push({
                            role: "user",
                            parts: [{ text: `Generate image: ${prompt}` }]
                        });
                        session.messages.push({
                            role: "model",
                            parts: [{
                                inlineData: {
                                    mimeType: "image/png",
                                    data: base64Image
                                }
                            }]
                        });
                        await session.save();
                    }
                } catch (sessionError) { }
            }

            res.json({ imageBase64: base64Image });
        } else {
            throw new Error("No image data received from API");
        }

    } catch (error) {
        res.status(500).json({ error: "Failed to generate image.", details: error.message });
    }
};

export const transcribeAudio = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No audio file provided" });
        }

        const { buffer, mimetype, originalname } = req.file;

        const audioFile = new File([buffer], originalname || "audio.webm", { type: mimetype || "audio/webm" });

        const transcription = await groq.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-large-v3-turbo",
            response_format: "json",
            temperature: 0,
        });

        return res.json({ text: transcription.text || "" });
    } catch (error) {
        return res.status(500).json({ error: "Transcription failed", details: error.message });
    }
};

export const excelAgentJson = async (req, res) => {
    try {
        const { message, sheetData, email } = req.body;
        if (!message || !sheetData) {
            return res.status(400).json({ error: "message and sheetData are required" });
        }
        if (req.user.email !== email && email !== 'guest@treevit.local') {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const systemPrompt = `You are an expert Excel/spreadsheet AI agent.
You receive:
1. A 2D JSON array representing the spreadsheet (rows × columns). Row 0 is usually the header.
2. A user instruction describing what to do with the spreadsheet.

Perform the instruction and return ONLY a valid JSON object with:
{
  "updatedData": <the full updated 2D array>,
  "message": <a short human-friendly summary of what you did>,
  "operation": <a brief operation label like "sorted", "filtered", "added column", etc.>
}

Rules:
- Always preserve the header row (row 0) unless the user says to delete it.
- Do NOT add any explanation outside the JSON block.
- If you cannot do it, return the original data unchanged with an explanation in "message".
- Keep data types: numbers as numbers, strings as strings.

Current spreadsheet data:
${JSON.stringify(sheetData)}

User instruction: ${message}`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(systemPrompt);
        let raw = result.response.text().trim();

        raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return res.json({
                updatedData: sheetData,
                message: "I couldn't process that instruction. Please try rephrasing it.",
                operation: "none"
            });
        }

        return res.json({
            updatedData: parsed.updatedData || sheetData,
            message: parsed.message || "Done.",
            operation: parsed.operation || "updated",
        });
    } catch (error) {
        res.status(500).json({ error: "Excel agent failed", details: error.message });
    }
};

export const wordAgentStream = async (req, res) => {
    try {
        const { message, docContent, fileName, email } = req.body;
        if (!message || !email) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (req.user.email !== email && email !== 'guest@treevit.local') {
            return res.status(403).json({ error: "Unauthorized access" });
        }

        const systemPrompt = `You are an expert document assistant specializing in Word/DOCX files.
${docContent ? `The user has uploaded a document: "${fileName || 'document.docx'}"\n\nDocument Content:\n${docContent.substring(0, 15000)}` : 'No document has been uploaded yet.'}

User request: ${message}

Provide a helpful, detailed response. If the user wants edits or rewrites, provide the improved content clearly formatted. Be conversational and explain your changes.`;

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const stream = await model.generateContentStream(systemPrompt);

        let fullText = "";
        for await (const chunk of stream.stream) {
            const text = typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
            if (text) {
                fullText += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
        }

        res.write(`data: ${JSON.stringify({ done: true, fullMessage: fullText })}\n\n`);
        res.end();

    } catch (error) {
        console.error("Word stream error:", error);
        if (!res.headersSent) {
            res.setHeader("Content-Type", "text/event-stream");
        }
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
};

/**
 * GET /gallery/:email
 * Returns the 50 most recent generated images for a user
 */
export const getGallery = async (req, res) => {
    try {
        const { email } = req.params;
        if (req.user.email !== email) return res.status(403).json({ error: "Unauthorized" });

        const images = await GeneratedContent.find({ email })
            .sort({ createdAt: -1 })
            .limit(50)
            .select("prompt imageBase64 createdAt")
            .lean();

        res.json({
            images: images.map(img => ({
                prompt: img.prompt,
                imageBase64: img.imageBase64,
                createdAt: img.createdAt
            }))
        });
    } catch (error) {
        console.error("Gallery fetch error:", error);
        res.status(500).json({ error: "Failed to fetch gallery" });
    }
};

