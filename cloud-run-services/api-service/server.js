import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from "helmet";

import { limiter } from "./middleware/rateLimit.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import creditsRoutes from "./routes/creditsRoutes.js";

dotenv.config();

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(limiter);

// CORS Configuration
const defaultAllowedOrigins = [
    "https://treevit.web.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://localhost:8081"
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || origin === 'null') {
            return callback(null, true);
        }

        let frontendUrl = process.env.FRONTEND_URL || "";
        if (frontendUrl.endsWith('/')) frontendUrl = frontendUrl.slice(0, -1);

        let extraOrigins = [];
        if (process.env.ALLOWED_ORIGINS) {
            extraOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, ""));
        }

        const isAllowed = defaultAllowedOrigins.includes(origin) ||
            (frontendUrl && origin === frontendUrl) ||
            extraOrigins.includes(origin) ||
            origin.endsWith('.web.app') ||
            origin.endsWith('.firebaseapp.com') ||
            origin.endsWith('.vercel.app') ||
            origin.endsWith('.netlify.app');

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn("Blocked by secured CORS policy - Origin:", origin);
            // We return the error so unauthorized cross-origin requests are rejected
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Allow cookies and authorization headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Capture raw body for Stripe webhook signature verification
app.use((req, res, next) => {
    if (req.headers['stripe-signature']) {
        let data = '';
        req.setEncoding('utf8');
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => { req.rawBody = data; next(); });
    } else {
        next();
    }
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use((req, res, next) => {
    console.log(`Incoming ${req.method} ${req.path}`);
    console.log(`Origin: ${req.headers.origin}`);
    next();
});

app.get("/", (req, res) => {
    res.send("Chatterbox API Gateway is Running!");
});

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/chatterbox", {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
}).then(() => console.log("MongoDB Connected"))
    .catch(err => console.error("MongoDB Connection Error:", err.message));

if (!process.env.GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is missing in environment variables. Gemini features will fail.");
}

// Mount routes
app.use("/session", sessionRoutes);
app.use("/sessions", sessionRoutes);
app.use("/user", userRoutes);
app.use("/credits", creditsRoutes);

// Direct root routes for backwards compatibility
app.use("/", chatRoutes);
app.use("/", agentRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});
