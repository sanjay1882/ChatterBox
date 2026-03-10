import fs from 'fs';

const serverLines = fs.readFileSync('old_server.js', 'utf8').split('\n');

function cleanFunc(start, end) {
    let lines = serverLines.slice(start - 1, end);
    let firstLine = lines[0];
    const asyncIndex = firstLine.indexOf('async ');
    if (asyncIndex !== -1) {
        lines[0] = firstLine.substring(asyncIndex);
    }
    let lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = lastLine.replace('});', '}').replace('})', '}');
    return lines.join('\n');
}

// Ensure the helper function matches the exact signature
const buildPartsLogic = serverLines.slice(83, 111).join('\n');
const nowISTLogic = serverLines.slice(74, 80).join('\n');

const chatControllerContent = `import ChatSession from "../models/ChatSession.js";
import SharedSession from "../models/SharedSession.js";
import { findRelevantContext, saveContextChunk } from "../utils/vectorUtils.js";
import * as scraper from "../utils/scraper.js";
import getInitialPrompt from "../history.js";
import { genAI, anthropic, groq } from "../services/aiService.js";

${nowISTLogic}

${buildPartsLogic}

export const streamChat = ` + cleanFunc(303, 646) + `;

export const shareChat = ` + cleanFunc(649, 671) + `;

export const getSharedChat = ` + cleanFunc(674, 682) + `;

export const chatCompletion = ` + cleanFunc(1206, 1220) + `;
`;

fs.writeFileSync('controllers/chatController.js', chatControllerContent);


const agentControllerContent = `import ChatSession from "../models/ChatSession.js";
import GeneratedContent from "../models/GeneratedContent.js";
import { findRelevantContext, saveContextChunk } from "../utils/vectorUtils.js";
import * as scraper from "../utils/scraper.js";
import fetch from "node-fetch";
import { genAI, anthropic, groq } from "../services/aiService.js";

export const excelAgentStream = ` + cleanFunc(184, 301) + `;

export const getSearchQueries = ` + cleanFunc(687, 708) + `;

export const getSearchResults = ` + cleanFunc(711, 728) + `;

export const scrapeAndVectorize = ` + cleanFunc(731, 778) + `;

export const spectraGenerate = ` + cleanFunc(784, 936) + `;

export const analyzeUrlStream = ` + cleanFunc(939, 1048) + `;

export const searchOverviewStream = ` + cleanFunc(1051, 1132) + `;

export const generateImage = ` + cleanFunc(1222, 1323) + `;

export const transcribeAudio = ` + cleanFunc(1332, 1355) + `;

export const excelAgentJson = ` + cleanFunc(1360, 1422) + `;
`;

fs.writeFileSync('controllers/agentController.js', agentControllerContent);

console.log("Extraction complete!");
