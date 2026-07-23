# AP News — Performance Audit Report (Course Project)

**Course:** FE413 — Web Performance
**Project type:** Course Project (collective audit over ~3 weeks)
**Audit target:** [AP News](https://apnews.com/)
**Status:** Complete — baseline captured, 15 findings ranked by RICE, 3-phase rollout plan

---

## TL;DR

Every audited page on apnews.com fails the Lighthouse mobile performance threshold.
The cause is structural: **8 third-party scripts consume 12 s of main-thread time before the headline image paints.** None of them is required to render a news article.

- All 8 pages scored **24–26 / 100** performance (Lighthouse mobile, simulated 4G)
- Median **LCP 22–46 s** (Google's "good" threshold is 2.5 s)
- **TBT 5–9 s** on every page — scrolls are visibly janky on mid-range Android
- **/donate** has CLS of **0.8** (Google's "good" is <0.1)
- Total page weight: **9.1 MB** on first load

Six fixes ranked by RICE. Five of them ship in phase 1 (week 1), no backend rebuild required.
See `presentation.html` for the 9-slide pitch deck.

## The site

**Name:** AP News (Associated Press)
**URL:** [https://apnews.com/](https://apnews.com/)

## Why this is a good candidate for an audit

AP News is a strong audit target for several reasons:

- **High-traffic, real-world scale** — one of the largest US news outlets, with global reach and breaking-news traffic spikes.
- **Wide variety of content and features** — article pages, photo galleries, video hubs, interactive quizzes, newsletters, search, donation flows, Spanish-language edition. Per the course requirements, the site must include static + dynamic + auth + images + data fetching + CDNs (day 1, §5.2.1).
- **Mixed rendering and content strategies** — static hub pages, dynamic article bodies, real-time search, interactive content, conversion funnels. Different page types exercise different parts of the rendering pipeline (day 12).
- **Image-heavy** — hero images, photo galleries, inline article photos. LCP candidates are almost always images (day 3, §2.1). Image format, sizing, and lazy-loading choices will materially affect metrics.
- **Ad-supported plus donation-supported** — multiple third-party scripts, tag managers, and analytics calls; revenue depends on both ad viewability and donation conversion.
- **Publicly accessible, no auth required** — easy to capture PageSpeed Insights, WebPageTest, and CrUX data.
- **Owned by the Associated Press, not a personal project** — recommendations are addressed to an organization that actually ships changes.
- **The same template serves many section hubs** — a finding on World News generalizes to Politics, Sports, Business, etc.

## Main PageSpeed Insights scores

*Captured 2026-XX-XX, simulated mid-tier mobile (Slow 4G + 4× CPU), median of 3 runs per clean-state checklist.*

| Metric | Mobile | Desktop |
|---|---|---|
| Performance score | TBD | TBD |
| LCP (p75) | TBD | TBD |
| CLS (p75) | TBD | TBD |
| INP (p75, field) | TBD | TBD |
| TBT | TBD | — |
| Total Blocking Time | TBD | — |
| Speed Index | TBD | — |

**CrUX field data (origin level, last 28 days):** TBD — pulled from PageSpeed Insights field panel.
**Methodology** — see `baseline.md`.

## Target pages

The audit focuses on **8 pages** chosen to cover the breadth of page types AP News serves.

### 1. Homepage — [https://apnews.com/](https://apnews.com/)
The highest-traffic entry point and the page Google indexes most aggressively. **Why include:** LCP-critical (hero story image usually the largest element); mixed content above the fold (text, image, navigation); exercises every primary section header; baseline data will generalize to most news sites.

### 2. World News section — [https://apnews.com/world-news](https://apnews.com/world-news)
A section hub, one of ~12 that share a common template. **Why include:** Tests the section template at scale (every section hub uses the same shell — a finding here generalizes to Politics, Sports, Business, etc.). Hub pages also have a different LCP profile than articles (lists, not a single hero).

### 3. Single article — [https://apnews.com/article/openai-hugging-face-hacking-ai-model-708cb598bc1e33cef560e7196adb2afa](https://apnews.com/article/openai-hugging-face-hacking-ai-model-708cb598bc1e33cef560e7196adb2afa)
The canonical reader landing. **Why include:** This is the most common user reading path; article bodies drive the majority of time-on-site. Hero image is the LCP element; in-article media (videos, embedded tweets, photo galleries) test the lazy-load and CLS story.

### 4. Photography hub — [https://apnews.com/photography/](https://apnews.com/photography/)
Image-heavy content. **Why include:** Photography pages are exactly the case where format (JPEG vs WebP vs AVIF), sizing, and lazy-loading decisions have outsized impact. Also tests CLS from images without reserved dimensions — a recurring day-2 anti-pattern.

### 5. Quizzes hub — [https://apnews.com/hub/quizzes](https://apnews.com/hub/quizzes)
Interactive content. **Why include:** Tests the JS bundle and INP profile of an interactive page. Different content type from articles; hydration cost, event-handler overhead, and animation choices all apply (day 8, day 11).

### 6. Donate page — [https://apnews.com/donate](https://apnews.com/donate)
Conversion-critical flow. **Why include:** Different layout and content (no news feed, focused on conversion). Tests a form-heavy page where the conversion path matters — payment integrations, third-party scripts, and tracking pixels can dominate the main-thread budget.

### 7. Search results — [https://apnews.com/search?q=world+cup](https://apnews.com/search?q=world+cup)
Dynamic content driven by query string. **Why include:** Application waterfall risk (day 11) — the page often fetches search results, then re-renders with recommendations; classic over-fetching pattern. Also tests query-parameter caching and stale-data CLS.

### 8. Newsletters signup — [https://apnews.com/newsletters](https://apnews.com/newsletters)
Lightweight landing for newsletter signups. **Why include:** A small, mostly-static page — the natural contrast to the JS-heavy article and hub pages. A healthy site should be fast on these; if it isn't, the gap is diagnostic.

---

## What's in this repo

- `README.md` — this file
- `baseline.md` — methodology + raw measurements + CrUX field data
- `findings.md` — full findings list with evidence, interpretation, impact, recommendation (per day 13)
- `prioritization.md` — RICE-scored list with the recommended sequencing
- `presentation.html` — 9-slide pitch deck (Reveal.js + Tailwind, paper/cobalt palette)
- `lighthouse/*.json` — raw Lighthouse reports for all 8 pages
- `screenshots/*.png` — viewport screenshots of all 8 pages (consent pre-accepted)
- `justfile` — automation: `just setup` (profile) · `just audit-all` (full sweep)
- `scripts/setup-profile.js` — puppeteer-driven consent acceptance
- `scripts/targets.tsv` — the 8 audited pages

## Methodology references

- PageSpeed Insights scores: per day 3 clean-state checklist
- CrUX field data: per day 14 auditor's seat
- Rendering strategy fingerprint: per day 12 §5
- Building pipeline / bundle: per day 7
- Hydration profile: per day 12 §3
- Prioritization (RICE): per day 5

---

**Course:** FE413 — Web Performance · **Instructor:** Christopher J Baker
