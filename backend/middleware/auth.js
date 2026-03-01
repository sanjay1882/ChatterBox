import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin (only if credentials are provided)
// Ideally, use GOOGLE_APPLICATION_CREDENTIALS env var for auto-discovery
if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("Firebase Admin Initialized with Service Account");
        } else {
            // Explicitly set projectId to avoid metadata service lookup on localhost
            const projectId = process.env.FIREBASE_PROJECT_ID || 'treevit';
            admin.initializeApp({ projectId });
            console.log(`Firebase Admin Initialized (Project ID: ${projectId})`);
        }
    } catch (error) {
        console.warn("Firebase Admin initialization failed. Auth verification will be skipped/mocked.", error.message);
    }
}

export const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (req.headers['x-guest-mode'] === 'true') {
        req.user = { email: 'guest', uid: 'guest' };
        return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // For development/transition ease, we might log a warning or fail.
        // Given the prompt "security features", we should strictly enforce, 
        // BUT the user hasn't provided secrets yet. 
        // We will fail securely but log a clear message for the developer.
        return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(' ')[1];

    try {
        if (admin.apps.length) {
            const decodedToken = await admin.auth().verifyIdToken(token);
            req.user = decodedToken;
            next();
        } else {
            // Fallback for when Firebase isn't configured yet
            console.warn("WARNING: Firebase Admin not initialized. Cannot verify token.");
            return res.status(500).json({ error: "Server Configuration Error", details: "Firebase Admin not initialized. Check server logs." });
        }
    } catch (error) {
        console.error("Token verification failed:", error);
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
};
