#!/usr/bin/env node
// Phase 2: WordPress ?s= searches + slug guesses for direct article URLs.
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' };
const NAME = /gaddhaffy|al-?gaddhaffy|whistle.?blow|abducted|deport/i;

const targets = [
  ['capitalfm', 'https://www.capitalfm.co.ke/?s=Al-Gaddhaffy'],
  ['eastleighvoice', 'https://www.eastleighvoice.co.ke/?s=Al-Gaddhaffy'],
  ['gazettengr', 'https://gazettengr.com/?s=Al-Gaddhaffy'],
  ['thesudantimes', 'https://thesudantimes.com/?s=Al-Gaddhaffy'],
  ['bodexng', 'https://bodexng.com/?s=Al-Gaddhaffy'],
  ['gmtnewsng', 'https://gmtnewsng.com/?s=Al-Gaddhaffy'],
  ['thekenyandiaspora', 'https://thekenyandiaspora.com/?s=Al-Gaddhaffy'],
  ['tamazuj-slug', 'https://www.radiotamazuj.org/en/news/article/south-sudanese-man-abducted-in-kenya-released-after-two-months'],
  ['kenyans-slug-search', 'https://www.kenyans.co.ke/search/Al-Gaddhaffy'],
  ['citizen-tags', 'https://citizen.digital/searchresult?searchTerm=whistleblower%20released'],
];

for (const [label, url] of targets) {
  try {
    const r = await fetch(url, { headers: UA, redirect: 'follow' });
    const text = await r.text();
    const links = [...new Set((text.match(/https?:\/\/[^\s"'<>\\]+/g) || [])
      .filter(u => NAME.test(decodeURIComponent(u)))
      .filter(u => !/google|facebook|twitter|gstatic|\.css|\.js|\.png|\.svg|\.ico|fonts|wp-content|wp-includes/i.test(u)))];
    console.log(`\n=== ${label} (HTTP ${r.status}) ===`);
    for (const l of links.slice(0, 10)) console.log('  ', l.slice(0, 170));
    if (!links.length) console.log('   (no matching links)');
  } catch (e) { console.log(`\n=== ${label} ERR: ${e.message}`); }
}
