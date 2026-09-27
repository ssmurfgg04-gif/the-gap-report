# KAMPS Brand Identity

Kenya Abduction Monitoring and Prediction System. This document defines the visual identity: logo, state emblem, favicon, color, and typography. It is the reference for anyone adding UI or assets to the project.

## 1. Core idea

Near-black ink on a white field. One red accent. Geist Sans for text, Geist Mono for micro-labels. Hairline 1px borders, no gradients, no shadows, generous whitespace. The subject is grave, so the design carries no decoration. No emojis in any rendered text. No em dashes in any rendered text (use commas, colons, periods, or middle dots).

## 2. Logo

File: `public/logo.svg` (inline SVG, viewBox `0 0 260 64`, 707 bytes, valid XML).

Construction:
- Emblem: a 24 x 24 red square, fill `#C33524`, corners rounded 2px, with a white negative-space shield cut from its center. The shield reads as protection and monitoring; the cutout technique (figure removed from field) is the core geometric gesture of the brand.
- Wordmark: KAMPS, set in Geist with fallbacks "Helvetica Neue" and Arial, sans-serif. Weight 600, letter-spacing 0.08em, fill `#1A1A1A`.
- Descriptor: KENYA ABDUCTION MONITORING & PREDICTION SYSTEM, 7.5px, Geist Mono with fallbacks "SFMono-Regular" and Menlo, monospace. Letter-spacing 0.18em, fill `#6B6B6B`. The line carries `textLength="222"` so the 46-character descriptor always fits inside the 260-unit viewBox without clipping; rendering engines compress the inter-character spacing to fit, and the declared 0.18em tracking remains as the base value.

Usage:
- Minimum size: 28px height on screen. Below this the descriptor degrades into unreadable micro-type. In print, 10mm height.
- Clear space: keep a margin equal to one emblem-square width (24 units at design scale, the full width of the red square) free on all sides of the lockup. Nothing may intrude: no text, no rules, no imagery.
- Backgrounds: white or the #FAFAFA family in light mode, the dark canvas (`oklch(0.13 0 0)`) in dark mode.
- Never redraw, recolor, outline, add effects to, or rotate the emblem. Never substitute the Kenya coat of arms for the logo. The logo is the system's voice, not the state's.

## 3. Kenya coat of arms (state emblem)

- File: `public/kenya-coat-of-arms.svg`
- Type: SVG (vector)
- Size: 3,625,310 bytes (3.46 MB)
- Source: https://en.wikipedia.org/wiki/Special:FilePath/Coat_of_arms_of_Kenya_(Official).svg
- Fetch details: requested with user agent `KAMPS-research/1.0 (contact: research@example.org)`, HTTP 200 on the first attempt, no rate limiting encountered. Intrinsic viewBox `0 0 737.8322 694.97971`. SHA-256 `0498fd219e8c6448b454209ad4dae858e9c2ff790639b605c3a20b13cf8d50fe`.
- Fallback (not needed, documented for provenance): 960px PNG thumbnail at `https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Coat_of_arms_of_Kenya_(Official).svg/960px-Coat_of_arms_of_Kenya_(Official).svg.png`.

Status: the official state emblem of Kenya, public domain as an official insignia of a sovereign state.

Usage rules:
- Display unmodified. No recoloring, no cropping, no redraw, no filters, no re-composition.
- Respectful context only: About page and Report footer attribution. Never in interactive widgets, never as a logo substitute, never next to call-to-action controls.
- Always credit, adjacent to the emblem: "State emblem of Kenya, public domain."
- Minimum rendered height 48px so the heraldic detail reads.
- The emblem is a national symbol, not a brand asset. It signals jurisdiction and respect, not ownership. It must never imply state endorsement of KAMPS.

## 4. Favicon

Files:
- `src/app/icon.svg`: auto-served by the Next.js App Router as the site icon (rendered at 32px). 243 bytes.
- `src/app/apple-icon.png`: 180 x 180 apple touch icon. 500 bytes.

Rationale: the favicon reduces the logo emblem to essential geometry: a red 20 x 20 square with a white 8 x 8 negative-space square at its center, set on a white tile with 6px rounded corners. The negative-space cutout echoes the logo's shield aperture; the white tile keeps the mark legible on both light and dark browser tabs; the flat geometry (no gradients, no shadows, no anti-aliased softness beyond what the renderer supplies) matches the Swiss style. At 16px tab size the red field still reads as a solid mark with a visible core.

## 5. Color

Accent, the only accent:
- oklch: `oklch(0.553 0.203 26.5)` (CSS variable `--accent-ink`)
- hex: `#C33524`
- rgb: `rgb(195, 53, 36)`
- Dark mode lift (already defined in globals.css): `oklch(0.68 0.17 26.5)`

Neutrals:
- Foreground ink: `oklch(0.145 0 0)`, near black. The logo wordmark uses a softened `#1A1A1A`.
- Canvas: white in light mode (`oklch(1 0 0)` as implemented; the #FAFAFA family is acceptable), `oklch(0.13 0 0)` in dark mode.
- Secondary ink: `#6B6B6B` for the logo descriptor; `oklch(0.5 0 0)` for muted UI text.
- Borders: hairline 1px, `oklch(0.915 0 0)`.

The one-accent rule:
- Red is the only accent color in the entire product. It is reserved for what matters: alert states, the THIS SYSTEM column rule, text selection, key punctuation spans, and the emblem square of the logo.
- No blues, greens, purples, oranges, and no second reds as accents. The chart palette (chart-1 through chart-5 in globals.css) exists for data series only; where a single highlight is needed, use the red.
- Never tint, shade, or gradient the accent. It is flat, or it is absent.

## 6. Typography

- Sans, UI and body: Geist Sans loaded through next/font as `--font-geist-sans`. Fallback stack: "Helvetica Neue", Arial, sans-serif.
- Mono, micro-labels and data: Geist Mono loaded through next/font as `--font-geist-mono`. Fallback stack: "SFMono-Regular", Menlo, monospace.
- Micro-labels are uppercase, small, and widely tracked. 0.18em is the house tracking value.
- Logo wordmark: weight 600, tracking 0.08em.
- Body line-height 1.6 (set globally in globals.css).

## 7. Hard rules

1. One accent only: the red defined above.
2. No gradients. No shadows. No glows.
3. Hairline 1px borders only.
4. Generous whitespace. When in doubt, add space.
5. No emojis anywhere in rendered text.
6. No em dashes in rendered text. Use commas, colons, periods, or middle dots.
7. The Kenya coat of arms stays unmodified and credited wherever it appears.
