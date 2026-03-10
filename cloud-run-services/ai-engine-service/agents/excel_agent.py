import json
import re
from models.gemini_client import stream_gemini_response

async def run_excel_agent(user_prompt: str, context: dict):
    sheet_data = context.get("sheetData", [])
    sheet_str = json.dumps(sheet_data[:1000]) if sheet_data else ""
    
    prompt = f"""You are an expert Excel AI assistant.
Your task is to apply the user's instructions to the provided 2D array.

RESPONSE STRUCTURE:
1. Start your response with "EXPLANATION:" followed by a short friendly text explaining what you did.
2. Then write "JSON_DATA:" followed EXACTLY by a JSON object.

JSON OBJECT FORMAT:
{{
  "operation": "Clear Styles",
  "updatedData": [[...]],
  "cellStyles": {{
     "0-0": {{"backgroundColor": "yellow"}},
     "1-2": {{"color": "red"}}
  }}
}}

STRICT DATA RULES:
- updatedData must be the ENTIRE sheet data (2D array).
- cellStyles keys MUST be in "row-col" format (e.g., "5-2"). Do NOT use nested objects for row/col.
- Return ONLY the explanation and the JSON. No other text.

Input Sheet Data:
{sheet_str}

User Instruction: "{user_prompt}"
"""
    full_response = ""
    is_streaming_json = False
    
    # We will yield chunks formatted for Server Sent Events
    async for chunk in stream_gemini_response(prompt):
        full_response += chunk
        if "JSON_DATA:" in full_response or "{" in full_response:
            is_streaming_json = True
            
        if not is_streaming_json:
            clean_chunk = re.sub(r'EXPLANATION:?\s*', '', chunk, flags=re.IGNORECASE)
            if clean_chunk.strip():
                yield {"chunk": clean_chunk}
                
    # After stream finishes, try to parse JSON
    try:
        json_part = ""
        explanation_part = ""
        
        if "JSON_DATA:" in full_response:
            parts = re.split(r'JSON_DATA:?\s*', full_response, flags=re.IGNORECASE)
            explanation_part = re.sub(r'EXPLANATION:?\s*', '', parts[0], flags=re.IGNORECASE).strip()
            if len(parts) > 1:
                json_part = parts[1].strip()
        else:
            first_brace = full_response.find("{")
            if first_brace != -1:
                explanation_part = re.sub(r'EXPLANATION:?\s*', '', full_response[:first_brace], flags=re.IGNORECASE).strip()
                json_part = full_response[first_brace:].strip()

        if json_part:
            clean_json = re.sub(r'^```json\n?', '', json_part).replace('```', '').strip()
            parsed = json.loads(clean_json)
            yield {
                "fullMessage": explanation_part or parsed.get("message", ""),
                "updatedData": parsed.get("updatedData", []),
                "operation": parsed.get("operation", ""),
                "cellStyles": parsed.get("cellStyles", {}),
                "done": True
            }
        else:
            yield {"error": "AI failed to generate data update"}
    except Exception as e:
        yield {"error": f"JSON parse error: {str(e)}"}
