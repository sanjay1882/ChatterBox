"""
googledrive_agent.py
Full-featured Google Drive AI agent with:
- Persistent conversation history passed from frontend
- Deep recursive file search (name + full-text + folder traversal)
- All Drive API tools properly implemented
- LLM sees full chat history so it understands context
"""

import json
import re
import httpx
from models.gemini_client import stream_gemini_response
from utils.persona import get_persona_prompt

# ─────────────────────────────────────────────────────────────
#  Drive API Helpers
# ─────────────────────────────────────────────────────────────

BASE        = "https://www.googleapis.com/drive/v3"
UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"

def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Listing & Search ──────────────────────────────────────────

async def drive_list(token: str, query: str = None, page_size: int = 100) -> list:
    """List files with optional Drive query string."""
    params = {
        "pageSize": page_size,
        "fields":   "files(id,name,mimeType,size,modifiedTime,parents,webViewLink,starred,trashed,owners)",
        "orderBy":  "modifiedTime desc",
        "q":        query or "trashed=false",
    }
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{BASE}/files", headers=_auth(token), params=params)
        return r.json().get("files", []) if r.status_code == 200 else []


async def drive_deep_search(token: str, keyword: str) -> list:
    """
    Deep search: runs THREE parallel queries and merges results.
    1. Name contains keyword
    2. Full-text content contains keyword
    3. Folder-first: find folders with keyword, then list their contents
    """
    queries = [
        f"name contains '{keyword}' and trashed=false",
        f"fullText contains '{keyword}' and trashed=false",
    ]

    all_results = {}

    async with httpx.AsyncClient(timeout=20) as c:
        for q in queries:
            params = {
                "pageSize": 50,
                "fields":   "files(id,name,mimeType,size,modifiedTime,parents,webViewLink,starred)",
                "orderBy":  "modifiedTime desc",
                "q":        q,
            }
            r = await c.get(f"{BASE}/files", headers=_auth(token), params=params)
            if r.status_code == 200:
                for f in r.json().get("files", []):
                    all_results[f["id"]] = f   # deduplicate by id

        # Also list contents of any matching folders
        folder_query = f"name contains '{keyword}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        fr = await c.get(f"{BASE}/files", headers=_auth(token), params={
            "q": folder_query, "pageSize": 10,
            "fields": "files(id,name)"
        })
        if fr.status_code == 200:
            for folder in fr.json().get("files", []):
                cr = await c.get(f"{BASE}/files", headers=_auth(token), params={
                    "q": f"'{folder['id']}' in parents and trashed=false",
                    "pageSize": 30,
                    "fields": "files(id,name,mimeType,size,modifiedTime,parents,webViewLink,starred)",
                })
                if cr.status_code == 200:
                    for f in cr.json().get("files", []):
                        all_results[f["id"]] = {**f, "_inFolder": folder["name"]}

    return list(all_results.values())


async def drive_list_folder_contents(token: str, folder_id: str) -> list:
    """List direct children of a folder."""
    return await drive_list(token, query=f"'{folder_id}' in parents and trashed=false")


async def drive_get_metadata(token: str, file_id: str) -> dict:
    params = {"fields": "id,name,mimeType,size,modifiedTime,parents,webViewLink,description,starred,owners,shared"}
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{BASE}/files/{file_id}", headers=_auth(token), params=params)
        return r.json() if r.status_code == 200 else {}


async def drive_read_content(token: str, file_id: str, mime_type: str = "") -> str:
    """Export or download file content as text (capped at 10k chars)."""
    async with httpx.AsyncClient(timeout=20) as c:
        if "google-apps" in mime_type:
            export = "text/csv" if "spreadsheet" in mime_type else "text/plain"
            r = await c.get(f"{BASE}/files/{file_id}/export",
                            headers=_auth(token), params={"mimeType": export})
        else:
            r = await c.get(f"{BASE}/files/{file_id}?alt=media", headers=_auth(token))
        return r.text[:10000] if r.status_code == 200 else ""


