import { genAI } from "./aiService.js";

const MODELS = {
    GEMINI_2_5: "gemini-2.5-flash",
    GEMINI_2_0: "gemini-2.0-flash",
    KIMI_K2: "moonshotai/kimi-k2-instruct-0905",
    LLAMA_3_3_70B: "llama-3.3-70b-versatile",
    QWEN_3_32B: "qwen/qwen3-32b",
    GPT_OSS_120B: "openai/gpt-oss-120b"
};

/**
 * Detects if the user message is a system control command.
 * Uses Regex for common commands (speed) and LLM for complex NL intent.
 */
async function detectSystemIntent(text) {
    const raw = (text || "").toLowerCase().trim();

    // 1. FAST REGEX FALLBACKS (Highest Reliability)
    // Theme
    if (/(switch|change|set|toggle|enable|disable).*(dark|light).*(mode|theme)/i.test(raw) || /^(dark|light)\s+mode$/i.test(raw)) {
        const target = raw.includes('light') ? 'light' : 'dark';
        return { action: "update_theme", payload: { theme: target } };
    }
    
    // Voice
    if (/(enable|turn\s+on|start|activate).*(voice|speech)/i.test(raw)) return { action: "voice_control", payload: { enabled: true } };
    if (/(disable|turn\s+off|stop|deactivate).*(voice|speech)/i.test(raw)) return { action: "voice_control", payload: { enabled: false } };
    
    // Navigation
    if (/open\s+gallery/i.test(raw) || /show\s+gallery/i.test(raw)) return { action: "navigation", payload: { target: "gallery" } };
    if (/open\s+settings/i.test(raw) || /show\s+settings/i.test(raw)) return { action: "navigation", payload: { target: "settings" } };
    if (/open\s+(privacy|policy|terms)/i.test(raw)) return { action: "navigation", payload: { target: "privacy" } };
    if (/open\s+help/i.test(raw)) return { action: "navigation", payload: { target: "help" } };
    
    // Session
    if (/(delete|remove|destroy)\s+(this\s+)?session/i.test(raw)) return { action: "manage_session", payload: { type: "delete_session" } };
    if (/(clear|reset|wipe)\s+(chat|history)/i.test(raw)) return { action: "manage_session", payload: { type: "clear_chat" } };
    
    // Model Selection
    const modelMatch = raw.match(/change\s+(model|ai)\s+to\s+(gemini\s+2\.5|gemini\s+2\.0|gemini\s+2|llama|qwen|kimi|gpt)/i);
    if (modelMatch) {
        const target = modelMatch[2].toLowerCase();
        let value = 'gemini-2.0-flash';
        if (target.includes('2.5')) value = 'gemini-2.5-flash';
        if (target.includes('llama')) value = 'llama-3.3-70b-versatile';
        if (target.includes('qwen')) value = 'qwen/qwen3-32b';
        if (target.includes('kimi')) value = 'moonshotai/kimi-k2-instruct-0905';
        if (target.includes('gpt')) value = 'openai/gpt-oss-120b';
        return { action: "update_settings", payload: { field: "userDefaultModel", value } };
    }

    // 2. LLM INTENT DETECTION (Natural Language handling)
    try {
        const model = genAI.getGenerativeModel({ model: MODELS.GEMINI_2_0 });
        const prompt = `You are a SYSTEM_ACTION_DETECTOR.
        The user is talking to an AI app. Decide if they are asking the APP to do something, or just chatting.

        ACTIONS:
        - update_theme: {"theme": "dark" | "light"}
        - update_settings: {"field": "userVoice" | "userDefaultModel" | "userLanguage", "value": "string"}
        - manage_session: {"type": "delete_session" | "clear_chat"}
        - navigation: {"target": "settings" | "gallery" | "privacy" | "help"}
        - voice_control: {"enabled": boolean}

        If the user wants to change the AI model, use "update_settings" with field "userDefaultModel".
        Valid models: "gemini-2.0-flash", "gemini-2.5-flash", "llama-3.3-70b-versatile", "qwen/qwen3-32b", "moonshotai/kimi-k2-instruct-0905", "openai/gpt-oss-120b".

        REQUIRED OUTPUT FORMAT:
        - If it's a system command: Return ONLY a JSON object like {"action": "...", "payload": {...}}. No extra text.
        - If it's normal chat: Return exactly "NONE".

        User: "make it dark" -> {"action": "update_theme", "payload": {"theme": "dark"}}
        User: "stop speaking" -> {"action": "voice_control", "payload": {"enabled": false}}
        User: "who are you?" -> NONE
        User: "set model to llama" -> {"action": "update_settings", "payload": {"field": "userDefaultModel", "value": "llama-3.3-70b-versatile"}}

        Current User Message: "${text}"`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        if (responseText.includes("NONE")) return null;

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            console.log("[Orchestrator] Detected System Action:", jsonMatch[0]);
            return JSON.parse(jsonMatch[0]);
        }
        return null;
    } catch (e) {
        console.error("System Intent Detection failed:", e);
        return null;
    }
}

