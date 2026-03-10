from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from router.agent_router import route_agent

app = FastAPI()

@app.post("/run-agent")
async def run_agent(request: Request):
    data = await request.json()
    agent_name = data.get("agent")
    user_prompt = data.get("prompt")
    context_data = data.get("context", {})
    
    # Route to the appropriate agent and stream response
    return StreamingResponse(
        route_agent(agent_name, user_prompt, context_data), 
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
