import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { BrowserManager } from "./src/browserManager.js";
import { TtlCache } from "./src/cache.js";
import { ValidationError, UnsafeUrlError } from "./src/errors.js";
import { Semaphore } from "./src/semaphore.js";
import { TaskExecutor } from "./src/taskExecutor.js";

dotenv.config();

const PORT = Number(process.env.PORT || 8080);
const MAX_CONCURRENT_TASKS = Number(process.env.MAX_CONCURRENT_TASKS || 2);
const TASK_TIMEOUT_MS = Number(process.env.TASK_TIMEOUT_MS || 25000);
const NAV_TIMEOUT_MS = Number(process.env.NAV_TIMEOUT_MS || 12000);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 180000);
const MAX_TEXT_CHARS = Number(process.env.MAX_TEXT_CHARS || 12000);

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "1mb" }));

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:8081",
  "treevit.in"
];

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const configuredOrigin = (process.env.FRONTEND_URL || "").trim();
    const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const allowed = defaultAllowedOrigins.includes(origin) || origin === configuredOrigin || extraOrigins.includes(origin);
    if (allowed) return callback(null, true);
    return callback(new Error("Origin is not allowed"));
  },
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.BROWSER_WORKER_RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
}));

const browserManager = new BrowserManager();
const cache = new TtlCache(CACHE_TTL_MS);
const semaphore = new Semaphore(MAX_CONCURRENT_TASKS);
const taskExecutor = new TaskExecutor({
  browserManager,
  cache,
  semaphore,
  taskTimeoutMs: TASK_TIMEOUT_MS,
  navTimeoutMs: NAV_TIMEOUT_MS,
  maxTextChars: MAX_TEXT_CHARS,
});

setInterval(() => {
  cache.cleanup();
  browserManager.cleanupSessions().catch(() => {});
}, 60_000).unref();

app.get("/health/live", (_, res) => {
  res.json({ ok: true });
});

app.get("/health/ready", async (_, res) => {
  try {
    await browserManager.getBrowser();
    res.json({ ok: true, chromium: "ready" });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.post("/task", async (req, res) => {
  const startedAt = Date.now();

  try {
    const result = await taskExecutor.execute(req.body || {});
    res.json({
      ok: true,
      ...result,
      timingMs: Date.now() - startedAt,
    });
  } catch (error) {
    const statusCode = error instanceof ValidationError || error instanceof UnsafeUrlError ? 400 : 500;

    res.status(statusCode).json({
      ok: false,
      error: error.message || "Task failed",
      timingMs: Date.now() - startedAt,
    });
  }
});

app.listen(PORT, () => {
  console.log(`[browser-worker] listening on ${PORT}`);
  console.log(`[browser-worker] MAX_CONCURRENT_TASKS=${MAX_CONCURRENT_TASKS} TASK_TIMEOUT_MS=${TASK_TIMEOUT_MS} NAV_TIMEOUT_MS=${NAV_TIMEOUT_MS}`);
});
