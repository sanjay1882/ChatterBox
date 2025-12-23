const env = import.meta.env || {};

export const API_BASE_URL = import.meta.env.PROD
    ? "https://chatterbox-backend-105267983616.us-central1.run.app"
    : "http://localhost:3000";
