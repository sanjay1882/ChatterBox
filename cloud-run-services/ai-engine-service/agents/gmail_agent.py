import json
import re
import httpx
import asyncio
from typing import List, Dict, Optional, Any

# Assuming these are your local imports
from models.gemini_client import stream_gemini_response
from utils.persona import get_persona_prompt

async def fetch_message_detail(client: httpx.AsyncClient, access_token: str, message_id: str) -> Optional[Dict[str, Any]]:
    """Fetches a single email's details. Designed to run concurrently."""
    try:
        res = await client.get(
            f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"format": "minimal"}
        )
        if res.status_code == 200:
            data = res.json()
            headers = data.get('payload', {}).get('headers', [])
            
            # Fast generator expressions to find specific headers
            subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'No Subject')
            sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), 'Unknown Sender')
            
            return {
                "id": data.get("id"),
                "threadId": data.get("threadId"),
                "from": sender,
                "subject": subject,
                "snippet": data.get("snippet", ""),
            }
    except Exception as e:
        print(f"Failed to fetch message {message_id}: {e}")
    return None

def build_gmail_query(user_prompt: str) -> str:
    """Translates natural language into advanced Gmail search operators."""
    prompt = user_prompt.lower()
    query_parts = []

    # Map statuses
    if "unread" in prompt: 
        query_parts.append("is:unread")
    elif "read" in prompt and "unread" not in prompt: 
        query_parts.append("is:read")
    
    # Map attachments
    if "attachment" in prompt or "file" in prompt: 
        query_parts.append("has:attachment")

    # Map sender (Basic regex to catch names or emails after "from")
    from_match = re.search(r'from\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z]+)', prompt)
    if from_match: 
        query_parts.append(f"from:{from_match.group(1)}")

    # Fallback: if no specific operators, use the core intent as a broad search
    if not query_parts:
        clean_search = re.sub(r'^(search|find|get|show me)\s*(for|about|emails|messages)?\s*', '', prompt, flags=re.IGNORECASE).strip()
        if clean_search: 
            query_parts.append(clean_search)

    return " ".join(query_parts)

async def fetch_gmail_messages(access_token: str, query: str = None, max_results: int = 15) -> List[Dict[str, Any]]:
    """Fetches email IDs and uses asyncio.gather to fetch details in parallel."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            params = {"maxResults": max_results}
            if query:
                params["q"] = query
                
            response = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                headers={"Authorization": f"Bearer {access_token}"},
                params=params
            )
            
            if response.status_code == 200:
                msgs = response.json().get("messages", [])
                if not msgs:
                    return []
                
                # Execute all individual message requests simultaneously
                tasks = [fetch_message_detail(client, access_token, m['id']) for m in msgs[:max_results]]
                full_msgs = await asyncio.gather(*tasks)
                
                # Filter out failures (where fetch_message_detail returned None)
                return [msg for msg in full_msgs if msg is not None]
                
            return []
    except Exception as e:
        print(f"Error fetching gmail messages: {e}")
        return []

async def run_gmail_agent(user_prompt: str, context: dict):
    persona = get_persona_prompt(context)
    access_token = context.get("googleAccessToken")
    emails_content = []
    
    if access_token:
        search_query = build_gmail_query(user_prompt)
        print(f"[Agent] Translating intent to query: '{search_query}'")
        emails_content = await fetch_gmail_messages(access_token, query=search_query)
    
    emails_str = json.dumps(emails_content) if emails_content else "[]"
    
    prompt = f"""{persona}You are an expert, highly accurate Gmail AI assistant.
Your task is to analyze the user's intent and return the matching email data provided.

CRITICAL INSTRUCTIONS:
1. Start with "EXPLANATION:" followed by a concise, friendly summary of the action.
2. Then write "JSON_DATA:" followed EXACTLY by a valid JSON object. 

JSON OBJECT FORMAT:
{{
  "operation": "Search/List Emails",
  "actions": [
    {{
      "type": "search",
      "results": {emails_str}
    }}
  ],
  "message": "<Brief summary message for the UI>"
}}

RULES:
- Do NOT wrap the JSON in markdown code blocks (e.g., no ```json).
- If `results` is empty, explain politely that no matching emails were found.

Context (Emails Found):
{emails_str}

User Instruction: "{user_prompt}"
"""
    full_response = ""
    is_streaming_json = False
    
    async for chunk in stream_gemini_response(prompt):
        full_response += chunk
        
        # Detect the pivot from explanation to JSON payload
        if "JSON_DATA:" in full_response or (not is_streaming_json and "{" in full_response and "EXPLANATION:" in full_response):
            is_streaming_json = True
            
        if not is_streaming_json:
            # Stream out the conversational text cleanly
            clean_chunk = re.sub(r'EXPLANATION:?\s*', '', chunk, flags=re.IGNORECASE)
            if clean_chunk.strip():
                yield {"chunk": clean_chunk}
                
    # Post-process the fully compiled stream
    try:
        json_part = ""
        explanation_part = ""
        
        # Split the string using our explicit delimiters
        if "JSON_DATA:" in full_response:
            parts = re.split(r'JSON_DATA:?\s*', full_response, flags=re.IGNORECASE, maxsplit=1)
            explanation_part = re.sub(r'EXPLANATION:?\s*', '', parts[0], flags=re.IGNORECASE).strip()
            if len(parts) > 1:
                json_part = parts[1].strip()
        else:
            # Fallback if the LLM forgot the "JSON_DATA:" tag
            first_brace = full_response.find("{")
            if first_brace != -1:
                explanation_part = re.sub(r'EXPLANATION:?\s*', '', full_response[:first_brace], flags=re.IGNORECASE).strip()
                json_part = full_response[first_brace:].strip()

        if json_part:
           
            clean_json = re.sub(r'^```json\n?', '', json_part).replace('```', '').strip()
            parsed = json.loads(clean_json)
            yield {
                "fullMessage": explanation_part or parsed.get("message", ""),
                "actions": parsed.get("actions", []),
                "operation": parsed.get("operation", ""),
                "done": True
            }
        else:
            yield {"error": "AI failed to generate Gmail actions", "done": True}
    except Exception as e:
        yield {"error": f"JSON parse error: {str(e)}", "done": True}
