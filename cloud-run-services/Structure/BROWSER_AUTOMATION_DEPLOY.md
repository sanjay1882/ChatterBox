# Browser Automation Deployment (Cloud Run)

This project now includes a dedicated `browser-worker-service` for Playwright Chromium automation.

## Why this split

- `api-service`: chat auth + SSE + AI routing
- `browser-worker-service`: isolated browser automation runtime

This keeps your core chatbot stable and scales browser load independently.

## 1) Deploy browser worker

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/chatterbox-browser-worker ./cloud-run-services/browser-worker-service

gcloud run deploy chatterbox-browser-worker \
  --image gcr.io/PROJECT_ID/chatterbox-browser-worker \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --concurrency 2 \
  --max-instances 30 \
  --set-env-vars FRONTEND_URL=https://treevit.web.app,MAX_CONCURRENT_TASKS=2,TASK_TIMEOUT_MS=25000,NAV_TIMEOUT_MS=12000,CACHE_TTL_MS=180000,MAX_TEXT_CHARS=12000
```

## 2) Update API service env

Set the browser worker URL in `api-service` deployment:

```bash
BROWSER_WORKER_URL=https://chatterbox-browser-worker-xxxxx-uc.a.run.app
BROWSER_TASK_REQUEST_TIMEOUT_MS=30000
BROWSER_TASK_RATE_LIMIT_MAX=30
```

Then redeploy `api-service`.

## 3) New API endpoint

`POST /browser-task` (requires auth)

Request body:

```json
{
  "taskType": "extract_text",
  "url": "https://example.com",
  "options": {
    "maxTextChars": 5000
  },
  "email": "user@example.com",
  "sessionId": "optional"
}
```

Supported `taskType` values:

- `open`
- `extract_title`
- `extract_text`
- `summarize_content`
- `clean_html`
- `screenshot`

## 4) Security controls built in

- URL protocol allowlist: `http/https` only
- Blocks localhost, private/internal IP ranges
- Blocks unsafe sub-requests in page routing
- Per-user browser rate limiting in API service
- Task + navigation timeouts
- Single Chromium per worker instance; temporary context per task

## 5) Scaling notes

- Low cost start: `min instances = 0`
- Faster first response: `min instances = 1`
- For higher traffic, scale browser worker max instances while keeping API smaller.
