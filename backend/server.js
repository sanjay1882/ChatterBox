import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import { Groq } from 'groq-sdk';
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import ChatSession from "./models/ChatSession.js";
import SharedSession from "./models/SharedSession.js";
import UserPreferences from "./models/UserPreferences.js";
import getInitialPrompt from "./history.js";
import { findRelevantContext, saveContextChunk } from "./utils/vectorUtils.js";
import { verifyToken } from "./middleware/auth.js";
import * as scraper from "./utils/scraper.js";

dotenv.config();

const app = express();


app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// CORS Configuration
const allowedOrigins = [process.env.FRONTEND_URL || "http://localhost:5173", "http://localhost:3000"];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

app.use(express.json());

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/chatterbox").then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

const upload = multer();
if (!process.env.GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is missing in environment variables. Gemini features will fail.");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "dummy_key" });

function nowIST() {
    return new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: false
    });
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


app.get("/sessions/:email", verifyToken, async (req, res) => {
    try {
        if (req.user.email !== req.params.email) return res.status(403).json({ error: "Unauthorized access" });

        const sessions = await ChatSession.find({
            email: req.params.email,
            isDeleted: false,
            isTemporary: { $ne: true }
        }).select("title updatedAt isWebSearchEnabled").sort({ updatedAt: -1 });
        res.json(sessions);
    } catch (error) {
        console.error("Error fetching sessions:", error);
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
});


app.get("/session/:email/:id", verifyToken, async (req, res) => {
    try {
        if (req.user.email !== req.params.email) return res.status(403).json({ error: "Unauthorized access" });

        const session = await ChatSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: "Session not found" });
        res.json(session);
    } catch (error) {
        console.error("Error fetching session:", error);
        res.status(500).json({ error: "Failed to fetch session" });
    }
});


app.patch("/sessions/:email/:id/soft-delete", verifyToken, async (req, res) => {
    try {
        if (req.user.email !== req.params.email) return res.status(403).json({ error: "Unauthorized access" });

        const session = await ChatSession.findByIdAndUpdate(
            req.params.id,
            { isDeleted: true },
            { new: true }
        );
        if (!session) return res.status(404).json({ error: "Session not found" });
        res.json({ message: "Session deleted successfully" });
    } catch (error) {
        console.error("Error deleting session:", error);
        res.status(500).json({ error: "Failed to delete session" });
    }
});



