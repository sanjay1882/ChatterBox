import axios from 'axios';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

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
        throw new Error(`Custom Search API error: ${error.details || error.message}`);
    }
}

function cleanText(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();
}

export async function fetchAndExtract(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 8000
        });

        if (!response.ok) {
            return { error: `HTTP ${response.status}` };
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove script, style, nav, header, footer, etc.
        $('script, style, nav, header, footer, aside, .sidebar, .ad, .advertisement').remove();

        const title = $('title').text() || '';
        let content = '';

        // Prioritize article content if it exists
        if ($('article').length > 0) {
            content = $('article').text();
        } else {
            content = $('body').text();
        }

        content = cleanText(content);
        // Truncate to avoid massive tokens per page
        if (content.length > 5000) {
            content = content.slice(0, 5000) + '...';
        }

        return { title, content };
    } catch (error) {
        return { error: error.message };
    }
}

export async function scrapeQuery(query) {
    try {
        // Find top 3 results
        const results = await googleSearch(query, 3);
        const detailedResults = [];

        for (const res of results) {
            try {
                const scraped = await fetchAndExtract(res.link);
                detailedResults.push({
                    title: res.title,
                    link: res.link,
                    snippet: res.snippet,
                    content: scraped.content || (`Scrape failed: ${scraped.error}`)
                });
            } catch (e) {
                detailedResults.push({
                    title: res.title,
                    link: res.link,
                    snippet: res.snippet,
                    content: `Scrape error: ${e.message}`
                });
            }
        }

        return {
            query,
            results: detailedResults
        };
    } catch (error) {
        console.error("Scrape Query Error:", error.message);
        throw error;
    }
}
