import { fetchAndExtract } from './utils/scraper.js';

async function test() {
    const url = "https://example.com"; // You can change this to a real URL if needed, but example.com is good for basic structure check
    console.log(`Testing extraction for: ${url}`);

    const content = await fetchAndExtract(url);

    if (content) {
        console.log("--- Extracted Content Start ---");
        console.log(content);
        console.log("--- Extracted Content End ---");

        if (content.includes("Example Domain")) {
            console.log("SUCCESS: Found expected content.");
        } else {
            console.log("WARNING: Expected content not found (might be dynamic or blocked).");
        }

    } else {
        console.log("FAILED: No content extracted.");
    }
}

test();