app.post("/stream", verifyToken, upload.single("image"), async (req, res) => {
    const userMessage = req.body.message;
    const userEmail = req.body.email;
    const selectedModel = req.body.model || "gemini-2.5-flash";
    const webSearch = req.body.webSearch;
    const isTemporary = req.body.isTemporary === 'true';
    let sessionId = req.body.sessionId;


    const settings = {
        gender: req.body.gender,
        ageGroup: req.body.ageGroup,
        language: req.body.language,
        culture: req.body.culture
    };

    if (!userMessage || !userEmail) {
        return res.status(400).send("Message and Email are required");
    }
    if (req.user.email !== userEmail) return res.status(403).send("Unauthorized: Email mismatch");

    const geminiParts = buildParts(userMessage, req.file);
    let responseText = "";

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        let sessionDoc;
        let isNewSession = false;

        if (sessionId) {
            sessionDoc = await ChatSession.findById(sessionId);
            // Update existing session's search mode if it changed (optional, but good for persistence)
            if (sessionDoc) {
                sessionDoc.isWebSearchEnabled = (webSearch === "true");
                await sessionDoc.save();
            }
        }

        if (!sessionDoc) {
            isNewSession = true;
            // Create title from first few words of message
            const title = userMessage.split(" ").slice(0, 5).join(" ") + "...";
            sessionDoc = new ChatSession({
                email: userEmail,
                title: title,
                messages: [],
                isTemporary: isTemporary, // Set temporary flag
                isWebSearchEnabled: (webSearch === "true")
            });
            await sessionDoc.save();
            sessionId = sessionDoc._id;
        }

        // Send the session ID to the client immediately
        res.write(`event: session_id\ndata: ${sessionId}\n\n`);

        // Prepare history for Gemini
        const dbHistory = sessionDoc.messages.map(h => ({
            role: h.role,
            parts: h.parts.map(p => ({ text: p.text }))
        }));

        const initialPrompt = getInitialPrompt(settings);
        const history = [...initialPrompt, ...dbHistory];

        // Inject Relevant Past Context (Vector Search)
        const relevantContext = await findRelevantContext(userEmail, userMessage);
        if (relevantContext.length > 0) {
            console.log("Found relevant context:", relevantContext.length, "items");
            const contextMsg = `Current Chat Context / Relevant Past Memories:\n${relevantContext.map(c => `[Date: ${c.createdAt.toISOString().split('T')[0]}] ${c.text}`).join("\n---\n")}\n\n(Use this context to answer if relevant, but prioritize current conversation flow)`;
            history.push({
                role: "user",
                parts: [{ text: contextMsg }]
            });
        }

        // Inject System Time
        const currentTime = nowIST();
        history.push({
            role: "user",
            parts: [{ text: `System Note: Current Time (IST): ${currentTime}. Use this time to answer time-related queries.` }]
        });

        if (webSearch === "true") {

            // Replaced external scraper call
            // const scraperUrl = process.env.SCRAPER_URL || "http://localhost:3001";
            // const url = `${scraperUrl}/scrape?query=${encodeURIComponent(userMessage)}`;
            // const scrapeResponse = await fetch(url);
            // const data = await scrapeResponse.json();

            // Using local scraper
            const data = await scraper.scrapeQuery(userMessage);
            console.log("Scraper response data:", data);

            geminiParts.push({ text: `Web-Scraped-Data: ${JSON.stringify(data)}` });


            const scrapeMsg = {
                role: "user",
                parts: [
                    { text: `Web-Scraped-Data: ${JSON.stringify(data)}` },

                ]
            };

            history.push(scrapeMsg);
            sessionDoc.messages.push(scrapeMsg);

            // Send sources to client
            const sources = (data.results || []).map(r => ({ title: r.title, link: r.link }));
            res.write(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`);
        }

        // Add current user message
        sessionDoc.messages.push({
            role: "user",
            parts: [
                { text: userMessage },

            ]
        });

        if (selectedModel.includes("claude")) {
            // Claude Handling
            // Prepare messages for Claude
            // Filter out system messages (unless supported) and ensure correct role alternation if strict
            // Claude messages: [{role: 'user'|'assistant', content: string}]

            const claudeMessages = history
                .filter(msg => msg.role === 'user' || msg.role === 'model') // Map model to assistant
                .map(msg => ({
                    role: msg.role === 'model' ? 'assistant' : 'user',
                    content: msg.parts.map(p => p.text).join('\n')
                }));

            // Add current user message
            claudeMessages.push({
                role: 'user',
                content: userMessage
            });



            const finalClaudeMessages = history.map(msg => ({
                role: msg.role === 'model' ? 'assistant' : 'user',
                content: msg.parts.map(p => p.text).join('\n')
            }));



            const currentMessageContent = [];
            for (const part of geminiParts) {
                if (part.text) {
                    currentMessageContent.push({ type: "text", text: part.text });
                } else if (part.inlineData) {
                    currentMessageContent.push({
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: part.inlineData.mimeType,
                            data: part.inlineData.data
                        }
                    });
                }
            }

            finalClaudeMessages.push({
                role: 'user',
                content: currentMessageContent
            });

            const stream = await anthropic.messages.stream({
                model: selectedModel, // e.g., 'claude-3-sonnet-20240229' - wait, user passed full ID
                max_tokens: 1024,
                messages: finalClaudeMessages,
                // system: "You are a helpful assistant." // Optional: Extract system prompt if needed
            });

            // Handle different stream events
            stream.on('text', (text) => {
                responseText += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            });

            //   stream.on('message', (message) => {
            //     // console.log('Stop reason:', message.stop_reason);
            //     // console.log('Usage:', message.usage);
            //   });

            stream.on('error', (error) => {
                console.error('\nError:', error);
                res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
            });

            // Wait for the stream to complete
            await stream.finalMessage();

        } else if (["gpt-oss-120b", "llama", "qwen", "moonshot", "kimi"].some(keyword => selectedModel.includes(keyword)) || selectedModel.includes("groq")) {
            // Groq Handling
            // Map history to OpenAI format
            const groqMessages = history
                .filter(msg => msg.role === 'user' || msg.role === 'model')
                .map(msg => ({
                    role: msg.role === 'model' ? 'assistant' : 'user',
                    content: msg.parts.map(p => p.text).join('\n')
                }));

            // Add current user message
            groqMessages.push({
                role: 'user',
                content: userMessage
            });

            // (Optional) Handle files/web search data if possible with Groq/OpenAI format
            // The user example didn't use files, just text. We will stick to text for now as per example.
            // If web search was on, it's already in history/context.

            // If there's file content in geminiParts (image), Groq might support it depending on model (Vision).
            // gpt-oss-120b is typically text-only or multimodal? "openai/gpt-oss-120b" sounds like a wrapper.
            // Let's assume text for safety or minimal image support if standard OpenAI compat.
            // For now, appending text content from parts.

            const currentContent = geminiParts.map(p => p.text || "").join("\n");
            // Update the last message content to include file text/context if it was separate
            if (currentContent && currentContent !== userMessage) {
                // If geminiParts had extra stuff (like file context), append it or replace?
                // User message was already added. geminiParts is what we send to model.
                // Let's replace the last message content with full text from parts
                groqMessages[groqMessages.length - 1].content = currentContent;
            }


            let completionOptions = {
                messages: groqMessages,
                stream: true,
                stop: null
            };

            if (selectedModel.includes("gpt-oss-120b")) {
                completionOptions.model = "openai/gpt-oss-120b";
                completionOptions.temperature = 1;
                completionOptions.max_completion_tokens = 8192;
                completionOptions.top_p = 1;
                completionOptions.reasoning_effort = "medium";
            } else if (selectedModel.includes("qwen")) {
                completionOptions.model = selectedModel; // e.g. qwen/qwen3-32b
                completionOptions.temperature = 0.6;
                completionOptions.max_completion_tokens = 4096;
                completionOptions.top_p = 0.95;
                completionOptions.reasoning_effort = "default";
            } else if (selectedModel.includes("moonshot") || selectedModel.includes("kimi")) {
                // Kimi / Moonshot
                completionOptions.model = selectedModel;
                completionOptions.temperature = 0.6;
                completionOptions.max_completion_tokens = 4096;
                completionOptions.top_p = 1;
                // No reasoning_effort for Kimi usually, but if needed we can add.
            } else if (selectedModel.includes("llama")) {
                // Llama 3.3
                completionOptions.model = selectedModel;
                completionOptions.temperature = 1;
                completionOptions.max_completion_tokens = 1024;
                completionOptions.top_p = 1;
            } else {
                // Default fallback
                completionOptions.model = selectedModel;
                completionOptions.temperature = 1;
                completionOptions.max_completion_tokens = 8192;
                completionOptions.top_p = 1;
            }

            const completion = await groq.chat.completions.create(completionOptions);

            for await (const chunk of completion) {
                const text = chunk.choices[0]?.delta?.content || '';
                if (text) {
                    responseText += text;
                    res.write(`data: ${JSON.stringify({ text })}\n\n`);
                }
            }

        } else {

            const model = genAI.getGenerativeModel({ model: selectedModel });
            const chatSession = model.startChat({ history: history });

            const stream = await chatSession.sendMessageStream(geminiParts);

            for await (const chunk of stream.stream) {
                const text = typeof chunk.text === "function" ? chunk.text() : chunk.text || "";
                responseText += text;
                if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
        }


        sessionDoc.messages.push({
            role: "model",
            parts: [
                { text: responseText },

            ]
        });

        await sessionDoc.save();
        console.log(`Chat saved to session ${sessionId}`);

        res.write(`event: end\ndata: done\n\n`);
        res.end();

        // Asynchronously save context for future vector search
        // We don't await this so it doesn't block the response
        (async () => {
            await saveContextChunk(userEmail, userMessage, "chat-user");
            await saveContextChunk(userEmail, responseText, "chat-ai");
        })();

    } catch (error) {
        console.error(error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});


app.post("/share", verifyToken, async (req, res) => {
    try {
        const { email, sessionId } = req.body;
        if (!email || !sessionId) return res.status(400).json({ error: "Email and Session ID are required" });
        if (req.user.email !== email) return res.status(403).json({ error: "Unauthorized: Email mismatch" });

        const session = await ChatSession.findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        const sharedSession = new SharedSession({
            originalSessionId: session._id,
            originalUserEmail: email,
            title: session.title,
            messages: session.messages
        });

        await sharedSession.save();
        res.json({ shareId: sharedSession._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to share session" });
    }
});


app.get("/shared/:id", async (req, res) => {
    try {
        const session = await SharedSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: "Shared session not found" });
        res.json(session);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch shared session" });
    }
});

// --- Advanced Search Endpoints ---

// 1. Generate Search Queries
app.post("/generate-search-queries", verifyToken, async (req, res) => {
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
        console.error("Error generating search queries:", error);
        // Fallback: If AI fails (e.g. invalid key), just use the raw prompt
        console.log("Falling back to raw prompt for search.");
        res.json({ queries: [req.body.prompt] });
    }
});

// 2. Search Results (Proxy)
app.get("/search-results", verifyToken, async (req, res) => {
    try {
        const query = req.query.query;
        if (!query) return res.status(400).json({ error: "Query is required" });

        // Using local scraper
        // const scraperUrl = process.env.SCRAPER_URL || "http://localhost:3001";
        // const response = await fetch(`${scraperUrl}/search?query=${encodeURIComponent(query)}&max=8`);
        // const data = await response.json();

        // Note: Python's /search endpoint returned {query, results: [{link, title, snippet}]}
        const results = await scraper.googleSearch(query, 8);
        res.json({ query, results });
    } catch (error) {
        console.error("Error fetching search results:", error);
        res.status(500).json({ error: "Failed to fetch search results" });
    }
});

// 3. Scrape, Summarize & Vectorize
app.post("/scrape-and-vectorize", verifyToken, async (req, res) => {
    try {
        const { url, email, originalPrompt } = req.body;
        if (!url || !email) return res.status(400).json({ error: "URL and Email are required" });
        if (req.user.email !== email) return res.status(403).json({ error: "Unauthorized: Email mismatch" });

        // Using local scraper
        // const scraperUrl = process.env.SCRAPER_URL || "http://localhost:3001";
        // const apiRes = await fetch(`${scraperUrl}/fetch?url=${encodeURIComponent(url)}`);
        // const data = await apiRes.json();

        const content = await scraper.fetchAndExtract(url);

        if (!content) {
            return res.status(400).json({ error: "Failed to fetch content from URL" });
        }

        const data = { content }; // Shim to match old structure if needed below

        if (data.error || !data.content) {
            return res.status(400).json({ error: "Failed to fetch content from URL" });
        }

        const rawContent = data.content;

        // Summarize
        const genModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const summaryPrompt = `Summarize the following web page content in a concise manner (approx 200 words), focusing on information relevant to the user's original request: "${originalPrompt || "General overview"}".
        
        Web Page Content:
        ${rawContent.substring(0, 10000)}...`; // Truncate just in case

        const summaryResult = await genModel.generateContent(summaryPrompt);
        const summary = summaryResult.response.text();

        // Save to Vector DB
        // Save both abstract summary and some raw chunks if needed, for now just summary + raw snippet
        // We'll save the raw content as a "web-scraped" source
        await saveContextChunk(email, `[Source: ${url}]\n${rawContent}`, "web-scraped");

        res.json({
            summary: summary,
            originalUrl: url
        });

    } catch (error) {
        console.error("Error in scrape-and-vectorize:", error);
        res.status(500).json({ error: "Failed to process URL" });
    }
});


// --- Streaming Analysis Endpoints ---

// 4. Analyze URL Stream
app.post("/analyze-url-stream", verifyToken, async (req, res) => {
    const { url, email, sessionId, prompt } = req.body;
    if (!url || !email) return res.status(400).send("URL and Email are required");
    if (req.user.email !== email) return res.status(403).send("Unauthorized");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        // 1. Fetch Content
        // 1. Fetch Content
        // const scraperUrl = process.env.SCRAPER_URL || "http://localhost:3001";
        // const scrapeRes = await fetch(`${scraperUrl}/fetch?url=${encodeURIComponent(url)}`);
        // const scrapeData = await scrapeRes.json();

        const content = await scraper.fetchAndExtract(url);
        const scrapeData = { content }; // Shim

        if (!content) {
            res.write(`data: ${JSON.stringify({ error: "I had a little trouble reaching that page. It might be down or blocking me." })}\n\n`);
            return res.end();
        }

        // const content = scrapeData.content.substring(0, 15000); // Limit context
        // Context already limited in fetchAndExtract but let's ensure:
        const truncatedContent = content.substring(0, 15000);

        // 2. Get/Create Session
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

        // Send session ID if new
        if (isNewSession) {
            res.write(`event: session_id\ndata: ${sessionDoc._id}\n\n`);
        }

        // 3. Prepare History for Context
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

        // 4. Stream Response
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const chatSession = model.startChat({ history: [] }); // We bake history into the first message for single-turn feel or just use history param
        // Actually, let's use sendMessageStream with the full history as specific to this turn isn't quite right, 
        // we want to append this interaction.
        // Better interact mode: 
        // We push the "System Instruction" as if it's the user's latest message or a system injection.
        // Let's treat it as the user asking for analysis.

        const finalHistory = dbHistory;
        const chat = model.startChat({ history: finalHistory });

        const userMsg = `Analyze this link: ${url}\n\nContent Context:\n${content}\n\nUser Prompt: ${prompt}`;
        const result = await chat.sendMessageStream(userMsg);

        let fullResponse = "";
        for await (const chunk of result.stream) {
            const text = chunk.text();
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }

        // 5. Save Interaction
        sessionDoc.messages.push({
            role: "user",
            parts: [{ text: userMsg }] // Save big context? Maybe truncate for DB? Let's save it for full context.
        });
        sessionDoc.messages.push({
            role: "model",
            parts: [{ text: fullResponse }]
        });
        await sessionDoc.save();

        res.write(`event: end\ndata: done\n\n`);
        res.end();

        // Vectorize in background
        (async () => {
            await saveContextChunk(email, `[Analyzed Link: ${url}]\n${fullResponse}`, "web-analysis");
        })();

    } catch (error) {
        console.error("Analysis Error:", error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: "Oops! My analysis text got tangled up. Let's try that again." })}\n\n`);
        res.end();
    }
});