# ── Write Operations ──────────────────────────────────────────

async def drive_create(token: str, name: str, mime_type: str,
                       content: str = "", parent_id: str = None) -> dict:
    meta = {"name": name, "mimeType": mime_type}
    if parent_id:
        meta["parents"] = [parent_id]

    if mime_type == "application/vnd.google-apps.folder" or not content:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(f"{BASE}/files",
                             headers={**_auth(token), "Content-Type": "application/json"},
                             content=json.dumps(meta))
            return r.json() if r.status_code in (200, 201) else {}

    boundary = "treevit_boundary"
    body = (f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"
            f"{json.dumps(meta)}\r\n--{boundary}\r\nContent-Type: text/plain\r\n\r\n"
            f"{content}\r\n--{boundary}--")
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{UPLOAD_BASE}/files?uploadType=multipart",
                         headers={**_auth(token),
                                  "Content-Type": f"multipart/related; boundary={boundary}"},
                         content=body.encode())
        return r.json() if r.status_code in (200, 201) else {}


async def drive_update(token: str, file_id: str, content: str, name: str = None) -> dict:
    meta = {"name": name} if name else {}
    boundary = "treevit_update"
    body = (f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"
            f"{json.dumps(meta)}\r\n--{boundary}\r\nContent-Type: text/plain\r\n\r\n"
            f"{content}\r\n--{boundary}--")
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.patch(f"{UPLOAD_BASE}/files/{file_id}?uploadType=multipart",
                          headers={**_auth(token),
                                   "Content-Type": f"multipart/related; boundary={boundary}"},
                          content=body.encode())
        return r.json() if r.status_code == 200 else {}


async def drive_rename(token: str, file_id: str, new_name: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.patch(f"{BASE}/files/{file_id}",
                          headers={**_auth(token), "Content-Type": "application/json"},
                          content=json.dumps({"name": new_name}))
        return r.json() if r.status_code == 200 else {}


async def drive_move(token: str, file_id: str, new_parent: str, old_parent: str = None) -> dict:
    params = {"addParents": new_parent, "fields": "id,parents"}
    if old_parent:
        params["removeParents"] = old_parent
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.patch(f"{BASE}/files/{file_id}",
                          headers={**_auth(token), "Content-Type": "application/json"},
                          params=params, content=b"{}")
        return r.json() if r.status_code == 200 else {}


async def drive_copy(token: str, file_id: str, new_name: str = None, parent_id: str = None) -> dict:
    meta = {}
    if new_name:   meta["name"]    = new_name
    if parent_id:  meta["parents"] = [parent_id]
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{BASE}/files/{file_id}/copy",
                         headers={**_auth(token), "Content-Type": "application/json"},
                         content=json.dumps(meta))
        return r.json() if r.status_code in (200, 201) else {}


async def drive_trash(token: str, file_id: str) -> bool:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.patch(f"{BASE}/files/{file_id}",
                          headers={**_auth(token), "Content-Type": "application/json"},
                          content=json.dumps({"trashed": True}))
        return r.status_code == 200


async def drive_delete(token: str, file_id: str) -> bool:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.delete(f"{BASE}/files/{file_id}", headers=_auth(token))
        return r.status_code == 204


async def drive_star(token: str, file_id: str, starred: bool) -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.patch(f"{BASE}/files/{file_id}",
                          headers={**_auth(token), "Content-Type": "application/json"},
                          content=json.dumps({"starred": starred}))
        return r.json() if r.status_code == 200 else {}


async def drive_share(token: str, file_id: str, email: str, role: str = "reader") -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{BASE}/files/{file_id}/permissions",
                         headers={**_auth(token), "Content-Type": "application/json"},
                         content=json.dumps({"type": "user", "role": role, "emailAddress": email}))
        return r.json() if r.status_code in (200, 201) else {}


