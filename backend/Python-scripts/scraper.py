# app.py — simplified scraper service
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests
from bs4 import BeautifulSoup
import re

load_dotenv()
API_KEY_SE = os.getenv("API_KEY_SE")
CX = os.getenv("CX_ID")

app = Flask(__name__)
CORS(app)


def simple_clean(text: str) -> str:
    """Minimal cleaning: normalize whitespace, remove strange chars, basic boilerplate words."""
    if not text:
        return ""
    # collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    # drop weird non-ASCII characters (keep punctuation)
    text = re.sub(r"[^A-Za-z0-9\s\.,!?:;'\"()\-\n]", " ", text)
    # remove very common boilerplate words
    text = re.sub(r"(?i)\b(cookie|privacy|terms|subscribe|advertis(ement|ing)|copyright)\b", "", text)
    # collapse repeated punctuation (like "!!!!!")
    text = re.sub(r"([!?.,;:'\"-])\1{2,}", r"\1", text)
    return text.strip()


def truncate(text: str, max_chars: int = 12000) -> str:
    if not text or len(text) <= max_chars:
        return text
    half = max_chars // 2
    return text[:half] + "\n\n...[truncated]...\n\n" + text[-half:]


def google_search_links(query: str, max_links: int = 10):
    """Return list of link/title pairs from Google Custom Search API."""
    if not API_KEY_SE or not CX:
        raise RuntimeError("Missing API_KEY_SE or CX_ID in environment")

    params = {"q": query, "key": API_KEY_SE, "cx": CX, "num": min(7, max_links)}
    resp = requests.get("https://www.googleapis.com/customsearch/v1", params=params, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"Custom Search API error {resp.status_code}: {resp.text[:500]}")
    data = resp.json()
    items = data.get("items", []) or []
    links = []
    for it in items[:max_links]:
        link = it.get("link")
        title = it.get("title", "")
        if link:
            links.append({"link": link, "title": title})
    return links


def fetch_and_extract(link: str):
    """Fetch a URL, remove noisy tags and return cleaned text (or None on failure)."""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; SimpleScraper/1.0)"}
    try:
        r = requests.get(link, headers=headers, timeout=10, allow_redirects=True)
        ct = r.headers.get("Content-Type", "")
        if "text/html" not in ct:
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        # remove noisy tags
        for tag_name in ["script", "style", "noscript", "header", "footer", "nav", "iframe", "form", "aside"]:
            for t in soup.find_all(tag_name):
                t.extract()
        text = soup.get_text(separator=" ", strip=True)
        text = simple_clean(text)
        text = truncate(text, max_chars=12000)
        return text
    except Exception:
        return None


@app.route("/scrape", methods=["GET"])
def scrape():
    query = request.args.get("query", "").strip()
    if not query:
        return jsonify({"error": "Query parameter is required"}), 400
    max_links = request.args.get("max", default=5, type=int)
    try:
        links = google_search_links(query, max_links=max_links)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    results = []
    for item in links:
        link = item["link"]
        title = item.get("title", "")
        text = fetch_and_extract(link)
        if not text:
            # skip unreachable / non-html resources
            continue
        snippet = text[:400] + "..." if len(text) > 400 else text
        results.append({"title": title, "link": link, "snippet": snippet, "text": text})

    return jsonify({"query": query, "count": len(results), "results": results})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 3001))
    app.run(host="0.0.0.0", port=port, debug=True)
