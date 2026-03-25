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

export async function duckDuckGoSearch(query, maxLinks = 10) {
    try {
        const response = await fetch("https://lite.duckduckgo.com/lite/", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:102.0) Gecko/20100101 Firefox/102.0'
            },
            body: new URLSearchParams({ q: query }).toString(),
            timeout: 10000
        });

        const html = await response.text();
        const $ = cheerio.load(html);
        const results = [];

        $('.result-snippet').each((i, el) => {
            if (results.length >= maxLinks) return;
            const tr = $(el).closest('tr').prev();
            const a = tr.find('.result-link');
            if (a.length) {
                results.push({
                    title: a.text().trim(),
                    link: a.attr('href'),
                    snippet: $(el).text().trim()
                });
            }
        });

        if (results.length === 0) {
            results.push({
                link: "https://duckduckgo.com/?q=" + encodeURIComponent(query),
                title: "DuckDuckGo Search Results",
                snippet: "Perform a search on DuckDuckGo directly."
            });
        }
        
        return results;
    } catch (error) {
        console.error("DuckDuckGo HTML Scrape Error:", error.message);
        throw new Error(`DuckDuckGo scrape error: ${error.message}`);
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

export async function fetchOpenverseImages(query, count = 4) {
    try {
        const url = `https://api.openverse.org/v1/images/?format=json&q=${encodeURIComponent(query)}&page_size=${count}&image_type=photo&size=large&orientation=landscape&license_type=commercial&mature=false`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'ChatterBox/1.0' },
            timeout: 8000
        });
        if (!response.ok) throw new Error(`Openverse HTTP ${response.status}`);
        const data = await response.json();
        return (data.results || []).slice(0, count).map(img => ({
            url: img.url,
            title: img.title || '',
            creator: img.creator || '',
            license: img.license || '',
            thumbnail: img.thumbnail || img.url,
            source: img.foreign_landing_url || img.url
        }));
    } catch (error) {
        console.error('Openverse image fetch error:', error.message);
        return [];
    }
}

export async function scrapeQuery(query, engine = 'duckduckgo') {
    try {
        // Find top 10 results based on engine
        const allResults = engine === 'duckduckgo' 
            ? await duckDuckGoSearch(query, 10) 
            : await googleSearch(query, 10);
            
        const topResultsToScrape = allResults.slice(0, 3);
        const detailedResults = [];

        for (const res of topResultsToScrape) {
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
            results: detailedResults,
            allSources: allResults
        };
    } catch (error) {
        console.error("Scrape Query Error:", error.message);
        throw error;
    }
}
