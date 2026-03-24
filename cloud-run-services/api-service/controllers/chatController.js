import ChatSession from "../models/ChatSession.js";
import SharedSession from "../models/SharedSession.js";
import { findRelevantContext, saveContextChunk } from "../utils/vectorUtils.js";
import * as scraper from "../utils/scraper.js";
import getInitialPrompt from "../history.js";
import { genAI, anthropic, groq } from "../services/aiService.js";
import { runBrowserAutomationTask } from "../services/browserAutomationService.js";
import { detectIntentAndRoute, generateDynamicTitle } from "../services/orchestratorService.js";

function nowIST() {
    return new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: false
    });
}


function extractFirstHttpUrl(text = "") {
    const matches = text.match(/https?:\/\/[^\s)\]>"']+/gi);
    return matches?.[0] || null;
}

const OPEN_SHORTCUTS = {
    yt: "https://www.youtube.com/",
    youtube: "https://www.youtube.com/",
    "youtube.com": "https://www.youtube.com/",
    whatsapp: "https://web.whatsapp.com/",
    "whatsapp web": "https://web.whatsapp.com/",
    gmail: "https://mail.google.com/",
    drive: "https://drive.google.com/"
};

async function resolveOpenTarget(text = "") {
    const raw = (text || "").trim();
    if (!/^open\s+/i.test(raw)) return null;

    const explicitUrl = extractFirstHttpUrl(raw);
    if (explicitUrl) return explicitUrl;

    const target = raw.replace(/^open\s+/i, "").trim().replace(/^['\"]|['\"]$/g, "");
    if (!target) return null;

    const normalized = target.toLowerCase();
    if (OPEN_SHORTCUTS[normalized]) {
        return OPEN_SHORTCUTS[normalized];
    }

    try {
        const results = await scraper.googleSearch(`${target} official website`, 1);
        return results?.[0]?.link || null;
    } catch {
        return null;
    }
}
const BROWSER_SESSION_STATE_TTL_MS = 30 * 60 * 1000;
const browserSessionState = new Map();

function getBrowserStateKey({ sessionId, userEmail }) {
    if (sessionId) return "session:" + sessionId;
    return "user:" + userEmail;
}

function getBrowserState(stateKey) {
    const existing = browserSessionState.get(stateKey);
    if (!existing) {
        return {
            lastSearchResults: [],
            lastProducts: [],
            currentUrl: "",
            automationSessionId: "",
            updatedAt: Date.now()
        };
    }

    if (Date.now() - existing.updatedAt > BROWSER_SESSION_STATE_TTL_MS) {
        browserSessionState.delete(stateKey);
        return {
            lastSearchResults: [],
            lastProducts: [],
            currentUrl: "",
            automationSessionId: "",
            updatedAt: Date.now()
        };
    }

    return existing;
}

function setBrowserState(stateKey, partialState = {}) {
    const previous = getBrowserState(stateKey);
    const next = {
        ...previous,
        ...partialState,
        updatedAt: Date.now()
    };

    browserSessionState.set(stateKey, next);

    if (browserSessionState.size > 500) {
        for (const [key, value] of browserSessionState.entries()) {
            if (Date.now() - value.updatedAt > BROWSER_SESSION_STATE_TTL_MS) {
                browserSessionState.delete(key);
            }
        }
    }

    return next;
}

function ensureAutomationSessionId(stateKey, sessionId = "") {
    const state = getBrowserState(stateKey);
    if (state.automationSessionId) {
        return state.automationSessionId;
    }

    const base = sessionId || Date.now().toString(36);
    const generated = "auto-" + base + "-" + Math.random().toString(36).slice(2, 8);
    setBrowserState(stateKey, { automationSessionId: generated });
    return generated;
}

function looksLikeSelector(value = "") {
    const raw = (value || "").trim();
    if (!raw) return false;
    return /^([.#\[]|\/\/|xpath=|css=|[a-zA-Z][a-zA-Z0-9_-]*\[)/.test(raw);
}

function formatProductListForChat(products = []) {
    if (!Array.isArray(products) || products.length === 0) {
        return "";
    }

    return products.slice(0, 5).map((item, idx) => {
        const price = item?.price ? " | " + item.price : "";
        const title = (item?.title || "Product").slice(0, 90);
        return (idx + 1) + ". " + title + price;
    }).join("\n");
}

function parseBrowserCommand(text = "") {
    const raw = (text || "").trim();
    if (!raw) return null;

    const indexedOpenMatch = raw.match(/^open\s+(?:(first|second|third|fourth|fifth)|(\d+)(?:st|nd|rd|th)?)\s+(?:link|result)$/i);
    if (indexedOpenMatch) {
        const wordToIndex = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
        const indexFromWord = indexedOpenMatch[1] ? wordToIndex[indexedOpenMatch[1].toLowerCase()] : null;
        const indexFromNumber = indexedOpenMatch[2] ? Number(indexedOpenMatch[2]) : null;
        const index = indexFromWord || indexFromNumber || 1;
        return { type: "open_search_result", index };
    }

    const closeBrowserMatch = raw.match(/^(?:close\s+browser|close\s+browser\s+session|end\s+browser\s+session|stop\s+browser)$/i);
    if (closeBrowserMatch) {
        return { type: "close_browser" };
    }

    const selectProductMatch = raw.match(/^(?:select|choose|pick)\s+(\d+)$/i);
    if (selectProductMatch) {
        return { type: "select_product", index: Number(selectProductMatch[1]) };
    }

    const shopMatch = raw.match(/^(?:shop|buy)\s+(.+)$/i);
    if (shopMatch) {
        return { type: "shop", query: shopMatch[1].trim() };
    }

    if (/^(?:show\s+products|list\s+products|products)$/i.test(raw)) {
        return { type: "show_products" };
    }

    if (/^(?:check\s+stock|stock\s+status|stock)$/i.test(raw)) {
        return { type: "check_stock" };
    }

    if (/^(?:screenshot|capture\s+screenshot)$/i.test(raw)) {
        return { type: "screenshot" };
    }

    const scrollMatch = raw.match(/^scroll\s+(up|down)(?:\s+(\d+))?$/i);
    if (scrollMatch) {
        return {
            type: "scroll",
            direction: scrollMatch[1].toLowerCase(),
            amount: scrollMatch[2] ? Number(scrollMatch[2]) : 900
        };
    }

    const typeQuotedMatch = raw.match(/^type\s+"([\s\S]+?)"\s+(?:in|into)\s+"([\s\S]+)"$/i);
    if (typeQuotedMatch) {
        return {
            type: "type",
            text: typeQuotedMatch[1],
            selector: typeQuotedMatch[2]
        };
    }

    const typeMatch = raw.match(/^type\s+(.+?)\s+(?:in|into)\s+(.+)$/i);
    if (typeMatch) {
        return {
            type: "type",
            text: typeMatch[1].trim(),
            selector: typeMatch[2].trim()
        };
    }

    const clickMatch = raw.match(/^click\s+(.+)$/i);
    if (clickMatch) {
        const clickTarget = clickMatch[1].trim().replace(/^['"]|['"]$/g, "");
        if (/^\d+$/.test(clickTarget)) {
            return { type: "click", linkIndex: Math.max(0, Number(clickTarget) - 1) };
        }

        return looksLikeSelector(clickTarget)
            ? { type: "click", selector: clickTarget }
            : { type: "click", text: clickTarget };
    }

    const searchMatch = raw.match(/^(?:search|find)\s+(.+)$/i);
    if (searchMatch) {
        return { type: "search", query: searchMatch[1].trim() };
    }

    const summarizeMatch = raw.match(/^(?:summarize|summary)\s+(https?:\/\/[^\s]+)$/i);
    if (summarizeMatch) {
        return { type: "summarize_url", url: summarizeMatch[1] };
    }

    if (/^open\s+/i.test(raw)) {
        return { type: "open", raw };
    }

    return null;
}

async function executeBrowserCommand({ command, userMessage, sessionId, stateKey }) {
    if (command.type === "close_browser") {
        const state = getBrowserState(stateKey);
        const activeSessionId = state.automationSessionId || "";

        if (!activeSessionId) {
            return {
                message: "No active browser session to close.",
                browserResult: { action: "close_browser", closed: false }
            };
        }

        try {
            await runBrowserAutomationTask({
                taskType: "end_session",
                options: {},
                sessionId: activeSessionId
            });
        } catch (error) {
            return {
                message: "I could not close the browser session cleanly: " + (error.message || "Unknown error"),
                browserResult: { action: "close_browser", closed: false, error: error.message || "Unknown error" }
            };
        }

        setBrowserState(stateKey, {
            automationSessionId: "",
            currentUrl: "",
            lastProducts: [],
            lastSearchResults: []
        });

        return {
            message: "Browser session closed for this chat session.",
            browserResult: { action: "close_browser", closed: true, sessionId: activeSessionId }
        };
    }

    const persistentSessionId = ensureAutomationSessionId(stateKey, sessionId);

    if (command.type === "open") {
        const openTargetUrl = await resolveOpenTarget(userMessage);
        if (!openTargetUrl) {
            return { message: "I couldn't find a valid website to open. Please provide a full https URL." };
        }

        const openResult = await runBrowserAutomationTask({
            taskType: "open",
            url: openTargetUrl,
            options: {
                waitUntil: "commit",
                navigationTimeoutMs: 18000
            },
            sessionId: persistentSessionId
        });

        const browserResult = {
            action: "open",
            url: openResult.url || openTargetUrl,
            previewUrl: openResult.previewUrl || openResult.url || openTargetUrl,
            title: openResult.title || "",
            screenshotBase64: openResult.screenshotBase64 || "",
            timingMs: openResult.timingMs || 0
        };

        setBrowserState(stateKey, {
            currentUrl: browserResult.url,
            lastProducts: []
        });

        return {
            message: "Opened in Browser View: " + browserResult.previewUrl,
            browserResult
        };
    }

    if (command.type === "shop") {
        const query = (command.query || "").trim();
        if (!query) {
            return { message: "Tell me what product you want to shop for." };
        }

        const shopUrl = "https://www.flipkart.com/search?q=" + encodeURIComponent(query);
        const openResult = await runBrowserAutomationTask({
            taskType: "open",
            url: shopUrl,
            options: {
                waitUntil: "domcontentloaded",
                navigationTimeoutMs: 22000
            },
            sessionId: persistentSessionId
        });

        const productsResult = await runBrowserAutomationTask({
            taskType: "extract_products",
            options: { limit: 8 },
            sessionId: persistentSessionId
        });

        const products = productsResult.products || [];
        setBrowserState(stateKey, {
            currentUrl: openResult.url || shopUrl,
            lastProducts: products
        });

        const listText = formatProductListForChat(products);
        const message = products.length
            ? "I found these products for '" + query + "':\n" + listText + "\n\nReply with: select 1 (or 2,3...)"
            : "I opened shopping results for '" + query + "', but I couldn't extract products yet. Try 'show products'.";

        return {
            message,
            browserResult: {
                action: "shop",
                query,
                url: openResult.url || shopUrl,
                previewUrl: openResult.previewUrl || openResult.url || shopUrl,
                title: openResult.title || productsResult.title || "",
                screenshotBase64: productsResult.screenshotBase64 || openResult.screenshotBase64 || "",
                products
            },
            sources: products.map((item) => {
                let d = "";
                try { d = new URL(item.url).hostname.replace('www.', ''); } catch(e){}
                return { title: item.title || item.url, link: item.url, domain: d };
            }).slice(0, 8)
        };
    }

    if (command.type === "show_products") {
        const productsResult = await runBrowserAutomationTask({
            taskType: "extract_products",
            options: { limit: 8 },
            sessionId: persistentSessionId
        });

        const products = productsResult.products || [];
        setBrowserState(stateKey, {
            currentUrl: productsResult.url || getBrowserState(stateKey).currentUrl,
            lastProducts: products
        });

        const listText = formatProductListForChat(products);
        const message = products.length
            ? "Here are the products on this page:\n" + listText + "\n\nReply with: select 1"
            : "I couldn't detect products on this page. Try scrolling and then 'show products' again.";

        return {
            message,
            browserResult: {
                action: "products",
                url: productsResult.url || "",
                previewUrl: productsResult.previewUrl || productsResult.url || "",
                title: productsResult.title || "",
                screenshotBase64: productsResult.screenshotBase64 || "",
                products
            },
            sources: products.map((item) => {
                let d = "";
                try { d = new URL(item.url).hostname.replace('www.', ''); } catch(e){}
                return { title: item.title || item.url, link: item.url, domain: d };
            }).slice(0, 8)
        };
    }

    if (command.type === "select_product") {
        const state = getBrowserState(stateKey);
        const index = Math.max(1, Number(command.index || 1));
        const target = state.lastProducts?.[index - 1];

        if (!target?.url) {
            return { message: "I couldn't find that product index. Use 'show products' first, then 'select 1'." };
        }

        const openResult = await runBrowserAutomationTask({
            taskType: "open",
            url: target.url,
            options: {
                waitUntil: "domcontentloaded",
                navigationTimeoutMs: 22000,
                title: target.title || ""
            },
            sessionId: persistentSessionId
        });

        setBrowserState(stateKey, {
            currentUrl: openResult.url || target.url
        });

        return {
            message: "Opened product " + index + ": " + (target.title || openResult.title || target.url),
            browserResult: {
                action: "open_product",
                index,
                url: openResult.url || target.url,
                previewUrl: openResult.previewUrl || openResult.url || target.url,
                title: openResult.title || target.title || "",
                screenshotBase64: openResult.screenshotBase64 || ""
            }
        };
    }

    if (command.type === "click") {
        const clickOptions = {
            actionTimeoutMs: 8000,
            navigationTimeoutMs: 16000
        };

        if (typeof command.linkIndex === "number") clickOptions.linkIndex = command.linkIndex;
        if (command.selector) clickOptions.selector = command.selector;
        if (command.text) clickOptions.text = command.text;

        const clickResult = await runBrowserAutomationTask({
            taskType: "click",
            options: clickOptions,
            sessionId: persistentSessionId
        });

        setBrowserState(stateKey, {
            currentUrl: clickResult.url || getBrowserState(stateKey).currentUrl
        });

        return {
            message: "Click action completed.",
            browserResult: {
                action: "click",
                url: clickResult.url || "",
                previewUrl: clickResult.previewUrl || clickResult.url || "",
                title: clickResult.title || "",
                screenshotBase64: clickResult.screenshotBase64 || ""
            }
        };
    }

    if (command.type === "type") {
        const typeResult = await runBrowserAutomationTask({
            taskType: "type",
            options: {
                selector: command.selector,
                text: command.text,
                pressEnter: true,
                navigationTimeoutMs: 18000
            },
            sessionId: persistentSessionId
        });

        setBrowserState(stateKey, {
            currentUrl: typeResult.url || getBrowserState(stateKey).currentUrl
        });

        return {
            message: "Typed your text and submitted.",
            browserResult: {
                action: "type",
                url: typeResult.url || "",
                previewUrl: typeResult.previewUrl || typeResult.url || "",
                title: typeResult.title || "",
                screenshotBase64: typeResult.screenshotBase64 || ""
            }
        };
    }

    if (command.type === "scroll") {
        const scrollResult = await runBrowserAutomationTask({
            taskType: "scroll",
            options: {
                direction: command.direction || "down",
                amount: command.amount || 900,
                waitAfterMs: 400
            },
            sessionId: persistentSessionId
        });

        return {
            message: "Scrolled " + (command.direction || "down") + ".",
            browserResult: {
                action: "scroll",
                url: scrollResult.url || "",
                previewUrl: scrollResult.previewUrl || scrollResult.url || "",
                title: scrollResult.title || "",
                screenshotBase64: scrollResult.screenshotBase64 || ""
            }
        };
    }

    if (command.type === "screenshot") {
        const shotResult = await runBrowserAutomationTask({
            taskType: "screenshot",
            options: { fullPage: true },
            sessionId: persistentSessionId
        });

        return {
            message: "Captured screenshot from current browser session.",
            browserResult: {
                action: "screenshot",
                url: shotResult.url || "",
                previewUrl: shotResult.url || "",
                title: shotResult.title || "",
                screenshotBase64: shotResult.screenshotBase64 || ""
            }
        };
    }

    if (command.type === "check_stock") {
        const stockResult = await runBrowserAutomationTask({
            taskType: "extract_stock",
            options: {},
            sessionId: persistentSessionId
        });

        const stockMatches = stockResult.stock?.matches || [];
        const stockMessage = stockMatches.length
            ? "Stock details found:\n" + stockMatches.slice(0, 6).join("\n")
            : "I couldn't find clear stock text on this page yet.";

        return {
            message: stockMessage,
            browserResult: {
                action: "stock",
                url: stockResult.url || "",
                previewUrl: stockResult.previewUrl || stockResult.url || "",
                title: stockResult.title || "",
                screenshotBase64: stockResult.screenshotBase64 || "",
                stock: stockResult.stock || {}
            }
        };
    }

    if (command.type === "search") {
        const query = (command.query || "").trim();
        if (!query) {
            return { message: "Please provide what you want to search." };
        }

        let results = [];
        try {
            results = await scraper.googleSearch(query, 8);
        } catch {
            const fallbackUrl = "https://duckduckgo.com/?q=" + encodeURIComponent(query);
            const fallbackOpenResult = await runBrowserAutomationTask({
                taskType: "open",
                url: fallbackUrl,
                options: {
                    waitUntil: "commit",
                    navigationTimeoutMs: 18000,
                    title: 'Search results for "' + query + '"'
                },
                sessionId: persistentSessionId
            });

            const fallbackResult = {
                action: "search",
                query,
                url: fallbackOpenResult.url || fallbackUrl,
                previewUrl: fallbackOpenResult.previewUrl || fallbackOpenResult.url || fallbackUrl,
                title: fallbackOpenResult.title || ('Search results for "' + query + '"'),
                screenshotBase64: fallbackOpenResult.screenshotBase64 || ""
            };

            const fallbackSources = [{
                title: fallbackResult.title,
                link: fallbackResult.url
            }];

            setBrowserState(stateKey, {
                lastSearchResults: [{
                    title: fallbackResult.title,
                    link: fallbackResult.url,
                    snippet: ""
                }],
                currentUrl: fallbackResult.url,
                lastProducts: []
            });

            return {
                message: 'Opened search results for "' + query + '" in Browser View.',
                sources: fallbackSources,
                browserResult: fallbackResult
            };
        }

        const sources = results.map((item) => ({
            title: item.title || item.link,
            link: item.link,
            domain: item.domain || ""
        }));

        let browserResult = null;
        if (results[0]?.link) {
            const openResult = await runBrowserAutomationTask({
                taskType: "open",
                url: results[0].link,
                options: {
                    waitUntil: "commit",
                    navigationTimeoutMs: 18000,
                    title: results[0].title || ""
                },
                sessionId: persistentSessionId
            });

            browserResult = {
                action: "search",
                query,
                url: openResult.url || results[0].link,
                previewUrl: openResult.previewUrl || openResult.url || results[0].link,
                title: openResult.title || results[0].title || "",
                screenshotBase64: openResult.screenshotBase64 || "",
                snippet: results[0].snippet || "",
                links: sources
            };
        }

        setBrowserState(stateKey, {
            lastSearchResults: results,
            currentUrl: browserResult?.url || "",
            lastProducts: []
        });

        return {
            message: results.length
                ? 'Found ' + results.length + ' results for "' + query + '". Opened the first result in Browser View.'
                : 'No results found for "' + query + '".',
            sources,
            browserResult
        };
    }

    if (command.type === "open_search_result") {
        const state = getBrowserState(stateKey);
        const index = Math.max(1, Number(command.index || 1));
        const target = state.lastSearchResults?.[index - 1];

        if (!target?.link) {
            return { message: "I couldn't find that result. Run a search first, then say 'open first link' or 'open second link'." };
        }

        const openResult = await runBrowserAutomationTask({
            taskType: "open",
            url: target.link,
            options: {
                waitUntil: "commit",
                navigationTimeoutMs: 18000,
                title: target.title || ""
            },
            sessionId: persistentSessionId
        });

        const browserResult = {
            action: "open",
            url: openResult.url || target.link,
            previewUrl: openResult.previewUrl || openResult.url || target.link,
            title: openResult.title || target.title || "",
            screenshotBase64: openResult.screenshotBase64 || "",
            timingMs: openResult.timingMs || 0
        };

        setBrowserState(stateKey, { currentUrl: browserResult.url, lastProducts: [] });

        return {
            message: "Opened in Browser View: " + browserResult.previewUrl,
            browserResult
        };
    }

    if (command.type === "summarize_url") {
        const browserResult = await runBrowserAutomationTask({
            taskType: "summarize_content",
            url: command.url,
            options: { maxTextChars: 6000 },
            sessionId: persistentSessionId
        });

        const summaryResult = {
            action: "summarize",
            url: browserResult.url || command.url,
            previewUrl: browserResult.url || command.url,
            title: browserResult.title || "",
            summary: browserResult.summary || "",
            text: (browserResult.text || "").slice(0, 3000)
        };

        setBrowserState(stateKey, { currentUrl: summaryResult.url, lastProducts: [] });

        return {
            message: summaryResult.summary || ("Summarized content from " + summaryResult.url),
            browserResult: summaryResult
        };
    }

    return null;
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
        model: selectedModel = "gemini-2.0-flash",
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
        customRules,
        agentId
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

    // Orchestration Layer
    const orchestrationResult = await detectIntentAndRoute(userMessage, selectedModel);

    // Handle App Commands
    if (orchestrationResult.type === 'app_command') {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.write(`event: app_command\ndata: ${JSON.stringify({ command: orchestrationResult.command })}\n\n`);
        res.write(`data: ${JSON.stringify({ text: `Executing system action: ${orchestrationResult.command.action.replace(/_/g, ' ')}` })}\n\n`);
        res.write(`event: end\ndata: done\n\n`);
        return res.end();
    }

    const finalModel = orchestrationResult.model || selectedModel;

    const geminiParts = buildParts(userMessage, req.file);
    let contextBlock = `[SYSTEM CONTEXT]\nCurrent Time (IST): ${nowIST()}\n`;

    // Tool Execution System integration with Context
    if (orchestrationResult.type === 'tool_request') {
        const toolName = orchestrationResult.tool;
        
        if (toolName === 'pdf_generator') {
            const downloadUrl = "#"; // Placeholder for actual PDF generation
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.write(`data: ${JSON.stringify({ text: `I've generated the PDF report for you. \n\n[Download PDF Report](${downloadUrl})` })}\n\n`);
            res.write(`event: end\ndata: done\n\n`);
            return res.end();
        }

        if (toolName === 'image_generator') {
            contextBlock += `\n[SYSTEM ACTION: GENERATE_IMAGE]\nUser wants to generate an image. Use Imagen 4 if possible.\n`;
        }

        if (toolName === 'file_exporter') {
            const downloadUrl = "#";
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.write(`data: ${JSON.stringify({ text: `The project has been exported successfully. \n\n[Download Exported Project](${downloadUrl})` })}\n\n`);
            res.write(`event: end\ndata: done\n\n`);
            return res.end();
        }
    }

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
            const title = await generateDynamicTitle(userMessage);
            sessionDoc = new ChatSession({
                email: userEmail,
                title: title,
                messages: [],
                isTemporary: isTemporary,
                isWebSearchEnabled: isWebSearchEnabled,
                agentId: agentId || "chat"
            });
            await sessionDoc.save();
            sessionId = sessionDoc._id;
        }

        res.write(`data: ${JSON.stringify({ sessionId: sessionId })}\n\n`);

        const parsedBrowserCommand = parseBrowserCommand(userMessage);
        if (parsedBrowserCommand) {
            const stateKey = getBrowserStateKey({
                sessionId: sessionId ? String(sessionId) : "",
                userEmail
            });

            let commandResult;
            try {
                commandResult = await executeBrowserCommand({
                    command: parsedBrowserCommand,
                    userMessage,
                    sessionId: sessionId ? String(sessionId) : "",
                    stateKey
                });
            } catch (commandError) {
                commandResult = {
                    message: "Browser automation failed: " + (commandError.message || "Unknown error"),
                    browserResult: {
                        action: parsedBrowserCommand.type,
                        error: commandError.message || "Unknown error"
                    }
                };
            }

            if (Array.isArray(commandResult?.sources) && commandResult.sources.length > 0) {
                res.write("event: sources\ndata: " + JSON.stringify(commandResult.sources) + "\n\n");
            }

            if (commandResult?.browserResult) {
                if (!commandResult.browserResult.sessionId) {
                    const activeSession = getBrowserState(stateKey);
                    if (activeSession?.automationSessionId) {
                        commandResult.browserResult.sessionId = activeSession.automationSessionId;
                    }
                }
                res.write("event: browser_result\ndata: " + JSON.stringify(commandResult.browserResult) + "\n\n");
            }

            responseText = commandResult?.message || "Done.";
            res.write("data: " + JSON.stringify({ text: responseText }) + "\n\n");

            sessionDoc.messages.push({
                role: "user",
                parts: [{ text: userMessage }]
            });
            sessionDoc.messages.push({
                role: "model",
                parts: [{ text: responseText }]
            });
            await sessionDoc.save();

            res.write("event: end\ndata: done\n\n");
            res.end();

            (async () => {
                await saveContextChunk(userEmail, userMessage, "chat-user");
                await saveContextChunk(userEmail, responseText, "chat-ai");
            })();

            return;
        }

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
        // [MODIFIED] contextBlock already initialized with time and tools above
        // contextBlock = `[SYSTEM CONTEXT]\nCurrent Time (IST): ${nowIST()}\n`;

        const relevantContext = await findRelevantContext(userEmail, userMessage);
        if (relevantContext.length > 0) {
            console.log("Found relevant context:", relevantContext.length, "items");
            contextBlock += `\nRelevant Past Memories:\n${relevantContext.map(c => `[Date: ${c.createdAt.toISOString().split('T')[0]}] ${c.text}`).join("\n---\n")}\n`;
        }

        const openTargetUrl = await resolveOpenTarget(userMessage);
        let openContext = null;
        let openErrorMessage = "";
        if (openTargetUrl) {
            try {
                const openResult = await runBrowserAutomationTask({
                    taskType: "open",
                    url: openTargetUrl,
                    options: {},
                    sessionId: sessionId ? String(sessionId) : ""
                });

                openContext = {
                    action: "open",
                    url: openResult.url || openTargetUrl,
                    previewUrl: openResult.url || openTargetUrl,
                    title: openResult.title || ""
                };

                contextBlock += `\nBrowser-Open-Action:\n${JSON.stringify(openContext)}\n`;
                res.write(`event: browser_result\ndata: ${JSON.stringify(openContext)}\n\n`);
            } catch (openErr) {
                openErrorMessage = openErr.message || "Failed to open target";
                console.error("Browser open task failed:", openErrorMessage);
                res.write(`event: browser_result\ndata: ${JSON.stringify({ action: "open", error: openErrorMessage, previewUrl: openTargetUrl, url: openTargetUrl })}\n\n`);
            }
        }

        if (isWebSearchEnabled && !openTargetUrl) {
            try {
                const data = await scraper.scrapeQuery(userMessage);
                contextBlock += `\nWeb-Scraped-Data:\n${JSON.stringify(data)}\n`;
                const sources = (data.results || []).map(r => ({ 
                    title: r.title, 
                    link: r.link,
                    domain: r.domain || "" 
                }));
                res.write(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`);

                const explicitUrl = extractFirstHttpUrl(userMessage);
                if (explicitUrl) {
                    try {
                        const browserResult = await runBrowserAutomationTask({
                            taskType: "summarize_content",
                            url: explicitUrl,
                            options: { maxTextChars: 6000 },
                            sessionId: sessionId ? String(sessionId) : ""
                        });

                        const browserContext = {
                            action: "summarize",
                            url: browserResult.url || explicitUrl,
                            previewUrl: browserResult.url || explicitUrl,
                            title: browserResult.title || "",
                            summary: browserResult.summary || "",
                            text: (browserResult.text || "").slice(0, 3000)
                        };

                        contextBlock += `\nBrowser-Automation-Data:\n${JSON.stringify(browserContext)}\n`;
                        res.write(`event: browser_result\ndata: ${JSON.stringify(browserContext)}\n\n`);
                    } catch (browserErr) {
                        console.error("Browser task failed:", browserErr.message);
                    }
                }
            } catch (err) {
                console.error("Web search failed:", err.message);
            }
        }
        if (openTargetUrl) {
            responseText = openErrorMessage
                ? `I could not open ${openTargetUrl}. Error: ${openErrorMessage}`
                : `Opened in Browser View: ${openContext?.previewUrl || openTargetUrl}`;

            res.write(`data: ${JSON.stringify({ text: responseText })}\n\n`);

            sessionDoc.messages.push({
                role: "user",
                parts: [{ text: userMessage }]
            });
            sessionDoc.messages.push({
                role: "model",
                parts: [{ text: responseText }]
            });
            await sessionDoc.save();

            res.write(`event: end\ndata: done\n\n`);
            res.end();

            (async () => {
                await saveContextChunk(userEmail, userMessage, "chat-user");
                await saveContextChunk(userEmail, responseText, "chat-ai");
            })();

            return;
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

        if (finalModel.includes("claude")) {
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
                model: finalModel,
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

        } else if (["gpt-oss-120b", "llama", "qwen", "moonshot", "kimi"].some(keyword => finalModel.includes(keyword)) || finalModel.includes("groq")) {

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

            let safeModel = finalModel;
            if (finalModel.includes("gpt-oss-120b")) {
                safeModel = "llama-3.3-70b-versatile";
                completionOptions.temperature = 1;
            } else if (finalModel.includes("qwen") || finalModel.includes("moonshot") || finalModel.includes("kimi")) {
                safeModel = "llama-3.1-8b-instant";
                completionOptions.temperature = 0.6;
            } else if (finalModel.includes("llama")) {
                safeModel = finalModel.includes("70b") ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant";
                completionOptions.temperature = 0.8;
            } else if (finalModel.includes("/")) {
                // Strip prefix if any, e.g. "groq/llama-..."
                safeModel = finalModel.split("/").pop();
            }

            if (!safeModel.includes("-")) {
                safeModel = "llama-3.1-8b-instant";
            }
            
            completionOptions.model = safeModel;
            completionOptions.max_tokens = 4096;

            const completion = await groq.chat.completions.create(completionOptions);

            for await (const chunk of completion) {
                const text = chunk.choices[0]?.delta?.content || '';
                if (text) {
                    responseText += text;
                    res.write(`data: ${JSON.stringify({ text })}\n\n`);
                }
            }

        } else {
            const model = genAI.getGenerativeModel({ model: finalModel });
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
        res.status(200).send({ text: "I've found your search results — you can see them in the side panel. Take a look whenever you're ready!" });
    }
};







