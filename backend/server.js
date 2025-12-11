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

import getSessionModel from "./models/ChatSession.js";
import SharedSession from "./models/SharedSession.js";
import UserPreferences from "./models/UserPreferences.js";
import getInitialPrompt from "./history.js";

dotenv.config();

const app = express();

// Security Middleware
app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
            // Assume text/code for other types
            // Provide context about the file
            parts.push({
                text: `\n\nFile: ${file.originalname} (${mimeType})\nContent:\n${file.buffer.toString("utf-8")}`
            });
        }
    }

    return parts;
}


app.get("/sessions/:email", async (req, res) => {
    try {
        const ChatSession = getSessionModel(req.params.email);
        const sessions = await ChatSession.find({
            email: req.params.email,
            isDeleted: false,
            isTemporary: { $ne: true }
        }).select("title updatedAt").sort({ updatedAt: -1 });
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
});

// Get a specific session
app.get("/session/:email/:id", async (req, res) => {
    try {
        const ChatSession = getSessionModel(req.params.email);
        const session = await ChatSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: "Session not found" });
        res.json(session);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch session" });
    }
});

// Soft delete a session
app.patch("/sessions/:email/:id/soft-delete", async (req, res) => {
    try {
        const ChatSession = getSessionModel(req.params.email);
        const session = await ChatSession.findByIdAndUpdate(
            req.params.id,
            { isDeleted: true },
            { new: true }
        );
        if (!session) return res.status(404).json({ error: "Session not found" });
        res.json({ message: "Session deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete session" });
    }
});

// Rename a session
app.patch("/sessions/:email/:id/rename", async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: "Title is required" });

        const ChatSession = getSessionModel(req.params.email);
        const session = await ChatSession.findByIdAndUpdate(
            req.params.id,
            { title: title },
            { new: true }
        );
        if (!session) return res.status(404).json({ error: "Session not found" });
        res.json(session);
    } catch (error) {
        res.status(500).json({ error: "Failed to rename session" });
    }
});

app.post("/stream", upload.single("image"), async (req, res) => {
    const userMessage = req.body.message;
    const userEmail = req.body.email;
    const selectedModel = req.body.model || "gemini-2.5-flash";
    const webSearch = req.body.webSearch;
    const isTemporary = req.body.isTemporary === 'true'; // Check for temp flag
    let sessionId = req.body.sessionId;

    // Extract personalization settings
    const settings = {
        gender: req.body.gender,
        ageGroup: req.body.ageGroup,
        language: req.body.language,
        culture: req.body.culture
    };

    if (!userMessage || !userEmail) {
        return res.status(400).send("Message and Email are required");
    }

    const geminiParts = buildParts(userMessage, req.file);
    let responseText = ""; // Initialize responseText here

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const ChatSession = getSessionModel(userEmail);
        let sessionDoc;
        let isNewSession = false;

        if (sessionId) {
            sessionDoc = await ChatSession.findById(sessionId);
        }

        if (!sessionDoc) {
            isNewSession = true;
            // Create title from first few words of message
            const title = userMessage.split(" ").slice(0, 5).join(" ") + "...";
            sessionDoc = new ChatSession({
                email: userEmail,
                title: title,
                messages: [],
                isTemporary: isTemporary // Set temporary flag
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

        // Inject System Time
        const currentTime = nowIST();
        history.push({
            role: "user",
            parts: [{ text: `System Note: Current Time (IST): ${currentTime}. Use this time to answer time-related queries.` }]
        });

        if (webSearch === "true") {

            const scraperUrl = process.env.SCRAPER_URL || "http://localhost:3001";
            const url = `${scraperUrl}/scrape?query=${encodeURIComponent(userMessage)}`;
            const scrapeResponse = await fetch(url);
            const data = await scrapeResponse.json();
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

            // Also add any web scraped data/file data if present in userMessage or history...
            // Note: The 'history' variable above already includes previous DB messages + initial prompt.
            // BUT, we need to be careful with 'initialPrompt' format.
            // Let's re-build strictly from dbHistory + current message for simplicity, 
            // relying on system prompt for 'initialPrompt' if Claude supports system prompt.
            // Claude supports 'system' parameter.

            // Extract system instruction from initialPrompt if possible, or just prepend.
            // existing getInitialPrompt returns array of {role, parts}.
            // Let's just use the 'history' we built, but fix roles.

            const finalClaudeMessages = history.map(msg => ({
                role: msg.role === 'model' ? 'assistant' : 'user',
                content: msg.parts.map(p => p.text).join('\n')
            }));

            // Add current message parts (including file/web data) handled in geminiParts
            // geminiParts is [{text: ...}, {inlineData...}]
            // We need to convert geminiParts to Claude content blocks if they have images.
            // Claude supports image blocks.

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

    } catch (error) {
        console.error(error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});


app.post("/share", async (req, res) => {
    try {
        const { email, sessionId } = req.body;
        if (!email || !sessionId) return res.status(400).json({ error: "Email and Session ID are required" });

        const ChatSession = getSessionModel(email);
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

// --- User Preferences Endpoints ---

// Get User Preferences
app.get("/user/preferences/:email", async (req, res) => {
    try {
        const email = req.params.email;
        if (!email) return res.status(400).json({ error: "Email required" });

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

// Update/Upsert User Preferences
app.post("/user/preferences", async (req, res) => {
    try {
        const { email, ...updates } = req.body;
        if (!email) return res.status(400).json({ error: "Email required" });

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Backend running on http://localhost:3000");
});  