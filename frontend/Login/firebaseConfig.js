const env = import.meta.env || {};

if (!import.meta.env) {
    alert("CRITICAL ERROR: You are not running the app with Vite.\n\nPlease run 'npm run dev' in your terminal and open the URL shown there (e.g., http://localhost:5173).");
}

export const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
};
