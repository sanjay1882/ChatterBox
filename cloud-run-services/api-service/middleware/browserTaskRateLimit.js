import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export const browserTaskLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: Number(process.env.BROWSER_TASK_RATE_LIMIT_MAX || 30),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.email || ipKeyGenerator(req.ip),
    message: { error: "Too many browser tasks. Please wait and retry." }
});
