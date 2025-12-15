const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from the Python scripts folder (where the working keys are)
const envConfig = dotenv.config({ path: path.join(__dirname, 'Python-scripts', '.env') });

if (envConfig.error) {
    console.error("Error loading .env file:", envConfig.error);
    process.exit(1);
}

const PROJECT_ID = process.argv[2] || 'chatterbox-chatbot';
const REGION = 'us-central1'; // Default, change if needed
const SERVICE_NAME = 'chatterbox-backend';

const API_KEY = process.env.API_KEY_SE;
const CX_ID = process.env.CX_ID || process.env.CX;

if (!API_KEY || !CX_ID) {
    console.error("Error: API_KEY_SE or CX_ID not found in backend/Python-scripts/.env");
    process.exit(1);
}

console.log(`Deploying to Project: ${PROJECT_ID}`);
console.log(`Region: ${REGION}`);
console.log(`Service: ${SERVICE_NAME}`);
console.log("Found Secrets: API_KEY_SE, CX_ID");

try {
    // 1. Build and Submit
    console.log("\n1. Building and Submitting Image...");
    execSync(`gcloud builds submit . --tag "gcr.io/${PROJECT_ID}/${SERVICE_NAME}" --project "${PROJECT_ID}"`, { stdio: 'inherit' });

    // 2. Deploy with Env Vars
    const envVars = `API_KEY_SE=${API_KEY},CX_ID=${CX_ID},NODE_ENV=production`;

    console.log("\n2. Deploying to Cloud Run with updated secrets...");
    execSync(`gcloud run deploy ${SERVICE_NAME} --image "gcr.io/${PROJECT_ID}/${SERVICE_NAME}" --platform managed --region "${REGION}" --project "${PROJECT_ID}" --update-env-vars="${envVars}" --allow-unauthenticated`, { stdio: 'inherit' });

    console.log("\n✅ Deployment Success!");

} catch (error) {
    console.error("\n❌ Deployment Failed:", error.message);
    process.exit(1);
}
