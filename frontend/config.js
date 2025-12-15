const env = import.meta.env || {};

export const API_BASE_URL = env.VITE_BACKEND_URL || "http://localhost:3000";
