from agents.excel_agent import run_excel_agent
from agents.word_agent import run_word_agent
from agents.canva_agent import run_canva_agent
from agents.gmail_agent import run_gmail_agent
from agents.googledrive_agent import run_googledrive_agent
import json


async def route_agent(agent_name: str, prompt: str, context: dict):
    if agent_name == "excel":
        async for chunk in run_excel_agent(prompt, context):
            yield f"data: {json.dumps(chunk)}\n\n"

    elif agent_name == "word":
        async for chunk in run_word_agent(prompt, context):
            yield f"data: {json.dumps(chunk)}\n\n"

    elif agent_name == "canva":
        session_id = context.get("sessionId", "default")
        async for chunk in run_canva_agent(prompt, context, session_id):
            yield f"data: {json.dumps(chunk)}\n\n"

    elif agent_name == "gmail":
        async for chunk in run_gmail_agent(prompt, context):
            yield f"data: {json.dumps(chunk)}\n\n"

    elif agent_name in ("googledrive", "google_drive"):
        async for chunk in run_googledrive_agent(prompt, context):
            yield f"data: {json.dumps(chunk)}\n\n"

    else:
        yield f"data: {json.dumps({'error': f'Agent not found: {agent_name}'})}\n\n"
