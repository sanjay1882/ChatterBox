import json
import re
from models.gemini_client import stream_gemini_response


async def run_word_agent(user_prompt: str, context: dict):
    doc_content = context.get("docContent", "")
    file_name   = context.get("fileName", "document.txt")

    # Truncate very large docs to avoid token limits (keep ~8000 chars)
    doc_preview = doc_content[:8000] if doc_content else ""

    prompt = f"""You are an expert writing assistant and document editor.
Your task is to apply the user's instruction to the provided document text.

RESPONSE STRUCTURE:
1. Start your response with "EXPLANATION:" followed by a short, friendly sentence explaining what you did.
2. Then write "JSON_DATA:" followed EXACTLY by a JSON object.

JSON OBJECT FORMAT:
{{
  "operation": "Fix Grammar",
  "updatedDoc": "<p>...the full updated document HTML...</p>",
  "changedLines": [0, 3, 7],
  "summary": "Fixed 4 grammar issues and improved sentence flow."
}}

FIELD RULES:
- "operation"    : A short label for the action performed (e.g. "Summarize", "Fix Grammar", "Rewrite", "Add Section").
- "updatedDoc"   : The COMPLETE updated document text as a single string formatted in clean, standard HTML (e.g., <p>, <h1>, <h2>, <ul>, <li>, <strong>, <em>).
                   ALWAYS return the full document — never truncate or omit unchanged sections. Preserve formatting.
- "changedLines" : A JSON array of 0-based indices mapping directly to the sections that changed (optional).
                   Use an empty array [] if the whole document changed or if lines are not applicable.
- "summary"      : One sentence describing the changes made.

STRICT RULES:
- Return ONLY the explanation and the JSON. No other text, no markdown fences around the outer response.
- The "updatedDoc" value must be valid JSON string containing HTML, escaping quotes properly. Do NOT use markdown for the document content. Use HTML tags for structure and emphasis.
- If the user asks to summarize or create something new, put the NEW content in "updatedDoc".
- Do NOT wrap the JSON in ```json``` fences.

Current Document: "{file_name}"
---
{doc_preview}
---

User Instruction: "{user_prompt}"
"""

    full_response      = ""
    is_streaming_json  = False

    # Stream explanation text chunk by chunk (same pattern as excel_agent)
    async for chunk in stream_gemini_response(prompt):
        full_response += chunk

        if "JSON_DATA:" in full_response or "{" in full_response:
            is_streaming_json = True

        if not is_streaming_json:
            clean_chunk = re.sub(r'EXPLANATION:?\s*', '', chunk, flags=re.IGNORECASE)
            if clean_chunk.strip():
                yield {"chunk": clean_chunk}

    # ── After stream: parse the structured JSON block ──────────────────────────
    try:
        json_part        = ""
        explanation_part = ""

        if "JSON_DATA:" in full_response:
            parts = re.split(r'JSON_DATA:?\s*', full_response, flags=re.IGNORECASE)
            explanation_part = re.sub(
                r'EXPLANATION:?\s*', '', parts[0], flags=re.IGNORECASE
            ).strip()
            if len(parts) > 1:
                json_part = parts[1].strip()
        else:
            # Fallback: find the first { if the model skipped the JSON_DATA: label
            first_brace = full_response.find("{")
            if first_brace != -1:
                explanation_part = re.sub(
                    r'EXPLANATION:?\s*', '', full_response[:first_brace], flags=re.IGNORECASE
                ).strip()
                json_part = full_response[first_brace:].strip()

        if json_part:
            # Strip accidental markdown fences the model might add inside
            clean_json = re.sub(r'^```json\n?', '', json_part).replace('```', '').strip()
            parsed = json.loads(clean_json)

            yield {
                "fullMessage": explanation_part or parsed.get("summary", ""),
                "updatedDoc":  parsed.get("updatedDoc", doc_content),
                "operation":   parsed.get("operation", "Edit"),
                "changedLines": parsed.get("changedLines", []),
                "summary":     parsed.get("summary", ""),
                "done":        True,
            }
        else:
            yield {"error": "AI failed to generate a document update", "done": True}

    except json.JSONDecodeError as e:
        yield {"error": f"JSON parse error: {str(e)}", "done": True}
    except Exception as e:
        yield {"error": f"Unexpected error: {str(e)}", "done": True}
