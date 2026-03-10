# How to Create a New Agent

When you want to create a new Agent (like the `Excel Agent` or `Word Agent`) in this architecture, you need to add or update files across all three layers of the stack: **Frontend**, **API Server**, and the **Python AI Engine**. 

Here is the exact checklist of files you need to update to wire up a new agent end-to-end:

### 1. Frontend Service (React)
This is where the user interface and API calls live.

*   **Create the Agent Component:** `frontend-service/src/components/[NewAgentName]/[NewAgentName].jsx`
    *   *What to do:* Build your UI component. Use `useState` for chat parsing context and implement a `sendMessage` function that handles streaming text and data updates.
*   **Register the Agent:** `frontend-service/src/config/agents.jsx`
    *   *What to do:* Add an object to the `AGENTS` array. Define the `id`, `name`, `icon`, and point the `component` property to your new `.jsx` component. This automatically adds it to the sidebar/apps menu.
*   **Add Frontend API wrapper:** `frontend-service/src/services/api.js`
    *   *What to do:* Add an API function (e.g. `myAgentStream`) that calls `fetch()` to your Node server endpoint and handles the server-sent events (SSE) reader logic.
*   **[Optional] Update ChatApp.jsx:** `frontend-service/src/components/Chat/ChatApp.jsx`
    *   *What to do:* If your agent requires the user to pass a file to it upon uploading, add your agent mode to the `initialFile` check inside the `<AgentComp />` render block.

### 2. API Service (Node/Express)
This is your middleware that proxies the request to the Python AI Engine and manages authorization.

*   **Create the Controller:** `api-service/controllers/agentController.js`
    *   *What to do:* Create an exported stream callback (e.g., `export const myAgentStream = async (req, res) => ...`). This verifies auth and uses Node's `fetch()` to POST to the Python AI Engine, safely piping the responses back to the frontend.
*   **Add the Route:** `api-service/routes/agentRoutes.js`
    *   *What to do:* Import your new controller and create a new POST endpoint path for the frontend to hit (e.g., `router.post("/my-agent", verifyToken, myAgentStream);`).

### 3. AI Engine Service (Python/FastAPI)
This is where the direct interaction with Gemini happens.

*   **Create the Agent Logic file:** `ai-engine-service/agents/[new_agent].py`
    *   *What to do:* Create a Python function (e.g., `async def run_my_agent(user_prompt: str, context: dict):`). Define the prompt and use `stream_gemini_response` to yield real-time JSON text chunks.
*   **Update the Router:** `ai-engine-service/router/agent_router.py`
    *   *What to do:* Import your new agent function and add an `elif agent_name == "my_agent":` block inside `route_agent` to yield the chunks formatted for Server Sent Events (`data: {...}\n\n`).

### Summary Tip:
To create a new agent reliably, it's easiest to **copy** an existing flow (like the new `Word Agent`) from bottom to top:
1. Make the **Python logic script** & add it to the **Python Router**.
2. Make the **Node controller** & add the **Express route**.
3. Make the **React `<Component />`**, write the `api.js` fetch method, and register it in `agents.jsx`.
