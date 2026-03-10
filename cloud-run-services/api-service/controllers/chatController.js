import ChatSession from "../models/ChatSession.js";
import SharedSession from "../models/SharedSession.js";
import { findRelevantContext, saveContextChunk } from "../utils/vectorUtils.js";
import * as scraper from "../utils/scraper.js";
import getInitialPrompt from "../history.js";
import { genAI, anthropic, groq } from "../services/aiService.js";

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

export const streamChat = async (req, res) => {
    const {
        message: userMessage,
        email: userEmail,
        sessionId: incomingSessionId,
        model: selectedModel = "gemini-2.5-flash",
        isTemporary: incomingIsTemporary,
        webSearch,
        editMessageId,
        gender,
        ageGroup,
        language,
        culture,
        writingStyle,
        creativityLevel,
        interests,
        customRules
    } = req.body;

    const isTemporary = incomingIsTemporary === 'true' || incomingIsTemporary === true;
    const isWebSearchEnabled = webSearch === 'true' || webSearch === true;
    let sessionId = incomingSessionId;

    const settings = {
        gender, ageGroup, language, culture, writingStyle, creativityLevel, interests, customRules
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
            if (sessionDoc) {
                if (editMessageId) {
                    const editIndex = sessionDoc.messages.findIndex(m => m._id.toString() === editMessageId);
                    if (editIndex !== -1) {
                        sessionDoc.messages = sessionDoc.messages.slice(0, editIndex);
                        console.log(`[Edit] Truncated session ${sessionId} history from index ${editIndex} `);
                    }
                }
                sessionDoc.isWebSearchEnabled = isWebSearchEnabled;
                await sessionDoc.save();
            }
        }

        if (!sessionDoc) {
            isNewSession = true;
            const title = userMessage.split(" ").slice(0, 5).join(" ") + "...";
            sessionDoc = new ChatSession({
                email: userEmail,
                title: title,
                messages: [],
                isTemporary: isTemporary,
                isWebSearchEnabled: isWebSearchEnabled
            });
            await sessionDoc.save();
            sessionId = sessionDoc._id;
        }

        res.write(`data: ${JSON.stringify({ sessionId: sessionId })}\n\n`);

        const dbHistory = sessionDoc.messages
            // Ensure no empty content throws off models
            .filter(h => h && h.parts && h.parts.length > 0)
            .map(h => ({
                role: h.role,
                parts: h.parts.map(p => ({ text: p.text || "[Image/File]" }))
            }));

        const initialPrompt = getInitialPrompt(settings);
        const history = [...initialPrompt, ...dbHistory];

        // Combine all RAG, Search, and Time data into a single block prepended to the user's current message
        let contextBlock = `[SYSTEM CONTEXT]\nCurrent Time (IST): ${nowIST()}\n`;

        const relevantContext = await findRelevantContext(userEmail, userMessage);
        if (relevantContext.length > 0) {
            console.log("Found relevant context:", relevantContext.length, "items");
            contextBlock += `\nRelevant Past Memories:\n${relevantContext.map(c => `[Date: ${c.createdAt.toISOString().split('T')[0]}] ${c.text}`).join("\n---\n")}\n`;
        }

        if (isWebSearchEnabled) {
            try {
                const data = await scraper.scrapeQuery(userMessage);
                contextBlock += `\nWeb-Scraped-Data:\n${JSON.stringify(data)}\n`;
                const sources = (data.results || []).map(r => ({ title: r.title, link: r.link }));
                res.write(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`);
            } catch (err) {
                console.error("Web search failed:", err.message);
            }
        }
        contextBlock += `[/SYSTEM CONTEXT]\n\n`;

        // Safely prepend context block to the current user's message parts
        if (geminiParts && geminiParts.length > 0 && geminiParts[0].text) {
            geminiParts[0].text = contextBlock + geminiParts[0].text;
        } else {
            geminiParts.unshift({ text: contextBlock + userMessage });
        }

        // Save original message to DB without polluting it with massive text blocks
        sessionDoc.messages.push({
            role: "user",
            parts: [{ text: userMessage }]
        });

        if (selectedModel.includes("claude")) {
            let claudeMessages = history
                .filter(msg => msg.role === 'user' || msg.role === 'model')
                .map(msg => ({
                    role: msg.role === 'model' ? 'assistant' : 'user',
                    content: msg.parts.map(p => p.text).join('\n')
                }));

            // Collapse consecutive roles which Anthropic forbids
            claudeMessages = claudeMessages.reduce((acc, current) => {
                if (acc.length > 0 && acc[acc.length - 1].role === current.role) {
                    acc[acc.length - 1].content += "\n\n" + current.content;
                } else {
                    acc.push(current);
                }
                return acc;
            }, []);

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

            claudeMessages.push({
                role: 'user',
                content: currentMessageContent
            });

            // Ensure first message is always from a user
            if (claudeMessages.length > 0 && claudeMessages[0].role === 'assistant') {
                claudeMessages.shift();
            }

            // Ensure the LAST message is always from the user (Claude forbids assistant prefill)
            while (claudeMessages.length > 0 && claudeMessages[claudeMessages.length - 1].role === 'assistant') {
                claudeMessages.pop();
            }

            const stream = await anthropic.messages.stream({
                model: selectedModel,
                max_tokens: 8192,
                messages: claudeMessages,
            });

            stream.on('text', (text) => {
                responseText += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            });

            stream.on('error', (error) => {
                console.error('\nError:', error);
                res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
            });

            await stream.finalMessage();

        } else if (["gpt-oss-120b", "llama", "qwen", "moonshot", "kimi"].some(keyword => selectedModel.includes(keyword)) || selectedModel.includes("groq")) {

            let groqMessages = history
                .filter(msg => msg.role === 'user' || msg.role === 'model')
                .map(msg => ({
                    role: msg.role === 'model' ? 'assistant' : 'user',
                    content: msg.parts.map(p => p.text).join('\n')
                }));

            groqMessages.push({
                role: 'user',
                content: geminiParts.map(p => p.text || "").join("\n")
            });

            // Collapse consecutive roles just in case for strict open-source models
            groqMessages = groqMessages.reduce((acc, current) => {
                if (acc.length > 0 && acc[acc.length - 1].role === current.role) {
                    acc[acc.length - 1].content += "\n\n" + current.content;
                } else {
                    acc.push(current);
                }
                return acc;
            }, []);

            // Ensure first is user and no alternating issues
            if (groqMessages.length > 0 && groqMessages[0].role === 'assistant') {
                groqMessages.shift();
            }

            let completionOptions = {
                messages: groqMessages,
                stream: true,
                stop: null
            };

            let safeModel = selectedModel;
            if (selectedModel.includes("gpt-oss-120b")) {
                safeModel = "llama-3.1-70b-versatile";
                completionOptions.temperature = 1;
            } else if (selectedModel.includes("qwen") || selectedModel.includes("moonshot") || selectedModel.includes("kimi")) {
                safeModel = "gemma2-9b-it";
                completionOptions.temperature = 0.6;
            } else if (selectedModel.includes("llama")) {
                safeModel = selectedModel.includes("70b") ? "llama-3.1-70b-versatile" : "llama-3.1-8b-instant";
                completionOptions.temperature = 0.8;
            } else if (!selectedModel.includes("-")) {
                safeModel = "llama-3.1-8b-instant";
            }
            completionOptions.model = safeModel;
            completionOptions.max_completion_tokens = 4096;

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
            parts: [{ text: responseText }]
        });

        await sessionDoc.save();
        console.log(`Chat saved to session ${sessionId}`);

        const userMsgId = sessionDoc.messages[sessionDoc.messages.length - 2]?._id;
        const modelMsgId = sessionDoc.messages[sessionDoc.messages.length - 1]?._id;
        if (userMsgId && modelMsgId) {
            res.write(`event: message_ids\ndata: ${JSON.stringify({ userMsgId, modelMsgId })}\n\n`);
        }

        res.write(`event: end\ndata: done\n\n`);
        res.end();

        (async () => {
            await saveContextChunk(userEmail, userMessage, "chat-user");
            await saveContextChunk(userEmail, responseText, "chat-ai");
        })();

    } catch (error) {
        console.error(error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
};

export const shareChat = async (req, res) => {
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
};

export const getSharedChat = async (req, res) => {
    try {
        const session = await SharedSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: "Shared session not found" });
        res.json(session);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch shared session" });
    }
};

export const chatCompletion = async (req, res) => {
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
        res.status(200).send({ text: "I’ve found your search results — you can see them in the side panel. Take a look whenever you’re ready!" });
    }
};
