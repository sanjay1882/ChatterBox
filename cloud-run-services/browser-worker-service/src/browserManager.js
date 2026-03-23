import { chromium } from "playwright";

export class BrowserManager {
  constructor() {
    this.browser = null;
    this.launchingPromise = null;
    this.sessions = new Map();
    this.sessionTtlMs = Number(process.env.BROWSER_SESSION_TTL_MS || 10 * 60 * 1000);
    this.maxSessions = Number(process.env.BROWSER_MAX_SESSIONS || 25);
  }

  async getBrowser() {
    if (this.browser) return this.browser;
    if (this.launchingPromise) return this.launchingPromise;

    this.launchingPromise = chromium
      .launch({
        headless: true,
        args: ["--disable-dev-shm-usage"],
      })
      .then((browser) => {
        browser.on("disconnected", () => {
          console.error("[browser-worker] Chromium disconnected. It will be relaunched on next request.");
          this.browser = null;
          this.closeAllSessions().catch(() => {});
        });
        this.browser = browser;
        return browser;
      })
      .finally(() => {
        this.launchingPromise = null;
      });

    return this.launchingPromise;
  }

  async createContextPage() {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      javaScriptEnabled: true,
      ignoreHTTPSErrors: false,
    });

    const page = await context.newPage();
    return { context, page };
  }

  async withContext(handler) {
    const { context, page } = await this.createContextPage();

    try {
      return await handler({ context, page, persistent: false, sessionId: "" });
    } finally {
      await context.close().catch(() => {});
    }
  }

  async getOrCreateSession(sessionId) {
    if (!sessionId) {
      throw new Error("sessionId is required for persistent browser session");
    }

    await this.cleanupSessions();

    const existing = this.sessions.get(sessionId);
    if (existing && !existing.closed) {
      existing.touchedAt = Date.now();
      return existing;
    }

    const { context, page } = await this.createContextPage();
    const session = {
      context,
      page,
      touchedAt: Date.now(),
      closed: false,
    };

    const cleanupSession = () => {
      session.closed = true;
      this.sessions.delete(sessionId);
    };

    page.on("close", cleanupSession);
    context.on("close", cleanupSession);

    this.sessions.set(sessionId, session);
    await this.enforceSessionLimit();

    return session;
  }

  async withSession(sessionId, handler) {
    const session = await this.getOrCreateSession(sessionId);
    session.touchedAt = Date.now();

    try {
      return await handler({
        context: session.context,
        page: session.page,
        persistent: true,
        sessionId,
      });
    } finally {
      session.touchedAt = Date.now();
    }
  }

  async enforceSessionLimit() {
    if (this.sessions.size <= this.maxSessions) return;

    const ordered = [...this.sessions.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt);
    while (this.sessions.size > this.maxSessions && ordered.length > 0) {
      const [oldSessionId] = ordered.shift();
      await this.closeSession(oldSessionId);
    }
  }

  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.sessions.delete(sessionId);
    session.closed = true;
    await session.context.close().catch(() => {});
  }

  async cleanupSessions() {
    const now = Date.now();
    const staleIds = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.closed || now - session.touchedAt > this.sessionTtlMs) {
        staleIds.push(sessionId);
      }
    }

    for (const staleId of staleIds) {
      await this.closeSession(staleId);
    }
  }

  async closeAllSessions() {
    const ids = [...this.sessions.keys()];
    for (const id of ids) {
      await this.closeSession(id);
    }
  }
}
