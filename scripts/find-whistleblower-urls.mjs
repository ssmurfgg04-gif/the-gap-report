#!/usr/bin/env node
// Hunt direct article URLs for the Athorbey Al-Gaddhaffy-Dit whistleblower case
// via outlet site-search endpoints + Google News RSS search (source attribution).
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' };

const targets = [
  ['kenyans search', 'https://www.kenyans.co.ke/search?query=Al-Gaddhaffy'],
  ['standard search', 'https://www.standardmedia.co.ke/segmentsearch?keyword=Al-Gaddhaffy'],
  ['citizen search', 'https://citizen.digital/search?q=Al-Gaddhaffy'],
  ['tamazuj search', 'https://www.radiotamazuj.org/en/search?keyword=Al-Gaddhaffy'],
  ['gnrss full', 'https://news.google.com/rss/search?q=%22Al-Gaddhaffy-Dit%22+when:90d&hl=en&gl=KE&ceid=KE:en'],
];

for (const [label, url] of targets) {
  try {
    const r = await fetch(url, { headers: UA, redirect: 'follow' });
    const text = await r.text();
    const links = [...new Set((text.match(/https?:\/\/[^\s"'<>\\]+/g) || [])
      .filter(u => /gaddhaffy|whistle.?blow|south.?sudan|abduct/i.test(u) || (label === 'gnrss full' && u.includes('/rss/articles/')))
      .filter(u => !/google|facebook|twitter|instagram|gstatic|\.css|\.js|\.png|\.svg|font/i.test(u))
    )];
    console.log(`\n=== ${label} (HTTP ${r.status}) ===`);
    for (const l of links.slice(0, 8)) console.log('  ', decodeURIComponent(l).slice(0, 160));
    if (label === 'gnrss full') {
      // also dump RSS item titles+source for context
      const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const it of items.slice(0, 10)) {
        const t = (it.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
        const src = (it.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';
        const d = (it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
        console.log('   RSS:', d, '|', src, '|', t.slice(0, 90));
      }
    }
  } catch (e) { console.log(`\n=== ${label} ERR: ${e.message}`); }
}
