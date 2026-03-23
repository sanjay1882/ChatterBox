import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the main backend folder
dotenv.config({ path: path.join(__dirname, '..', 'api-service', '.env') });

const PROJECT_ID = 'trevit';
const REGION = 'us-central1';
const SERVICE_NAME = 'chatterbox-ai-engine';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not found in ../api-service/.env");
    process.exit(1);
}

try {
    console.log("\n1. Building and Submitting Image...");
    execSync(`gcloud builds submit . --tag "gcr.io/${PROJECT_ID}/${SERVICE_NAME}" --project "${PROJECT_ID}"`, { stdio: 'inherit' });

    let envVars = `NODE_ENV=production,GEMINI_API_KEY=${GEMINI_API_KEY}`;

    console.log("\n2. Deploying to Cloud Run with updated secrets...");
    execSync(`gcloud run deploy ${SERVICE_NAME} --image "gcr.io/${PROJECT_ID}/${SERVICE_NAME}" --platform managed --region "${REGION}" --project "${PROJECT_ID}" --update-env-vars="${envVars}" --allow-unauthenticated`, { stdio: 'inherit' });

    console.log("\n✅ Deployment Success!");
} catch (error) {
    console.error("\n❌ Deployment Failed:", error.message);
    process.exit(1);
}
