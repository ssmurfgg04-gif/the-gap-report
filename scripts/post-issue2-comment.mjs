#!/usr/bin/env node
// Post the whistleblower verification comment to issue #2 via the GitHub API.
const TOKEN = process.env.GH_TOKEN;
const ISSUE = 2;
const REPO = "ssmurfgg04-gif/the-gap-report";

const body = `## Curator queue: South Sudanese whistleblower verified and promoted

The next-ready case flagged in this queue (the South Sudanese whistleblower, 2 corroborating outlets at sweep time) was verified on 2026-09-28 and promoted into the documented record. The documented count moves **241 → 242** (county-located: 207 → 208; engine guard re-run clean: Nairobi zone stable at index 86.5, 5 critical / 10 elevated, full-mode regression anchor updated with lineage).

### 3. Athorbey Al-Gaddhaffy-Dit — abducted Nairobi 2026-06-10, released 2026-08-08

Queue candidates: Radio Tamazuj, Punch Newspapers (2026-08-10). Verification ([Radio Tamazuj](https://www.radiotamazuj.org/en/news/article/south-sudanese-man-abducted-in-kenya-released-after-two-months), [Capital FM Kenya](https://capitalfm.africa/south-sudan-whistleblower-athorbey-released-after-nearly-two-months-in-detention/), [Punch/AFP](https://punchng.com/south-sudan-whistleblower-abducted-in-kenya-released-after-two-months/), [The Eastleigh Voice](https://www.eastleighvoice.co.ke/2026/08/11/whistleblower-released-following-abduction-and-deportation-to-juba/), [BodexNG](https://bodexng.com/2026/08/south-sudan-whistleblower-abducted-in-kenya-released-after-two-months/), plus the 12 June abduction report at [Capital FM Kenya](https://capitalfm.africa/rights-groups-demand-urgent-safeguards-for-businessman-reportedly-abducted-in-nairobi-and-moved-to-south-sudan/) — all HTTP-200; Reuters, Citizen Digital, Standard, Ghanaian Times and Peoples Gazette also carried the story):

Nairobi-based businessman and South Sudan graft whistleblower (full name Athorbey Al-Gaddhaffy-Dit Guet, also known as Gaddafi, aged 51, Kenyan–South Sudanese dual national from Jonglei) had repeatedly warned that his life was in danger for exposing corruption linked to South Sudan's ruling elite. Abducted at gunpoint by armed, masked men at about 03:00 on Wednesday 10 June 2026 as he left a casino in Nairobi, per information his wife received from police; unlawfully deported to South Sudan and held at a military detention facility in Juba for nearly two months. Amnesty International Kenya publicly demanded urgent safeguards on 12 June 2026. Released on 8 August 2026 after investigations "did not reveal any wrongdoing" (family statement); returned to Nairobi with deteriorated health, receiving medical treatment. Amnesty Kenya announced his return on 11 August 2026 and demanded a transparent investigation and accountability.

Record entry: \`gaddhaffy-2026-08-08\` (status: returned, category: abduction, location: Nairobi (abduction); Juba, South Sudan (detention)) with the corroboration trail in its notes.

### Queue housekeeping

- Queue watcher hardening: promoted/rejected cases now keep their verified fields (person, outlets, corroboration, HTTP-200 URLs) across sweeps instead of being rebuilt from feed hints; dry-run digests no longer print a misleading "state snapshot updated" message.
- Queue state: **0 cases one-verification-away**, 2 single-source leads pending (Mandera herders freed by elders, DCP blogger), 6 held out as already-documented, 3 promoted all-time.
- Tuesday's digest will headline **242 documented incidents (+3 since the 239 snapshot of 2026-09-27)**, promoted this week: Otieno, Mulinge, Gaddhaffy. The partner webhook ping fires right after this issue is filed — the \`DIGEST_WEBHOOK_URL\` repo secret is still unset, so ping a repo admin with your Slack/Discord/generic webhook URL to switch it on (setup in README, "Partner webhooks (opt-in)").`;

const res = await fetch(`https://api.github.com/repos/${REPO}/issues/${ISSUE}/comments`, {
  method: "POST",
  headers: {
    "Authorization": `token ${TOKEN}`,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "the-gap-report-curator",
  },
  body: JSON.stringify({ body }),
});
const j = await res.json();
console.log(res.status, j.html_url ?? j.message);
