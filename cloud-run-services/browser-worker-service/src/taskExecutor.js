import sanitizeHtml from "sanitize-html";
import { validateAndResolveUrl, assertSafeSubrequest } from "./urlSafety.js";
import { UnsafeUrlError, ValidationError } from "./errors.js";

const CACHEABLE_TASKS = new Set(["extract_title", "extract_text", "clean_html", "summarize_content"]);
const URL_REQUIRED_TASKS = new Set(["open"]);
const SESSION_ONLY_TASKS = new Set(["click", "type", "scroll", "extract_products", "extract_stock", "get_state", "end_session"]);
const URL_OR_SESSION_TASKS = new Set(["extract_title", "extract_text", "clean_html", "summarize_content", "screenshot"]);
const routedPages = new WeakSet();

function normalizeWhitespace(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function summarizeText(text, maxLength = 1200) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;

  const truncated = normalized.slice(0, maxLength);
  const lastSentence = truncated.lastIndexOf(".");
  if (lastSentence > 200) {
    return `${truncated.slice(0, lastSentence + 1)} ...`;
  }

  return `${truncated} ...`;
}

function buildCacheKey(taskType, url, options, sessionId) {
  return JSON.stringify({
    taskType,
    url,
    selector: options?.selector || "",
    maxTextChars: options?.maxTextChars || "",
    sessionId: sessionId || "",
  });
}

