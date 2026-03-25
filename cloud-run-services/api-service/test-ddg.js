import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function test() {
    try {
        const res = await fetch('https://html.duckduckgo.com/html/?q=Jananayagan', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        const results = [];
        $('.result').each((i, el) => {
            let link = $(el).find('.result__url').attr('href');
            if (link && link.includes('uddg=')) {
                try {
                    const urlObj = new URL('https:' + link);
                    link = decodeURIComponent(urlObj.searchParams.get('uddg'));
                } catch(e) {}
            }
            results.push({
                title: $(el).find('.result__title a').text().trim(),
                snippet: $(el).find('.result__snippet').text().trim(),
                link: link
            });
        });
        console.log("Length:", results.length);
        console.log(JSON.stringify(results.slice(0, 2), null, 2));
    } catch (e) {
        console.error("Error fetching", e);
    }
}
test();
