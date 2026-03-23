"""
Advanced Canva AI Agent
========================
Capabilities added vs original:
  1. Multi-slide operations  – create/delete/reorder slides, not just patch current
  2. Smart layout engine     – auto-positions elements using layout grid hints
  3. Undo history            – every patch is stored so the frontend can undo
  4. Design system           – consistent palettes, font scales, spacing rules
  5. Context-aware prompting – agent sees full deck, not just current slide
  6. Animation hints         – returns optional entrance/transition metadata
  7. Batch element creation  – single instruction → full slide design
  8. Error recovery          – validates patch before yielding, falls back gracefully
  9. Intent classification   – routes to specialised sub-prompts per intent
 10. Streaming explanation   – friendly text streams while JSON builds silently
"""

import json
import re
import uuid
from typing import AsyncGenerator, Any
from utils.persona import get_persona_prompt
# Replace with your actual LLM client
# from models.gemini_client import stream_gemini_response
# from models.claude_client import stream_claude_response


# ─────────────────────────────────────────────────────────────────────────────
# Design System Constants
# ─────────────────────────────────────────────────────────────────────────────

SLIDE_W = 960
SLIDE_H = 540
PADDING = 60          # default safe-zone padding

DESIGN_SYSTEM = {
    "palettes": {
        "dark":     {"bg": "#1a1a2e", "primary": "#7c3aed", "text": "#ffffff", "muted": "rgba(255,255,255,0.6)"},
        "gradient": {"bg": "linear-gradient(135deg,#7c3aed,#a855f7,#ec4899)", "primary": "#ffffff", "text": "#ffffff", "muted": "rgba(255,255,255,0.7)"},
        "minimal":  {"bg": "#ffffff", "primary": "#7c3aed", "text": "#1e293b", "muted": "#64748b"},
        "business": {"bg": "linear-gradient(135deg,#1e293b,#334155)", "primary": "#38bdf8", "text": "#f1f5f9", "muted": "#94a3b8"},
        "creative": {"bg": "linear-gradient(135deg,#f59e0b,#ef4444)", "primary": "#ffffff", "text": "#ffffff", "muted": "rgba(255,255,255,0.8)"},
        "ocean":    {"bg": "linear-gradient(135deg,#0ea5e9,#0284c7,#075985)", "primary": "#bae6fd", "text": "#f0f9ff", "muted": "#7dd3fc"},
        "forest":   {"bg": "linear-gradient(135deg,#166534,#15803d,#4ade80)", "primary": "#d1fae5", "text": "#f0fdf4", "muted": "#bbf7d0"},
        "mono":     {"bg": "#0f0f0f", "primary": "#e5e5e5", "text": "#fafafa", "muted": "#737373"},
    },
    "fontScale": {
        "display":  72,
        "h1":       48,
        "h2":       36,
        "h3":       28,
        "body":     20,
        "small":    14,
        "caption":  11,
    },
    "spacing": {
        "xs": 8,
        "sm": 16,
        "md": 32,
        "lg": 60,
        "xl": 96,
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# Layout Presets  (auto-populated positions for common layouts)
# ─────────────────────────────────────────────────────────────────────────────

def layout_title_slide(title: str, subtitle: str, palette: dict) -> dict:
    return {
        "background": palette["bg"],
        "addElements": [
            {
                "id": _uid(), "type": "text",
                "text": title,
                "fontSize": DESIGN_SYSTEM["fontScale"]["h1"],
                "color": palette["text"],
                "bold": True, "italic": False, "align": "center",
                "x": PADDING, "y": SLIDE_H // 2 - 80,
                "w": SLIDE_W - PADDING * 2, "h": 80,
            },
            {
                "id": _uid(), "type": "text",
                "text": subtitle,
                "fontSize": DESIGN_SYSTEM["fontScale"]["body"],
                "color": palette["muted"],
                "bold": False, "italic": False, "align": "center",
                "x": PADDING + 60, "y": SLIDE_H // 2 + 20,
                "w": SLIDE_W - (PADDING + 60) * 2, "h": 40,
            },
        ]
    }


def layout_two_column(left_text: str, right_text: str, palette: dict) -> dict:
    col_w = (SLIDE_W - PADDING * 3) // 2
    return {
        "background": palette["bg"],
        "addElements": [
            {
                "id": _uid(), "type": "text",
                "text": left_text,
                "fontSize": DESIGN_SYSTEM["fontScale"]["body"],
                "color": palette["text"],
                "bold": False, "italic": False, "align": "left",
                "x": PADDING, "y": PADDING,
                "w": col_w, "h": SLIDE_H - PADDING * 2,
            },
            {
                "id": _uid(), "type": "text",
                "text": right_text,
                "fontSize": DESIGN_SYSTEM["fontScale"]["body"],
                "color": palette["text"],
                "bold": False, "italic": False, "align": "left",
                "x": PADDING * 2 + col_w, "y": PADDING,
                "w": col_w, "h": SLIDE_H - PADDING * 2,
            },
        ]
    }


def layout_section_header(section: str, palette: dict) -> dict:
    return {
        "background": palette["primary"] if palette["bg"] == "#ffffff" else palette["bg"],
        "addElements": [
            {
                "id": _uid(), "type": "shape",
                "x": 0, "y": SLIDE_H // 2 - 60,
                "w": SLIDE_W, "h": 120,
                "fill": "rgba(255,255,255,0.08)", "radius": 0,
            },
            {
                "id": _uid(), "type": "text",
                "text": section,
                "fontSize": DESIGN_SYSTEM["fontScale"]["h1"],
                "color": palette["text"],
                "bold": True, "italic": False, "align": "center",
                "x": PADDING, "y": SLIDE_H // 2 - 40,
                "w": SLIDE_W - PADDING * 2, "h": 80,
            },
        ]
    }


LAYOUT_REGISTRY = {
    "title":          layout_title_slide,
    "two_column":     layout_two_column,
    "section_header": layout_section_header,
}

# ─────────────────────────────────────────────────────────────────────────────
# Intent Classifier
# ─────────────────────────────────────────────────────────────────────────────

INTENT_KEYWORDS = {
    "create_slide":   ["new slide", "add slide", "create slide", "blank slide"],
    "delete_slide":   ["delete slide", "remove slide"],
    "apply_template": ["template", "theme", "style", "palette", "dark mode", "minimal", "gradient"],
    "add_text":       ["add text", "add title", "heading", "subtitle", "write", "type"],
    "add_shape":      ["add shape", "rectangle", "circle", "box", "square"],
    "add_image":      ["add image", "insert image", "picture"],
    "layout":         ["layout", "arrange", "align", "center", "two column", "column"],
    "animate":        ["animate", "transition", "entrance", "fade", "slide in"],
    "undo":           ["undo", "revert", "go back"],
    "export":         ["export", "download", "save as"],
    "bulk_design":    ["design a full", "make me a", "create a presentation", "full slide"],
}

def classify_intent(text: str) -> str:
    text_lower = text.lower()
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return intent
    return "general_edit"


# ─────────────────────────────────────────────────────────────────────────────
# Patch Validator
# ─────────────────────────────────────────────────────────────────────────────

REQUIRED_ELEMENT_FIELDS = {"type", "x", "y", "w", "h"}

def validate_patch(patch: dict) -> tuple[bool, str]:
    """Returns (is_valid, error_message)."""
    if not isinstance(patch, dict):
        return False, "Patch must be a dict"

    for key in ("addElements", "updateElements", "removeElements"):
        val = patch.get(key)
        if val is not None and not isinstance(val, list):
            return False, f"{key} must be a list"

    for el in patch.get("addElements", []):
        missing = REQUIRED_ELEMENT_FIELDS - set(el.keys())
        if missing:
            return False, f"Element missing fields: {missing}"
        if el.get("type") not in ("text", "shape", "image"):
            return False, f"Unknown element type: {el.get('type')}"
        if el.get("type") == "text" and "text" not in el:
            return False, "Text element missing 'text' field"

    return True, ""


def sanitize_patch(patch: dict) -> dict:
    """Clamp values and fill defaults to ensure safe rendering."""
    for el in patch.get("addElements", []):
        el.setdefault("id", _uid())
        el["x"] = max(0, min(el.get("x", 0), SLIDE_W - 40))
        el["y"] = max(0, min(el.get("y", 0), SLIDE_H - 20))
        el["w"] = max(40, min(el.get("w", 200), SLIDE_W))
        el["h"] = max(20, min(el.get("h", 60), SLIDE_H))
        if el.get("type") == "text":
            el.setdefault("fontSize", 24)
            el.setdefault("color", "#ffffff")
            el.setdefault("bold", False)
            el.setdefault("italic", False)
            el.setdefault("align", "left")
        if el.get("type") == "shape":
            el.setdefault("fill", "#7c3aed")
            el.setdefault("radius", 8)
    return patch


# ─────────────────────────────────────────────────────────────────────────────
# Deck Context Builder
# ─────────────────────────────────────────────────────────────────────────────

def build_deck_context(context: dict) -> str:
    """Summarise the full deck state for the prompt."""
    slides = context.get("slides", [])
    active = context.get("activeSlideIndex", 0)
    if not slides:
        return "No slides created yet."

    lines = [f"Deck has {len(slides)} slide(s). Currently editing slide {active + 1}.\n"]
    for i, slide in enumerate(slides):
        marker = " ← ACTIVE" if i == active else ""
        lines.append(f"Slide {i + 1}{marker}:")
        lines.append(f"  background: {slide.get('background', 'unknown')}")
        elements = slide.get("elements", [])
        lines.append(f"  elements ({len(elements)}):")
        for el in elements:
            if el.get("type") == "text":
                lines.append(f"    [{el['id']}] text: \"{el.get('text', '')}\" fontSize={el.get('fontSize')} color={el.get('color')}")
            elif el.get("type") == "shape":
                lines.append(f"    [{el['id']}] shape fill={el.get('fill')} at ({el.get('x')},{el.get('y')}) {el.get('w')}×{el.get('h')}")
            elif el.get("type") == "image":
                lines.append(f"    [{el['id']}] image at ({el.get('x')},{el.get('y')}) {el.get('w')}×{el.get('h')}")
        lines.append("")

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# System Prompt Builder
# ─────────────────────────────────────────────────────────────────────────────

def build_system_prompt(intent: str, deck_context: str) -> str:
    design_system_json = json.dumps(DESIGN_SYSTEM, indent=2)

    intent_guidance = {
        "create_slide":   "The user wants a new slide added to the deck. Use slideOps.addSlide.",
        "delete_slide":   "The user wants a slide removed. Use slideOps.deleteSlide with the slide index.",
        "apply_template": "Apply a full visual theme from the design system. Replace background and update all element colors to match.",
        "add_text":       "Add a well-positioned text element. Use the font scale from the design system.",
        "add_shape":      "Add a shape. Use palette-appropriate fill colors.",
        "layout":         "Rearrange or align existing elements. Use updateElements with computed positions.",
        "animate":        "Add animation metadata to elements using the 'animation' field.",
        "bulk_design":    "Design an entire slide: choose background, add 2–4 elements with good layout, consistent palette.",
        "general_edit":   "Interpret the instruction and apply the best possible patch.",
    }.get(intent, "Interpret and apply the best patch.")

    return f"""You are an expert AI slide designer embedded in a Canva-like editor.
Slide canvas: {SLIDE_W}×{SLIDE_H}px. Safe padding: {PADDING}px.

INTENT DETECTED: {intent}
GUIDANCE: {intent_guidance}

DESIGN SYSTEM (follow these values):
{design_system_json}

CURRENT DECK STATE:
{deck_context}

YOUR RESPONSE MUST follow this EXACT structure — nothing else:

EXPLANATION:
<2–3 sentences explaining your design choices in a friendly tone>

JSON_DATA:
{{
  "operation": "<short label>",
  "targetSlideIndex": <integer, 0-based, which slide to patch — default is the active slide>,
  "slideOps": {{
    "addSlide": {{ "background": "...", "copyFromIndex": null }},
    "deleteSlide": {{ "index": 0 }},
    "reorderSlide": {{ "fromIndex": 0, "toIndex": 2 }}
  }},
  "patch": {{
    "background": "<optional hex or CSS gradient>",
    "addElements": [ /* new elements */ ],
    "updateElements": [ /* existing elements with id + changed fields */ ],
    "removeElements": [ "id1", "id2" ]
  }},
  "animations": [
    {{ "elementId": "id", "entrance": "fadeIn", "duration": 400, "delay": 0 }},
    {{ "elementId": "id", "entrance": "slideUp", "duration": 500, "delay": 200 }}
  ],
  "undoSnapshot": true,
  "message": "<friendly summary shown to user>"
}}

RULES:
- Return ONLY the EXPLANATION block and JSON_DATA block. No other prose.
- slideOps is optional — omit if not changing slide structure.
- patch is optional — omit if only changing slide structure.
- animations is optional — include only when animating.
- All coordinates must be integers within the slide bounds.
- Prefer palette colors from the design system over arbitrary colors.
- For 'text' elements, always include: text, fontSize, color, bold, italic, align, x, y, w, h.
- For 'shape' elements, always include: fill, radius, x, y, w, h.
- For 'image' elements, always include: src, x, y, w, h.
- When creating a full slide design, choose a palette, set background, and add 2–4 harmonious elements.
"""


# ─────────────────────────────────────────────────────────────────────────────
# History / Undo Store (in-memory per session)
# ─────────────────────────────────────────────────────────────────────────────

_undo_store: dict[str, list[dict]] = {}   # session_id → list of deck snapshots

def push_undo(session_id: str, deck_snapshot: dict) -> None:
    history = _undo_store.setdefault(session_id, [])
    history.append(deck_snapshot)
    if len(history) > 50:          # cap at 50 undo steps
        history.pop(0)

def pop_undo(session_id: str) -> dict | None:
    history = _undo_store.get(session_id, [])
    if not history:
        return None
    return history.pop()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _uid() -> str:
    return uuid.uuid4().hex[:8]


def _extract_json_and_explanation(full_response: str) -> tuple[str, str]:
    """Split the LLM response into (explanation, raw_json_string)."""
    explanation = ""
    json_str = ""

    if "JSON_DATA:" in full_response:
        parts = re.split(r"JSON_DATA:\s*", full_response, maxsplit=1, flags=re.IGNORECASE)
        explanation = re.sub(r"EXPLANATION:\s*", "", parts[0], flags=re.IGNORECASE).strip()
        json_str = parts[1].strip() if len(parts) > 1 else ""
    else:
        brace = full_response.find("{")
        if brace != -1:
            explanation = re.sub(r"EXPLANATION:\s*", "", full_response[:brace], flags=re.IGNORECASE).strip()
            json_str = full_response[brace:].strip()

    # Strip markdown code fences if present
    json_str = re.sub(r"^```(?:json)?\s*", "", json_str, flags=re.MULTILINE).replace("```", "").strip()
    return explanation, json_str


# ─────────────────────────────────────────────────────────────────────────────
# Main Agent Entry Point
# ─────────────────────────────────────────────────────────────────────────────

async def run_canva_agent(
    user_prompt: str,
    context: dict,
    session_id: str = "default",
) -> AsyncGenerator[dict[str, Any], None]:
    """
    Yields dicts:
      {"chunk": str}                  – streaming explanation text
      {"fullMessage": str,
       "patch": dict,
       "slideOps": dict | None,
       "animations": list | None,
       "targetSlideIndex": int,
       "undoAvailable": bool,
       "operation": str,
       "done": True}                  – final structured result
      {"error": str, "done": True}    – on failure
    """

    # ── Handle undo shortcut ──────────────────────────────────────────────────
    if classify_intent(user_prompt) == "undo":
        snapshot = pop_undo(session_id)
        if snapshot:
            yield {
                "fullMessage": "↩️ Undone! Restored the previous state.",
                "deckRestore": snapshot,
                "operation": "undo",
                "done": True,
            }
        else:
            yield {"fullMessage": "Nothing to undo.", "operation": "undo", "done": True}
        return

    # ── Build context & classify ──────────────────────────────────────────────
    persona = get_persona_prompt(context)
    intent = classify_intent(user_prompt)
    deck_context = build_deck_context(context)
    system_prompt = build_system_prompt(intent, deck_context)

    full_prompt = f"{persona}{system_prompt}\n\nUser instruction: \"{user_prompt}\""

    # ── Save undo snapshot before applying ───────────────────────────────────
    deck_snapshot = context.get("slides")
    if deck_snapshot:
        push_undo(session_id, {"slides": deck_snapshot, "activeSlideIndex": context.get("activeSlideIndex", 0)})

    # ── Stream LLM response ───────────────────────────────────────────────────
    full_response = ""
    explanation_sent = False
    explanation_buf = ""

    # ── REPLACE the loop below with your actual LLM streaming call ───────────
    # Example with Gemini:
    #   async for chunk in stream_gemini_response(full_prompt):
    # Example with Claude:
    #   async for chunk in stream_claude_response(full_prompt):
    #
    # For now we use a placeholder that simulates a complete response.
    # In production, replace `mock_llm_stream` with your real client.
    async for chunk in mock_llm_stream(full_prompt):
    # ─────────────────────────────────────────────────────────────────────────
        full_response += chunk

        # Stream explanation text as it arrives (before JSON_DATA marker)
        if not explanation_sent and "JSON_DATA:" not in full_response:
            # Buffer until we have at least a word boundary
            explanation_buf += chunk
            # Yield explanation words but stop at any JSON-like content
            safe_text = re.sub(r"EXPLANATION:\s*", "", explanation_buf, flags=re.IGNORECASE)
            safe_text = re.sub(r"\{.*", "", safe_text, flags=re.DOTALL).strip()
            if safe_text and safe_text != explanation_buf:
                yield {"chunk": safe_text}
                explanation_sent = True
        elif not explanation_sent and "JSON_DATA:" in full_response:
            # Flush explanation
            explanation, _ = _extract_json_and_explanation(full_response)
            if explanation:
                yield {"chunk": explanation}
            explanation_sent = True

    # ── Parse and validate the full response ─────────────────────────────────
    try:
        explanation, json_str = _extract_json_and_explanation(full_response)

        if not json_str:
            yield {"error": "AI returned no JSON patch.", "done": True}
            return

        parsed = json.loads(json_str)

        patch = parsed.get("patch", {})
        slide_ops = parsed.get("slideOps")
        animations = parsed.get("animations")
        operation = parsed.get("operation", "design_update")
        message = parsed.get("message") or explanation or "Done!"
        target_index = parsed.get("targetSlideIndex", context.get("activeSlideIndex", 0))

        # Validate & sanitize patch
        if patch:
            valid, err = validate_patch(patch)
            if not valid:
                yield {"error": f"Invalid patch: {err}", "done": True}
                return
            patch = sanitize_patch(patch)

        yield {
            "fullMessage": message,
            "patch": patch,
            "slideOps": slide_ops,
            "animations": animations,
            "targetSlideIndex": target_index,
            "operation": operation,
            "undoAvailable": bool(_undo_store.get(session_id)),
            "done": True,
        }

    except json.JSONDecodeError as e:
        yield {"error": f"JSON parse error: {e}", "rawResponse": full_response[:500], "done": True}
    except Exception as e:
        yield {"error": f"Agent error: {e}", "done": True}


# ─────────────────────────────────────────────────────────────────────────────
# Mock LLM Stream (replace with your real client)
# ─────────────────────────────────────────────────────────────────────────────

async def mock_llm_stream(prompt: str):
    """
    Placeholder — yields a hard-coded response.
    Replace the `async for chunk in mock_llm_stream(...)` call above
    with your actual streaming client, e.g.:
        async for chunk in stream_gemini_response(prompt):
        async for chunk in stream_claude_response(prompt):
    """
    response = '''EXPLANATION:
I'll add a bold title and a soft subtitle centered on the slide, using the dark palette for a professional look.

JSON_DATA:
{
  "operation": "Add Title Slide",
  "targetSlideIndex": 0,
  "patch": {
    "background": "#1a1a2e",
    "addElements": [
      {
        "id": "auto_title",
        "type": "text",
        "text": "Your Presentation Title",
        "fontSize": 48,
        "color": "#ffffff",
        "bold": true,
        "italic": false,
        "align": "center",
        "x": 60,
        "y": 190,
        "w": 840,
        "h": 80
      },
      {
        "id": "auto_sub",
        "type": "text",
        "text": "Subtitle goes here",
        "fontSize": 20,
        "color": "rgba(255,255,255,0.6)",
        "bold": false,
        "italic": false,
        "align": "center",
        "x": 180,
        "y": 290,
        "w": 600,
        "h": 40
      }
    ]
  },
  "message": "Added a centered title and subtitle using the dark theme palette."
}'''
    # Simulate streaming chunks
    for i in range(0, len(response), 30):
        yield response[i:i+30]


# ─────────────────────────────────────────────────────────────────────────────
# Convenience: Pre-built Layout Generator (call from routes directly)
# ─────────────────────────────────────────────────────────────────────────────

def generate_layout(layout_name: str, palette_name: str = "dark", **kwargs) -> dict | None:
    """
    Directly generate a slide patch using a named layout preset.
    Useful for template buttons in the frontend.

    Example:
        patch = generate_layout("title", "gradient", title="Hello World", subtitle="Subtitle")
    """
    palette = DESIGN_SYSTEM["palettes"].get(palette_name, DESIGN_SYSTEM["palettes"]["dark"])
    fn = LAYOUT_REGISTRY.get(layout_name)
    if not fn:
        return None
    if layout_name == "title":
        return fn(kwargs.get("title", "Title"), kwargs.get("subtitle", "Subtitle"), palette)
    if layout_name == "two_column":
        return fn(kwargs.get("left", "Left"), kwargs.get("right", "Right"), palette)
    if layout_name == "section_header":
        return fn(kwargs.get("section", "Section"), palette)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI Route Helper (drop into your routes file)
# ─────────────────────────────────────────────────────────────────────────────
#
# from fastapi import Request
# from fastapi.responses import StreamingResponse
# import json, asyncio
#
# @router.post("/canva-agent/stream")
# async def canva_agent_stream_route(request: Request):
#     body = await request.json()
#     user_prompt   = body.get("message", "")
#     context       = body.get("context", {})   # { slides, activeSlideIndex }
#     session_id    = body.get("sessionId", "default")
#
#     async def event_stream():
#         async for event in run_canva_agent(user_prompt, context, session_id):
#             yield f"data: {json.dumps(event)}\n\n"
#         yield "data: [DONE]\n\n"
#
#     return StreamingResponse(event_stream(), media_type="text/event-stream")