import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the Python scripts folder AND the main backend folder
const envConfigPython = dotenv.config({ path: path.join(__dirname, 'Python-scripts', '.env') });
const envConfigMain = dotenv.config({ path: path.join(__dirname, '.env') }); // Load main .env

const PROJECT_ID = process.argv[2] || 'chatterbox-chatbot';
const REGION = 'us-central1'; // Default, change if needed
const SERVICE_NAME = 'chatterbox-backend';

// Merge clean env vars from process.env (dotenv places them there)
const API_KEY = process.env.API_KEY_SE;
const CX_ID = process.env.CX_ID || process.env.CX;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGO_URI = process.env.MONGO_URI;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
// Start with a default, but allow override if set in .env, or hardcode the production one known
const FRONTEND_URL = "https://treevit.web.app";

if (!API_KEY || !CX_ID) {
    console.warn("Warning: API_KEY_SE or CX_ID missing. Search might fail.");
}

console.log(`Deploying to Project: ${PROJECT_ID}`);
console.log(`Region: ${REGION}`);
console.log(`Service: ${SERVICE_NAME}`);
console.log(`Frontend URL: ${FRONTEND_URL}`);

try {
    // 1. Build and Submit
    console.log("\n1. Building and Submitting Image...");
    execSync(`gcloud builds submit . --tag "gcr.io/${PROJECT_ID}/${SERVICE_NAME}" --project "${PROJECT_ID}"`, { stdio: 'inherit' });

    // 2. Deploy with Env Vars
    // Construct env var string carefully
    let envVars = `NODE_ENV=production`;
    if (API_KEY) envVars += `,API_KEY_SE=${API_KEY}`;
    if (CX_ID) envVars += `,CX_ID=${CX_ID}`;
    if (GEMINI_API_KEY) envVars += `,GEMINI_API_KEY=${GEMINI_API_KEY}`;
    if (MONGO_URI) envVars += `,MONGO_URI=${MONGO_URI}`;
    if (ANTHROPIC_API_KEY) envVars += `,ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}`;
    if (GROQ_API_KEY) envVars += `,GROQ_API_KEY=${GROQ_API_KEY}`;
    // Always update FRONTEND_URL to match the firebase project
    // NOTE: If deploying frontend to a different URL, this needs manual update or passed arg.
    envVars += `,FRONTEND_URL=${FRONTEND_URL}`;

    console.log("\n2. Deploying to Cloud Run with updated secrets...");
    execSync(`gcloud run deploy ${SERVICE_NAME} --image "gcr.io/${PROJECT_ID}/${SERVICE_NAME}" --platform managed --region "${REGION}" --project "${PROJECT_ID}" --update-env-vars="${envVars}" --allow-unauthenticated`, { stdio: 'inherit' });

    console.log("\n✅ Deployment Success!");

} catch (error) {
    console.error("\n❌ Deployment Failed:", error.message);
    process.exit(1);
}
