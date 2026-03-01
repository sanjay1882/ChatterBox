import axios from 'axios';
import * as cheerio from 'cheerio';

// Helper: robust clean text
function simpleClean(text) {
    if (!text) return "";
    // Collapse whitespace
    let cleaned = text.replace(/\s+/g, " ").trim();

    // REMOVED: Aggressive non-ASCII stripping
    // cleaned = cleaned.replace(/[^A-Za-z0-9\s.,!?:;'"()\-\n]/g, " ");

    // Remove common boilerplate
    cleaned = cleaned.replace(/\b(cookie|privacy|terms|subscribe|advertis(ement|ing)|copyright)\b/gi, "");
    // Collapse repeated punctuation
    cleaned = cleaned.replace(/([!?.,;:'"-])\1{2,}/g, "$1");

    return cleaned.trim();
}

function truncate(text, maxChars = 12000) {
    if (!text || text.length <= maxChars) return text;
    const half = Math.floor(maxChars / 2);
    return text.substring(0, half) + "\n\n...[truncated]...\n\n" + text.substring(text.length - half);
}


export async function googleSearch(query, maxLinks = 10) {
    const API_KEY_SE = process.env.API_KEY_SE;
    const CX = process.env.CX_ID || process.env.CX;

    if (!API_KEY_SE || !CX) {
        throw new Error("Missing API_KEY_SE or CX_ID in environment");
    }

    try {
        const response = await axios.get("https://www.googleapis.com/customsearch/v1", {
            params: {
                q: query,
                key: API_KEY_SE,
                cx: CX,
                num: Math.min(10, maxLinks)
            },
            timeout: 10000
        });

        const items = response.data.items || [];
        return items.map(item => ({
            link: item.link,
            title: item.title || "",
            snippet: item.snippet || ""
        }));
    } catch (error) {
        console.error("Google Search API Error:", error.message);
        throw new Error(`Custom Search API error: ${error.message}`);
    }
}

// 2. Fetch and Extract Text
export async function fetchAndExtract(url) {
    try {
        const response = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; ChatterboxScraper/1.0)" },
            timeout: 10000,
            maxRedirects: 5
        });

        const contentType = response.headers['content-type'];
        if (!contentType || !contentType.includes('text/html')) {
            return null;
        }

        const $ = cheerio.load(response.data);

        // Remove clutter
        $('script, style, noscript, header, footer, nav, iframe, form, aside, svg').remove();

        // Preserve structure: Add newlines to block elements
        $('br').replaceWith('\n');
        $('p, h1, h2, h3, h4, h5, h6, li, div, tr').each((i, el) => {
            $(el).append('\n');
        });

        let text = $('body').text();
        text = simpleClean(text);
        text = truncate(text);

        return text;

    } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        return null;
    }
}


export async function scrapeQuery(query, maxLinks = 5) {
    const links = await googleSearch(query, maxLinks);
    const results = [];


    const fetchPromises = links.map(async (item) => {
        const text = await fetchAndExtract(item.link);
        if (text) {
            results.push({
                title: item.title,
                link: item.link,
                snippet: item.snippet,
                text: text
            });
        }
    });

    await Promise.all(fetchPromises);
    return { query, count: results.length, results };
}
