const env = import.meta.env || {};

export const API_BASE_URL = import.meta.env.PROD
    ? "https://chatterbox-backend-3tlejwqmcq-uc.a.run.app"
    : "http://localhost:3000";
