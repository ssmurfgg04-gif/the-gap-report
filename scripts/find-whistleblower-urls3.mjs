#!/usr/bin/env node
// Phase 3: slug guesses for punchng/citizen + WP search feeds for eastleighvoice/gazettengr/standard.
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' };

const guesses = [
  ['punchng', 'https://punchng.com/south-sudan-whistleblower-abducted-in-kenya-released-after-two-months/'],
  ['citizen.digital', 'https://citizen.digital/news/south-sudan-whistleblower-abducted-in-kenya-released-after-two-months-n0000000/'],
  ['eastleighvoice-feed', 'https://eastleighvoice.co.ke/?s=Al-Gaddhaffy&feed=rss2'],
  ['gazettengr-feed', 'https://gazettengr.com/?s=Al-Gaddhaffy&feed=rss2'],
  ['capitalfm-june', 'https://capitalfm.africa/rights-groups-demand-urgent-safeguards-for-businessman-reportedly-abducted-in-nairobi-and-moved-to-south-sudan/'],
  ['standard-q', 'https://www.standardmedia.co.ke/articlesearch?q=Al-Gaddhaffy'],
];

for (const [label, url] of guesses) {
  try {
    const r = await fetch(url, { headers: UA, redirect: 'follow' });
    const text = await r.text();
    console.log(`\n=== ${label} -> HTTP ${r.status} (final: ${r.url.slice(0, 90)}) ===`);
    if (label.endsWith('-feed')) {
      const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const it of items.slice(0, 6)) {
        const t = (it.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
        const l = (it.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
        console.log('   FEED:', l.trim().slice(0, 150), '|', t.slice(0, 70));
      }
      if (!items.length) console.log('   (no feed items)');
    } else if (/punchng|capitalfm/.test(label)) {
      const title = (text.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
      console.log('   PAGE TITLE:', title.slice(0, 120));
    } else {
      const links = [...new Set((text.match(/https?:\/\/[^\s"'<>\\]+/g) || []).filter(u => /gaddhaffy|whistle|abduct|south.?sudan/i.test(u) && !/google|facebook|gstatic|wp-content|wp-includes|\.css|\.js|\.png/i.test(u)))];
      for (const l of links.slice(0, 8)) console.log('   ', l.slice(0, 160));
      if (!links.length) console.log('   (no matching links)');
    }
  } catch (e) { console.log(`\n=== ${label} ERR: ${e.message}`); }
}