/**
 * Orchestrates intent detection and model routing.
 */
export const detectIntentAndRoute = async (userMessage, selectedModel = "gemini-2.0-flash") => {
    const raw = (userMessage || "").toLowerCase().trim();
    
    // 1. Check for System Intent (App Commands)
    // We use LLM for this now as requested for robust natural language interpretation
    // Pass original userMessage to preserve nuance for LLM
    const systemIntent = await detectSystemIntent(userMessage);
    if (systemIntent) {
        return { type: 'app_command', command: systemIntent };
    }

    // 2. Check for Tool Requests (Regex for speed on common tools)
    const toolRequest = detectToolRequest(raw);
    if (toolRequest) {
        return { type: 'tool_request', tool: toolRequest };
    }

    // 3. Handle Auto Model Routing
    if (selectedModel === "auto") {
        const routedModel = routeModel(raw);
        return { type: 'chat', model: routedModel, isAuto: true };
    }

    return { type: 'chat', model: selectedModel };
};

function detectAppCommand(text) {
    // Deprecated in favor of detectSystemIntent
    return null;
}

function detectToolRequest(text) {
    if (/(create|generate|make|convert\s+to|save\s+as)\s+(a\s+)?pdf/i.test(text) || /pdf\s+report/i.test(text)) return "pdf_generator";
    if (/(generate|create|make|draw|paint|visualize)\s+(an\s+)?image/i.test(text)) return "image_generator";
    if (/(export|download)\s+(the\s+)?(file|project|source\s+code)/i.test(text) || /zip\s+project/i.test(text)) return "file_exporter";
    return null;
}

function routeModel(text) {
    // Coding / Frontend / Canvas
    if (/(code|react|html|css|javascript|component|frontend|canvas|ui|design|artifact)/i.test(text)) {
        return MODELS.GEMINI_2_5;
    }

    // Creative / Writing
    if (/(story|creative|writing|brainstorm|storytelling|poem|script)/i.test(text)) {
        return MODELS.GPT_OSS_120B;
    }

    // Complex / Long Context
    if (/(explain|complex|academic|analysis|research|deep|long context)/i.test(text)) {
        return MODELS.KIMI_K2;
    }

    // Logic / Architecture
    if (/(logic|architecture|engineering|system|backend|database|cloud)/i.test(text)) {
        return MODELS.LLAMA_3_3_70B;
    }

    // Multilingual / Data
    if (/(translate|translation|multilingual|hindi|tamil|french|data|extraction|csv|json)/i.test(text)) {
        return MODELS.QWEN_3_32B;
    }

    // Default
    return MODELS.GEMINI_2_0;
}

export async function generateDynamicTitle(userMessage) {
    try {
        const model = genAI.getGenerativeModel({ model: MODELS.GEMINI_2_0 });
        const prompt = `You are a helpful assistant. Generate a short, descriptive session title based on the user's first message. 
        Max 5 words. No quotes. No periods.
        
        User Message: "${userMessage}"
        
        Title:`;
        
        const result = await model.generateContent(prompt);
        let title = result.response.text().trim().replace(/^["']|["']$/g, '');
        // more cleaning
        title = title.replace(/[.!?]+$/, '').trim();

        console.log(`[Orchestrator] Dynamic Title Generated: "${title}" for message: "${userMessage.substring(0, 30)}..."`);
        return title || (userMessage.split(" ").slice(0, 5).join(" ") + "...");
    } catch (e) {
        console.error("[Orchestrator] Title generation failed:", e);
        return userMessage.split(" ").slice(0, 5).join(" ") + "...";
    }
}