async function withTimeout(promise, timeoutMs) {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Task timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function shouldCache(taskType, safeUrl, sessionId) {
  return !sessionId && !!safeUrl && CACHEABLE_TASKS.has(taskType);
}

export class TaskExecutor {
  constructor({ browserManager, cache, semaphore, taskTimeoutMs, navTimeoutMs, maxTextChars }) {
    this.browserManager = browserManager;
    this.cache = cache;
    this.semaphore = semaphore;
    this.taskTimeoutMs = taskTimeoutMs;
    this.navTimeoutMs = navTimeoutMs;
    this.maxTextChars = maxTextChars;
  }

  async execute(taskRequest) {
    const taskType = taskRequest?.taskType;
    const options = taskRequest?.options || {};
    const sessionId = String(taskRequest?.sessionId || options?.sessionId || "").trim();
    const rawUrl = typeof taskRequest?.url === "string" ? taskRequest.url.trim() : "";

    if (!taskType || typeof taskType !== "string") {
      throw new ValidationError("taskType is required");
    }

    if (taskType === "end_session") {
      if (!sessionId) {
        throw new ValidationError("sessionId is required for end_session");
      }
      await this.browserManager.closeSession(sessionId);
      return {
        taskType,
        sessionId,
        closed: true,
      };
    }

    if (SESSION_ONLY_TASKS.has(taskType) && !sessionId) {
      throw new ValidationError(`${taskType} requires sessionId`);
    }

    let safeUrl = "";
    if (rawUrl) {
      safeUrl = await validateAndResolveUrl(rawUrl);
    }

    if (URL_REQUIRED_TASKS.has(taskType) && !safeUrl) {
      throw new ValidationError(`${taskType} requires a valid url`);
    }

    if (URL_OR_SESSION_TASKS.has(taskType) && !safeUrl && !sessionId) {
      throw new ValidationError(`${taskType} requires a url or an active sessionId`);
    }

    const cacheKey = buildCacheKey(taskType, safeUrl, options, sessionId);

    if (shouldCache(taskType, safeUrl, sessionId)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    const result = await this.semaphore.use(() =>
      withTimeout(this.runTask(taskType, safeUrl, options, sessionId), this.taskTimeoutMs)
    );

    if (shouldCache(taskType, safeUrl, sessionId) && !result.error) {
      this.cache.set(cacheKey, result);
    }

    return { ...result, cached: false };
  }

  async ensureSafeRouting(page) {
    if (routedPages.has(page)) return;

    await page.route("**/*", (route) => {
      const requestUrl = route.request().url();
      if (!assertSafeSubrequest(requestUrl)) {
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });

    routedPages.add(page);
  }

  async runTask(taskType, safeUrl, options, sessionId) {
    const executeWithPage = async ({ page }) => {
      await this.ensureSafeRouting(page);

      const gotoOptions = {
        waitUntil: options.waitUntil || (taskType === "open" ? "commit" : "domcontentloaded"),
        timeout: options.navigationTimeoutMs || this.navTimeoutMs,
      };

      let gotoResponse = null;
      let navigationError = null;
      if (safeUrl) {
        try {
          gotoResponse = await page.goto(safeUrl, gotoOptions);
        } catch (error) {
          if (taskType !== "open") throw error;
          navigationError = error;
        }
      } else if (SESSION_ONLY_TASKS.has(taskType) || URL_OR_SESSION_TASKS.has(taskType)) {
        const existingUrl = page.url();
        if (!existingUrl || existingUrl === "about:blank") {
          throw new ValidationError("No active page in this session. Open a URL first.");
        }
      }

      const resolveMeta = async () => {
        const pageUrl = page.url() || safeUrl;
        const candidateUrl = pageUrl && pageUrl !== "about:blank" ? pageUrl : safeUrl;
        let finalUrl = safeUrl;

        if (candidateUrl) {
          finalUrl = await validateAndResolveUrl(candidateUrl).catch(() => safeUrl || "");
        }

        const title = await page.title().catch(() => options.title || "");
        return { finalUrl, title };
      };

      if (taskType === "open") {
        const { finalUrl, title } = await resolveMeta();
        const screenshotBytes = await page
          .screenshot({
            fullPage: false,
            type: "png",
          })
          .catch(() => null);

        return {
          taskType,
          sessionId,
          url: finalUrl,
          previewUrl: finalUrl,
          title,
          status: gotoResponse?.status?.() || null,
          screenshotBase64: screenshotBytes ? screenshotBytes.toString("base64") : "",
          navigationError: navigationError?.message || "",
        };
      }

      if (taskType === "click") {
        const actionTimeoutMs = Number(options.actionTimeoutMs || 8000);

        if (options.selector) {
          await page.locator(String(options.selector)).first().click({ timeout: actionTimeoutMs });
        } else if (options.text) {
          await page.getByText(String(options.text), { exact: Boolean(options.exactText) }).first().click({ timeout: actionTimeoutMs });
        } else if (typeof options.linkIndex === "number") {
          const links = page.locator("a[href]");
          const total = await links.count();
          const index = Math.max(0, Number(options.linkIndex));
          if (index >= total) {
            throw new ValidationError(`linkIndex ${index} is out of range`);
          }
          await links.nth(index).click({ timeout: actionTimeoutMs });
        } else {
          throw new ValidationError("click requires options.selector, options.text, or options.linkIndex");
        }

        await page.waitForLoadState("domcontentloaded", { timeout: options.navigationTimeoutMs || this.navTimeoutMs }).catch(() => {});

        const { finalUrl, title } = await resolveMeta();
        const screenshotBytes = await page.screenshot({ fullPage: false, type: "png" }).catch(() => null);

        return {
          taskType,
          sessionId,
          url: finalUrl,
          previewUrl: finalUrl,
          title,
          screenshotBase64: screenshotBytes ? screenshotBytes.toString("base64") : "",
        };
      }

      if (taskType === "type") {
        const selector = String(options.selector || "").trim();
        const value = String(options.text ?? "");

        if (!selector) {
          throw new ValidationError("type requires options.selector");
        }

        const actionTimeoutMs = Number(options.actionTimeoutMs || 8000);
        const target = page.locator(selector).first();

        if (options.clearFirst !== false) {
          await target.fill("", { timeout: actionTimeoutMs });
        }

        if (options.useFill) {
          await target.fill(value, { timeout: actionTimeoutMs });
        } else {
          await target.type(value, {
            delay: Number(options.delayMs || 20),
            timeout: actionTimeoutMs,
          });
        }

        if (options.pressEnter) {
          await target.press("Enter", { timeout: actionTimeoutMs }).catch(() => {});
          await page.waitForLoadState("domcontentloaded", { timeout: options.navigationTimeoutMs || this.navTimeoutMs }).catch(() => {});
        }

        const { finalUrl, title } = await resolveMeta();
        const screenshotBytes = await page.screenshot({ fullPage: false, type: "png" }).catch(() => null);

        return {
          taskType,
          sessionId,
          url: finalUrl,
          previewUrl: finalUrl,
          title,
          screenshotBase64: screenshotBytes ? screenshotBytes.toString("base64") : "",
        };
      }

      if (taskType === "scroll") {
        const direction = String(options.direction || "down").toLowerCase() === "up" ? -1 : 1;
        const amount = Math.max(120, Number(options.amount || 900));

        await page.evaluate((pixels) => {
          window.scrollBy(0, pixels);
        }, direction * amount);

        if (Number(options.waitAfterMs || 0) > 0) {
          await page.waitForTimeout(Number(options.waitAfterMs));
        }

        const { finalUrl, title } = await resolveMeta();
        const screenshotBytes = await page.screenshot({ fullPage: false, type: "png" }).catch(() => null);

        return {
          taskType,
          sessionId,
          url: finalUrl,
          previewUrl: finalUrl,
          title,
          screenshotBase64: screenshotBytes ? screenshotBytes.toString("base64") : "",
        };
      }

      if (taskType === "extract_products") {
        const productLimit = Math.max(1, Math.min(20, Number(options.limit || 8)));
        const products = await page.evaluate((limit) => {
          const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
          const toAbsolute = (href) => {
            try {
              return new URL(href, window.location.href).href;
            } catch {
              return "";
            }
          };

          const seen = new Set();
          const output = [];
          const anchors = Array.from(document.querySelectorAll("a[href]"));

          for (const anchor of anchors) {
            const href = toAbsolute(anchor.getAttribute("href") || anchor.href || "");
            if (!href || href.startsWith("javascript:")) continue;

            const title = normalize(anchor.textContent || "");
            if (title.length < 12 || title.length > 240) continue;

            const card = anchor.closest("article, li, div, section") || anchor.parentElement;
            const cardText = normalize(card?.innerText || title);
            const priceMatch = cardText.match(/(?:₹|Rs\.?|\$|€|£)\s?[\d,]+(?:\.\d{1,2})?/i);

            const score = (priceMatch ? 2 : 0) + (title.length > 25 ? 1 : 0);
            if (score < 1) continue;

            const dedupeKey = href.split("#")[0];
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);

            output.push({
              title: title.slice(0, 180),
              price: priceMatch ? priceMatch[0] : "",
              url: dedupeKey,
              snippet: cardText.slice(0, 220),
            });

            if (output.length >= limit) break;
          }

          return output;
        }, productLimit);

        const { finalUrl, title } = await resolveMeta();
        const screenshotBytes = await page.screenshot({ fullPage: false, type: "png" }).catch(() => null);

        return {
          taskType,
          sessionId,
          url: finalUrl,
          previewUrl: finalUrl,
          title,
          products: products.map((item, index) => ({ ...item, index: index + 1 })),
          screenshotBase64: screenshotBytes ? screenshotBytes.toString("base64") : "",
        };
      }

      if (taskType === "extract_stock") {
        const stockData = await page.evaluate(() => {
          const fullText = document.body?.innerText || "";
          const lines = fullText
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);

          const stockRegex = /(in stock|out of stock|sold out|only\s+\d+\s+left|available|unavailable|delivery|ships by)/i;
          const matches = [];
          for (const line of lines) {
            if (stockRegex.test(line)) {
              matches.push(line);
            }
            if (matches.length >= 10) break;
          }

          const lower = fullText.toLowerCase();
          return {
            matches,
            hasInStock: /in stock|available now|available/.test(lower),
            hasOutOfStock: /out of stock|sold out|unavailable/.test(lower),
          };
        });

        const { finalUrl, title } = await resolveMeta();
        const screenshotBytes = await page.screenshot({ fullPage: false, type: "png" }).catch(() => null);

        return {
          taskType,
          sessionId,
          url: finalUrl,
          previewUrl: finalUrl,
          title,
          stock: stockData,
          screenshotBase64: screenshotBytes ? screenshotBytes.toString("base64") : "",
        };
      }

      if (taskType === "get_state") {
        const previewText = await page
          .evaluate(() => {
            return (document.body?.innerText || "").slice(0, 1200);
          })
          .catch(() => "");

        const { finalUrl, title } = await resolveMeta();
        const screenshotBytes = await page.screenshot({ fullPage: false, type: "png" }).catch(() => null);

        return {
          taskType,
          sessionId,
          url: finalUrl,
          previewUrl: finalUrl,
          title,
          text: normalizeWhitespace(previewText),
          screenshotBase64: screenshotBytes ? screenshotBytes.toString("base64") : "",
        };
      }

      if (taskType === "extract_title") {
        const { finalUrl, title } = await resolveMeta();
        return {
          taskType,
          url: finalUrl,
          title,
        };
      }

      const maxTextChars = Number(options.maxTextChars || this.maxTextChars);

      if (taskType === "extract_text" || taskType === "summarize_content") {
        const rawText = await page.evaluate((selector) => {
          const source = selector ? document.querySelector(selector) : document.body;
          return source?.innerText || "";
        }, options.selector || null);

        const text = normalizeWhitespace(rawText).slice(0, maxTextChars);
        const { finalUrl, title } = await resolveMeta();

        if (taskType === "summarize_content") {
          return {
            taskType,
            url: finalUrl,
            title,
            summary: summarizeText(text),
            text,
          };
        }

        return {
          taskType,
          url: finalUrl,
          title,
          text,
        };
      }

      if (taskType === "clean_html") {
        const rawHtml = await page.evaluate((selector) => {
          const source = selector ? document.querySelector(selector) : document.body;
          if (!source) return "";
          const cloned = source.cloneNode(true);
          cloned.querySelectorAll("script,style,noscript,iframe,object,embed,svg").forEach((node) => node.remove());
          return cloned.innerHTML;
        }, options.selector || null);

        const cleanHtml = sanitizeHtml(rawHtml, {
          allowedTags: [
            "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "ul", "ol", "li", "blockquote", "code", "pre", "strong", "em", "b", "i", "table", "thead", "tbody", "tr", "th", "td", "span", "div", "br",
          ],
          allowedAttributes: {
            a: ["href", "target", "rel"],
            "*": ["class"],
          },
          allowedSchemes: ["http", "https"],
          transformTags: {
            a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
          },
        });

        const { finalUrl, title } = await resolveMeta();
        return {
          taskType,
          url: finalUrl,
          title,
          cleanHtml,
        };
      }

      if (taskType === "screenshot") {
        const screenshotBytes = await page.screenshot({
          fullPage: options.fullPage !== false,
          type: "png",
        });

        const { finalUrl, title } = await resolveMeta();
        return {
          taskType,
          url: finalUrl,
          title,
          screenshotBase64: screenshotBytes.toString("base64"),
        };
      }

      throw new ValidationError(`Unsupported taskType: ${taskType}`);
    };

    try {
      if (sessionId) {
        return await this.browserManager.withSession(sessionId, executeWithPage);
      }
      return await this.browserManager.withContext(executeWithPage);
    } catch (error) {
      if (error instanceof UnsafeUrlError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Browser task failed: ${error.message}`);
    }
  }
}