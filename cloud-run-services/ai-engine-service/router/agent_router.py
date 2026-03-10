from agents.excel_agent import run_excel_agent
from agents.word_agent import run_word_agent
import json

async def route_agent(agent_name: str, prompt: str, context: dict):
    if agent_name == "excel":
        async for chunk in run_excel_agent(prompt, context):
            yield f"data: {json.dumps(chunk)}\n\n"

    elif agent_name == "word":
        async for chunk in run_word_agent(prompt, context):
            yield f"data: {json.dumps(chunk)}\n\n"

    else:
        yield f"data: {json.dumps({'error': f'Agent not found: {agent_name}'})}\n\n"