import { fetchOpenverseImages } from './utils/scraper.js';

// Test detectioin logic (copy from controller)
function shouldFetchImages(message) {
    const lower = message.toLowerCase().trim();
    const visualTriggers = [
        /^who is /i, /^who was /i, /^tell me about /i, /^what is /i, /^what are /i,
        /^show me /i, /^describe /i, /^explain .*(place|city|country|landmark|person|actor|singer|politician|monument|temple|building)/i,
        /^where is /i, /^history of /i, /^about /i
    ];
    return visualTriggers.some(r => r.test(lower));
}

function extractImageQuery(message) {
    return message
        .replace(/^(who is|who was|tell me about|what is|what are|show me|describe|where is|history of|about)/i, '')
        .replace(/[?!.,]/g, '')
        .trim()
        .slice(0, 100);
}

const testQueries = [
    "Tell me about the Eiffel Tower",
    "Who is Albert Einstein?",
    "What is the Taj Mahal?",
    "Write me Python code",
    "2 + 2 = ?"
];

for (const q of testQueries) {
    console.log(`\nQuery: "${q}"`);
    console.log(`  shouldFetchImages: ${shouldFetchImages(q)}`);
    console.log(`  extractImageQuery: "${extractImageQuery(q)}"`);
}

console.log('\n--- Testing Openverse API ---');
const imgs = await fetchOpenverseImages('Eiffel Tower', 3);
console.log('Images returned:', imgs.length);
imgs.forEach((img, i) => console.log(`  [${i+1}] ${img.title} | url: ${img.url.slice(0, 60)}...`));
