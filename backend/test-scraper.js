import dotenv from 'dotenv';
import { googleSearch, fetchAndExtract, scrapeQuery } from './utils/scraper.js';

dotenv.config();
dotenv.config({ path: './Python-scripts/.env' });

async function test() {
    console.log("Testing scraper...");

    const relevantKeys = Object.keys(process.env).filter(k => k.includes('API') || k.includes('KEY') || k.includes('CX') || k.includes('ID'));
    console.log("DEBUG: Relevant Env Keys:", relevantKeys);

    if (!process.env.API_KEY_SE || !process.env.CX_ID) {
        console.error("Missing env vars!");
        // process.exit(1); 
        // Don't exit, maybe we can test fetch at least?
    }

    try {
        console.log("\n1. Testing Google Search (Query: 'Node.js latest version')...");
        const searchResults = await googleSearch("Node.js latest version", 2);
        console.log("Search Results:", searchResults);

        if (searchResults.length > 0) {
            console.log("\n2. Testing Fetch (URL: " + searchResults[0].link + ")...");
            const text = await fetchAndExtract(searchResults[0].link);
            console.log("Fetched Text Preview:", text ? text.substring(0, 200) + "..." : "Failed to fetch");
        }

        console.log("\n3. Testing Scrape Query (Combined)...");
        const scrapeRes = await scrapeQuery("OpenAI ChatGPT news", 2);
        console.log("Scrape Results Count:", scrapeRes.count);
        console.log("First Result Snippet:", scrapeRes.results[0]?.snippet);

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

test();
