# AP News — Performance Audit Report (Course Project)

**Course:** FE413 — Web Performance
**Project type:** Course Project (collective audit over ~3 weeks)
**Audit target:** [AP News](https://apnews.com/)
**Status:** HW10 complete — Stakeholder-focused presentation update (`presentation.html` + `presentation.md`). 9 slides aimed at product leadership: bottom line up front, business impact (readers leaving, search ranking, /donate conversion, brand), diagnosis with evidence, what's already working, ranked fixes, phase plan, cost of inaction, the ask.

---

## TL;DR

Every audited page on apnews.com fails the Lighthouse mobile performance threshold.
The cause is structural: **8 third-party scripts consume 12 s of main-thread time before the headline image paints.** None of them is required to render a news article.

- All 8 pages scored **24–26 / 100** performance (Lighthouse mobile, simulated 4G)
- Median **LCP 22–46 s** (Google's "good" threshold is 2.5 s)
- **TBT 5–9 s** on every page — scrolls are visibly janky on mid-range Android
- **/donate** has CLS of **0.8** (Google's "good" is <0.1)
- Homepage cold-load: **662 requests, 8.15 MB transfer, 24.94 MB uncompressed, 67.3% compression savings**
- Homepage soft-refresh: **~0% transfer savings** — cache benefit eaten by third-party re-fetches

Six front-end fixes ranked by **three independent frameworks** (RICE + ICE + WSJF). Four are top-tier in all 3 systems and ship in phase 1 (week 1) — no backend rebuild required.
See `prioritization.md` for the triangulation and `presentation.html` for the 9-slide pitch deck.

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

## Lighthouse mobile scores (per page)

*Captured 2026-07-23, Lighthouse CLI v12, mobile preset, simulated 4G throttling, headless Chromium 150, fresh profile per run, cookies pre-accepted. Per-page raw reports in `lighthouse/*.json`.*

| # | Page | Perf | LCP | CLS | TBT | FCP | TTI |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | Homepage | **25** | 46.4 s | 0.026 | 6.95 s | 7.2 s | 62.0 s |
| 2 | World News | **25** | 21.9 s | 0.001 | 6.37 s | 6.2 s | 47.3 s |
| 3 | Single article | **24** | 32.4 s | 0.069 | 8.95 s | 7.7 s | 58.4 s |
| 4 | Photography | **26** | 37.4 s | 0.001 | 6.07 s | 5.8 s | 48.9 s |
| 5 | Quizzes | **26** | 34.4 s | 0.001 | 5.93 s | 5.0 s | 44.5 s |
| 6 | Donate | **2** | 29.8 s | **0.800** | 5.88 s | 7.1 s | 36.8 s |
| 7 | Search | **26** | 33.5 s | 0.001 | 5.96 s | 5.6 s | 44.3 s |
| 8 | Newsletters | **25** | 31.3 s | 0.001 | 5.13 s | 12.5 s | 45.2 s |

**Median across the 8 audited pages:** Perf **25**, LCP **33 s**, CLS **0.001**, TBT **6.0 s**.
**All 8 pages score "poor" (Lighthouse flag = score < 50).** `/donate` scores 2 because of CLS 0.8 (8× the "good" threshold).

**CrUX field data (origin level, last 28 days):** not captured — lab evidence only. Recommended next step in `findings.md` (appendix).
**Methodology, full per-audit breakdown, and caveats** — see `baseline.md`.

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
- `baseline.md` — Mobile measurement profile + CWV + PSI + Network Activity + Build outputs (JS/CSS bundles, image formats, 3P loading strategy). Per-page sweep across 8 archetypes.
- `findings.md` — 20 main corrective + 2 good findings across Rendering (5) / Networking (4 corrective + 2 good) / Accessibility (1) / Build outputs (4) / Coverage & frames (3) / Rendering strategies (3), plus 2 mobile-specific findings and 6 appendix findings. Each independently observable, RICE-scored.
- `prioritization.md` — Three-framework scoring: RICE + ICE (with derivation rule) + WSJF (SAFe). 21 findings + 6 appendix scored in all 3 systems; triangulation narrows Phase 1 to 4 items.
- `presentation.html` — 9-slide stakeholder presentation (Reveal.js + Tailwind, paper/cobalt palette). Business impact framing for product leadership.
- `presentation.md` — Same stakeholder content as `presentation.html`, in markdown for review and sharing.
- `lighthouse/*.json` — raw Lighthouse reports for all 8 pages.
- `screenshots/*.png` — viewport screenshots of all 8 pages (consent pre-accepted).
- `justfile` — automation: `just setup` · `just audit-all` · `just shoot` · `just present` · `just report` · `just build-capture` · `just coverage-frames` · `just rendering-strategy`.
- `scripts/setup-profile.js` — puppeteer-driven OneTrust consent acceptance.
- `scripts/build-capture.mjs` — inspect homepage build outputs (JS/CSS bundles, image formats, 3P loading strategy, source-map exposure, unused-JS via coverage API).
- `scripts/coverage-frame-capture.mjs` — critical-CSS check, unused JS/CSS attribution, frame chart (load/scroll/click), layers & animations introspection.
- `scripts/rendering-strategy.mjs` — detect rendering strategy per page (HTML-before-JS, response headers, framework markers).
- `scripts/targets.tsv` — the 8 audited pages.

## Methodology references

- PageSpeed Insights scores: per Day 3 clean-state checklist
- Core Web Vitals (LCP / CLS / INP / FCP / TTFB): per Day 3 §2
- Network Activity (requests / transfer / cache / compression): per Day 4
- CrUX field data: per Day 14 auditor's seat (not captured this run)
- Rendering strategy fingerprint: per Day 12 §5
- Building pipeline / bundle: per Day 7
- Hydration profile: per Day 12 §3
- Prioritization (RICE): per Day 5

---

**Course:** FE413 — Web Performance · **Instructor:** Christopher J Baker
**Repo:** [github.com/esauflores/apnews-audit](https://github.com/esauflores/apnews-audit)
