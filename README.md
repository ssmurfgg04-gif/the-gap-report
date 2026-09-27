# The Gap Report — Global Landscape: Who Else Is Doing This?

A minimalist Swiss-style report website presenting a global competitive landscape
assessment of predictive early-warning systems for state abductions of activists
and journalists.

**The thesis it presents:** the pieces exist at eight different organizations —
but nobody has assembled them.

## What's inside

- **Hero** — executive summary with key stats
- **The Field** — the eight closest global players (Early Warning Project, ACLED CAST,
  HRDAG, Forensic Architecture, Amnesty Crisis Evidence Lab, Sentinel Project,
  Bellingcat, Conflict Archives), each with what they do, their scale, and the gap
- **The Matrix** — the definitive 8×8 capability gap analysis with a sticky first
  column and an accent-highlighted "This System" column
- **Analysis** — why nobody has built this, and what to learn (adopt / avoid) from each
- **Outlook** — why now, export potential, strategic partnerships, regional comparators
- **Verdict** — the bottom line and the four design resolutions

## Design system

- **Aesthetic:** Swiss minimalism — generous whitespace, near-black on white,
  a single restrained red accent, mono uppercase micro-labels, hairline borders
- **Typography:** Geist Sans + Geist Mono
- **Dark mode:** single-accent palette carried into a near-black theme
- **Responsive:** mobile-first; the capability matrix scrolls horizontally with a
  pinned sticky first column and scroll-state shadow
- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui ·
  Framer Motion

## Quality: VLM design review pipeline

The site was iteratively reviewed by a vision-language-model design reviewer across
**17 review rounds**, each scoring five features out of 8:

| Feature | Final score |
|---|---|
| Typography & visual hierarchy | 8/8 |
| Minimalist color discipline & contrast | 8/8 |
| Layout, grid & spacing | 8/8 |
| Component quality (matrix, accordion, nav) | 8/8 |
| Responsive & dark mode | 8/8 |

Evidence lives in [`docs/reviews/`](./docs/reviews) — the scored JSON from every
round, plus final-round screenshots (desktop, mobile, dark mode).

The review pipeline itself is in [`scripts/`](./scripts):
`capture.sh` (agent-browser screenshot sweep) and `vlm-review.mjs`
(VLM scoring with a strict evidence-based rubric).

## Run it

```bash
bun install
bun run dev   # http://localhost:3000
```
