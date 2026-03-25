import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function test() {
    try {
        const res = await fetch('https://lite.duckduckgo.com/lite/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:102.0) Gecko/20100101 Firefox/102.0'
            },
            body: new URLSearchParams({ q: 'Jananayagan Meaning and Cast' }).toString()
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        const results = [];
        $('.result-snippet').each((i, el) => {
            const tr = $(el).closest('tr').prev();
            const a = tr.find('.result-link');
            if (a.length) {
                results.push({
                    title: a.text().trim(),
                    link: a.attr('href')
                });
            }
        });
        console.log("Length for generic query:", results.length);
        console.log("First 3 links:", results.slice(0, 3).map(r => r.link));
    } catch(e) {
        console.error("Error:", e);
    }
}
test();