// 5. Search Overview Stream
app.post("/search-overview-stream", verifyToken, async (req, res) => {
    const { query, email, sessionId } = req.body;
    if (!query || !email) return res.status(400).send("Query and Email required");
    if (req.user.email !== email) return res.status(403).send("Unauthorized");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        // 1. Search
        // 1. Search
        // const scraperUrl = process.env.SCRAPER_URL || "http://localhost:3001";
        // const searchRes = await fetch(`${scraperUrl}/search?query=${encodeURIComponent(query)}&max=4`);
        // const searchData = await searchRes.json();

        const results = await scraper.googleSearch(query, 4);
        const searchData = { results }; // Shim

        if (!searchData.results || searchData.results.length === 0) {
            res.write(`data: ${JSON.stringify({ text: "I looked everywhere, but couldn't find enough good info to make a summary." })}\n\n`);
            res.write(`event: end\ndata: done\n\n`);
            return res.end();
        }

        res.write(`data: ${JSON.stringify({ text: "Gathering sources...\n" })}\n\n`);

        // 2. Fetch Content (Parallel)
        const fetchPromises = searchData.results.map(async (r) => {
            try {
                // const fRes = await fetch(`${scraperUrl}/fetch?url=${encodeURIComponent(r.link)}`);
                // const fData = await fRes.json();
                // return fData.content ? `Source: ${r.title} (${r.link})\nContent: ${fData.content.substring(0, 3000)}` : null;

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

        // 5. Save
        sessionDoc.messages.push({ role: "user", parts: [{ text: userMsg }] });
        sessionDoc.messages.push({ role: "model", parts: [{ text: fullResponse }] });
        await sessionDoc.save();

        res.write(`event: end\ndata: done\n\n`);
        res.end();

    } catch (error) {
        console.error("Overview Error:", error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: "My brain froze while thinking about that overview. Can we try again?" })}\n\n`);
        res.end();
    }
});





app.get("/user/preferences/:email", verifyToken, async (req, res) => {
    try {
        const email = req.params.email;
        if (!email) return res.status(400).json({ error: "Email required" });
        if (req.user.email !== email) return res.status(403).json({ error: "Unauthorized" });

        let prefs = await UserPreferences.findOne({ email });
        if (!prefs) {
            // Return defaults if not found, don't create yet
            return res.json({ theme: 'dark' });
        }
        res.json(prefs);
    } catch (error) {
        console.error("Error fetching preferences:", error);
        res.status(500).json({ error: "Failed to fetch preferences" });
    }
});


app.post("/user/preferences", verifyToken, async (req, res) => {
    try {
        const { email, ...updates } = req.body;
        if (!email) return res.status(400).json({ error: "Email required" });
        if (req.user.email !== email) return res.status(403).json({ error: "Unauthorized" });

        const prefs = await UserPreferences.findOneAndUpdate(
            { email },
            { $set: updates },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.json(prefs);
    } catch (error) {
        console.error("Error saving preferences:", error);
        res.status(500).json({ error: "Failed to save preferences" });
    }
});


app.post("/chat-completion", verifyToken, async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "GEMINI_API_KEY missing" });
        }
        const { prompt } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ text: response.text() });
    } catch (error) {
        console.error("Completion error:", error);
        res.status(200).send({ text: "Search results are available in the side panel. Please take a look." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Backend running on http://localhost:3000");
});
