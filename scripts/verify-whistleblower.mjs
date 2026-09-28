#!/usr/bin/env node
// Phase 4: HTTP-200 verify all candidate article URLs + extract story facts.
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' };

const urls = [
  'https://www.radiotamazuj.org/en/news/article/south-sudanese-man-abducted-in-kenya-released-after-two-months',
  'https://capitalfm.africa/south-sudan-whistleblower-athorbey-released-after-nearly-two-months-in-detention/',
  'https://capitalfm.africa/rights-groups-demand-urgent-safeguards-for-businessman-reportedly-abducted-in-nairobi-and-moved-to-south-sudan/',
  'https://punchng.com/south-sudan-whistleblower-abducted-in-kenya-released-after-two-months/',
  'https://bodexng.com/2026/08/south-sudan-whistleblower-abducted-in-kenya-released-after-two-months/',
  'https://eastleighvoice.co.ke/whistleblower-released-following-abduction-and-deportation-to-juba/',
  'https://www.eastleighvoice.co.ke/2026/08/11/whistleblower-released-following-abduction-and-deportation-to-juba/',
  'https://www.reuters.com/world/africa/south-sudan-whistleblower-released-after-nearly-two-months-detention-2026-08-10/',
];

for (const url of urls) {
  try {
    const r = await fetch(url, { headers: UA, redirect: 'follow' });
    const text = await r.text();
    const title = ((text.match(/<title>([^<]*)<\/title>/i) || [])[1] || '').trim();
    const clean = text.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#8217;|&rsquo;/g, "'").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
    const idx = clean.toLowerCase().indexOf('gaddhaffy');
    const fact = idx >= 0 ? clean.slice(Math.max(0, idx - 250), idx + 500) : '(name not found in body)';
    console.log(`\n=== ${r.status} ${url}`);
    console.log('    TITLE: ' + title.slice(0, 130));
    console.log('    FACTS: ' + fact.slice(0, 700));
  } catch (e) { console.log(`\n=== ERR ${url} :: ${e.message}`); }
}