async def drive_list_permissions(token: str, file_id: str) -> list:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{BASE}/files/{file_id}/permissions",
                        headers=_auth(token),
                        params={"fields": "permissions(id,emailAddress,role,type,displayName)"})
        return r.json().get("permissions", []) if r.status_code == 200 else []


async def drive_remove_permission(token: str, file_id: str, perm_id: str) -> bool:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.delete(f"{BASE}/files/{file_id}/permissions/{perm_id}", headers=_auth(token))
        return r.status_code == 204


async def drive_quota(token: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{BASE}/about", headers=_auth(token), params={"fields": "storageQuota,user"})
        return r.json() if r.status_code == 200 else {}


# ─────────────────────────────────────────────────────────────
#  Intent Detection
# ─────────────────────────────────────────────────────────────

def _extract_keyword(prompt: str) -> str | None:
    """Pull the most likely search keyword from the prompt."""
    # Quoted string wins
    m = re.search(r'["\']([^"\']+)["\']', prompt)
    if m:
        return m.group(1)
    # After known verbs
    m = re.search(
        r'(?:find|search|look for|locate|show|open|read|summarize|trash|delete|rename|star|share)\s+(?:me\s+)?(?:files?\s+(?:named?|called|with|about|containing|related to)\s+)?([a-zA-Z0-9_\-\.]+)',
        prompt, re.IGNORECASE
    )
    if m:
        return m.group(1)
    return None


def _detect_intent(prompt: str) -> dict:
    p = prompt.lower()
    return {
        "deep_search": any(k in p for k in ["find", "search", "look for", "locate", "where is", "containing", "keyword", "related to", "files about", "files with"]),
        "list":        any(k in p for k in ["list", "show files", "my files", "all files", "recent", "what files"]),
        "read":        any(k in p for k in ["read", "open", "show content", "what's in", "summarize", "content of", "what does"]),
        "create":      any(k in p for k in ["create", "make", "new file", "new folder", "write a"]),
        "update":      any(k in p for k in ["update", "edit", "modify", "change", "rewrite", "append"]),
        "rename":      any(k in p for k in ["rename", "change name", "call it"]),
        "trash":       any(k in p for k in ["trash", "move to trash", "bin"]),
        "delete":      any(k in p for k in ["delete", "permanently delete", "remove forever"]),
        "move":        any(k in p for k in ["move", "transfer", "put in folder"]),
        "copy":        any(k in p for k in ["copy", "duplicate", "clone"]),
        "share":       any(k in p for k in ["share", "give access", "collaborate", "invite"]),
        "permissions": any(k in p for k in ["permission", "who has access", "unshare", "revoke"]),
        "star":        any(k in p for k in ["star", "favourite", "bookmark", "unstar"]),
        "quota":       any(k in p for k in ["storage", "quota", "space", "how much"]),
        "folder":      any(k in p for k in ["folder", "directory", "inside", "contents of"]),
        "keyword":     _extract_keyword(prompt),
    }


# ─────────────────────────────────────────────────────────────
#  Main Agent
# ─────────────────────────────────────────────────────────────

async def run_googledrive_agent(user_prompt: str, context: dict):
    """
    Main agent entry point.
    context must contain:
      - googleAccessToken: str
      - conversationHistory: list of {role, content} dicts  ← KEY for memory
      - driveContent: list of currently displayed files
      - email, token, settings
    """
    token       = context.get("googleAccessToken", "")
    history     = context.get("conversationHistory", [])   # ← full chat history
    drive_ctx   = context.get("driveContent", [])
    intent      = _detect_intent(user_prompt)
    keyword     = intent["keyword"]
    pre         = {}   # pre-fetched real data

    # ── Pre-fetch based on intent ──────────────────────────────
    try:
        if intent["quota"]:
            pre["quota"] = await drive_quota(token)

        if intent["deep_search"] and keyword:
            pre["searchResults"] = await drive_deep_search(token, keyword)
            pre["searchKeyword"] = keyword

        elif intent["list"] or (not any([
            intent["create"], intent["read"], intent["update"],
            intent["rename"], intent["trash"], intent["delete"],
            intent["move"], intent["copy"], intent["share"],
            intent["permissions"], intent["star"], intent["quota"],
        ])):
            # Default: list recent files
            pre["files"] = await drive_list(token, query="trashed=false")

        # If user refers to a file by name from history, try to fetch its metadata
        if drive_ctx and (intent["read"] or intent["rename"] or intent["star"] or intent["share"]):
            pre["currentFiles"] = drive_ctx[:20]

    except Exception as e:
        pre["fetchError"] = str(e)

    pre_json = json.dumps(pre, default=str)

    # ── Build conversation history for the LLM ─────────────────
    # Format: alternating user/assistant turns the LLM can read
    history_text = ""
    if history:
        history_text = "\n\nCONVERSATION HISTORY (use this for context and continuity):\n"
        for turn in history[-12:]:   # last 12 turns = ~6 exchanges
            role   = "User"    if turn.get("role") == "user" else "Assistant"
            content = turn.get("content", "")[:400]   # cap each turn
            history_text += f"{role}: {content}\n"

    # ── System prompt ──────────────────────────────────────────
    system = f"""You are a friendly, conversational Google Drive AI assistant embedded in the Treevit app.

PERSONALITY:
- Warm, clear, and concise — like a knowledgeable colleague
- Always acknowledge what you did in plain English first
- Reference previous messages naturally (e.g. "Like I mentioned earlier...", "That file you asked about...")
- If you're unsure about a file ID, say so and ask the user to clarify
- Never make up file IDs — only use IDs from PRE_FETCHED_DATA

{history_text}

PRE_FETCHED_DATA (real data freshly fetched from the user's Google Drive):
{pre_json}

Files currently visible to the user:
{json.dumps(drive_ctx[:15], default=str)}

AVAILABLE ACTIONS (put these in the JSON actions array):
You can return multiple actions in one response.

LIST action — always include when showing files:
  {{"type":"list","results":[...array of file objects...]}}

SEARCH action — for keyword search results:
  {{"type":"search","keyword":"...","results":[...array...],"totalFound":N}}

READ action — to show file content to user:
  {{"type":"read","fileId":"...","fileName":"...","content":"...text content..."}}

CREATE action:
  {{"type":"create","name":"filename","mimeType":"text/plain|application/vnd.google-apps.folder|application/vnd.google-apps.document|application/vnd.google-apps.spreadsheet","content":"optional","parentId":"optional"}}

UPDATE action:
  {{"type":"update","fileId":"...","name":"optional new name","content":"new content"}}

RENAME action:
  {{"type":"rename","fileId":"...","newName":"..."}}

TRASH action (safer — recoverable):
  {{"type":"trash","fileId":"...","name":"..."}}

DELETE action (permanent):
  {{"type":"delete","fileId":"...","name":"..."}}

MOVE action:
  {{"type":"move","fileId":"...","newParentId":"...","oldParentId":"optional"}}

COPY action:
  {{"type":"copy","fileId":"...","newName":"Copy of ...","parentId":"optional"}}

SHARE action:
  {{"type":"share","fileId":"...","email":"user@example.com","role":"reader|writer|commenter"}}

STAR action:
  {{"type":"star","fileId":"...","starred":true}}

QUOTA action — show storage info:
  {{"type":"quota","used":"bytes","limit":"bytes","usageInDriveTrash":"bytes"}}

ERROR action:
  {{"type":"error","message":"human readable reason"}}

STRICT RESPONSE FORMAT:
Write a short, friendly conversational message (2-5 sentences).
Then write exactly: <<<JSON>>>
Then a single JSON object: {{"operation":"...","actions":[...],"message":"short summary"}}
Then write: <<<END>>>

RULES:
- NEVER invent file IDs. Only use IDs from PRE_FETCHED_DATA.
- For search results, always use the "search" action type, not "list".
- If the user asks about something from history (e.g. "that file"), look for it in currentFiles or history.
- For deep searches, include ALL matching results from pre_fetched searchResults.
- If pre_fetched data is empty for a search, explain that and suggest alternatives.
- Keep your conversational text natural and brief. The file explorer shows the data.
"""

    # ── Stream the LLM response ────────────────────────────────
    llm_prompt = f"{system}\n\nUser: {user_prompt}"
    full        = ""
    past_marker = False

    async for chunk in stream_gemini_response(llm_prompt):
        full += chunk
        # Stream only the conversational text part (before <<<JSON>>>)
        if "<<<JSON>>>" in full:
            if not past_marker:
                # yield the explanation part
                explanation = full.split("<<<JSON>>>")[0].strip()
                # we already streamed chunks, so just mark we're past it
                past_marker = True
        else:
            if chunk.strip():
                yield {"chunk": chunk}

    # ── Parse structured response ──────────────────────────────
    try:
        explanation = ""
        json_str    = ""

        if "<<<JSON>>>" in full and "<<<END>>>" in full:
            explanation = full.split("<<<JSON>>>")[0].strip()
            json_str    = full.split("<<<JSON>>>")[1].split("<<<END>>>")[0].strip()
        elif "{" in full:
            brace       = full.find("{")
            explanation = full[:brace].strip()
            json_str    = full[brace:].strip()
            # try to close truncated JSON
            if json_str.count("{") > json_str.count("}"):
                json_str += "}" * (json_str.count("{") - json_str.count("}"))

        if not json_str:
            yield {"fullMessage": full.strip(), "actions": [], "done": True}
            return

        # clean markdown fences
        json_str = re.sub(r'^```json\s*', '', json_str).rstrip('`').strip()
        parsed   = json.loads(json_str)
        actions  = parsed.get("actions", [])

        # ── Execute side-effecting actions ─────────────────────
        executed = []
        for action in actions:
            t = action.get("type", "")
            try:
                if t == "create":
                    res = await drive_create(token, action.get("name", "Untitled"),
                                             action.get("mimeType", "text/plain"),
                                             action.get("content", ""),
                                             action.get("parentId"))
                    executed.append({"type": "create", "result": res})

                elif t == "update":
                    res = await drive_update(token, action["fileId"],
                                             action.get("content", ""),
                                             action.get("name"))
                    executed.append({"type": "update", "result": res})

                elif t == "rename":
                    res = await drive_rename(token, action["fileId"], action["newName"])
                    executed.append({"type": "rename", "result": res})

                elif t == "trash":
                    res = await drive_trash(token, action["fileId"])
                    executed.append({"type": "trash", "success": res})

                elif t == "delete":
                    res = await drive_delete(token, action["fileId"])
                    executed.append({"type": "delete", "success": res})

                elif t == "move":
                    res = await drive_move(token, action["fileId"],
                                           action["newParentId"],
                                           action.get("oldParentId"))
                    executed.append({"type": "move", "result": res})

                elif t == "copy":
                    res = await drive_copy(token, action["fileId"],
                                           action.get("newName"),
                                           action.get("parentId"))
                    executed.append({"type": "copy", "result": res})

                elif t == "share":
                    res = await drive_share(token, action["fileId"],
                                            action.get("email", ""),
                                            action.get("role", "reader"))
                    executed.append({"type": "share", "result": res})

                elif t == "star":
                    res = await drive_star(token, action["fileId"], action.get("starred", True))
                    executed.append({"type": "star", "result": res})

            except Exception as e:
                executed.append({"type": t, "error": str(e)})

        yield {
            "fullMessage":     explanation or parsed.get("message", "Done."),
            "actions":         actions,
            "executedResults": executed,
            "operation":       parsed.get("operation", ""),
            "done":            True,
        }

    except json.JSONDecodeError as e:
        # Graceful fallback — return the text at least
        yield {
            "fullMessage": full.split("<<<JSON>>>")[0].strip() or full.strip(),
            "actions":     [],
            "done":        True,
        }
    except Exception as e:
        yield {"error": f"Agent error: {str(e)}", "done": True}