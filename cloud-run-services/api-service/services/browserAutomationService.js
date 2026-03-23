import fetch from "node-fetch";

const BROWSER_WORKER_URL = (process.env.BROWSER_WORKER_URL || "http://localhost:8082").replace(/\/$/, "");
const BROWSER_TASK_REQUEST_TIMEOUT_MS = Number(process.env.BROWSER_TASK_REQUEST_TIMEOUT_MS || 30000);

export async function runBrowserAutomationTask({ taskType, url = "", options = {}, sessionId = "" }) {
    if (!taskType) {
        throw new Error("taskType is required");
    }

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => {
        abortController.abort();
    }, BROWSER_TASK_REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${BROWSER_WORKER_URL}/task`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                taskType,
                url,
                options,
                sessionId
            }),
            signal: abortController.signal
        });

        const json = await response.json().catch(() => ({}));
        if (!response.ok || json.ok === false) {
            const message = json.error || `Browser worker failed with status ${response.status}`;
            throw new Error(message);
        }

        return json;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("Browser worker request timed out");
        }
        throw error;
    } finally {
        clearTimeout(timeoutHandle);
    }
}
