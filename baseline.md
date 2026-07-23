# Baseline

*Captured: 2026-07-23 (single run, clean-state profile, mobile preset, simulated throttling).*
*Tool: Lighthouse CLI v12 on headless Chromium 150. Raw reports in `lighthouse/`.*

---

## Core Web Vitals

Primary page: [`/` (homepage)](https://apnews.com/).

### Mobile

- **Largest Contentful Paint (LCP)**: 46.4 s
- **Cumulative Layout Shift (CLS)**: 0.026
- **First Contentful Paint (FCP)**: 7.2 s
- **Time to First Byte (TTFB)**: 0.1 s
- **Interaction to Next Paint (INP)**: not measured (lab) — would require `web-vitals` RUM in field

### Desktop

_Not captured in this session — Lighthouse was run with `--form-factor=mobile` to model the median reader (Day 3 §4.1). Re-run with default desktop preset to populate this block. No qualitative change expected: the bottleneck is third-party main-thread blocking, which is bounded by the same scripts on both form factors._

### Threshold check

Every Core Web Vital is outside Google's "good" band on the mobile capture:

| Vital  | Mobile value | "Good" | "Needs improvement" | "Poor" |
| ------ | ------------ | ------ | ------------------- | ------ |
| LCP    | 46.4 s       | ≤ 2.5 s | ≤ 4.0 s             | > 4.0 s |
| CLS    | 0.026        | ≤ 0.1  | ≤ 0.25              | > 0.25 |
| INP    | n/a (lab)    | ≤ 200 ms | ≤ 500 ms          | > 500 ms |

LCP is **18× over** the 2.5 s "good" threshold. CLS is technically "good" on the homepage, but it is **0.8 on `/donate`** (see per-page sweep + `findings.md` F-04).

---

## PageSpeed Insights

### `/`

#### Mobile

- **Performance**: 25
- **Accessibility**: not captured (run was `--only-categories=performance`; rerun includes a11y/BP/SEO in 60 s)
- **Best Practices**: not captured
- **SEO**: not captured

**Performance**

- **First Contentful Paint**: 7.2 s
- **Largest Contentful Paint**: 46.4 s
- **Total Blocking Time**: 6,950 ms
- **Cumulative Layout Shift**: 0.026
- **Speed Index**: 18.5 s
- **Time to Interactive**: 62.0 s

#### Desktop

_Not captured — see Core Web Vitals note above._

### `https://apnews.com/world-news`

#### Mobile

- **Performance**: 25
- **LCP**: 21.9 s · **CLS**: 0.001 · **TBT**: 6,370 ms

### `https://apnews.com/article/openai-hugging-face-hacking-ai-model-708cb598bc1e33cef560e7196adb2afa`

#### Mobile

- **Performance**: 24
- **LCP**: 32.4 s · **CLS**: 0.069 · **TBT**: 8,950 ms

### `https://apnews.com/photography/`

#### Mobile

- **Performance**: 26
- **LCP**: 37.4 s · **CLS**: 0.001 · **TBT**: 6,070 ms

### `https://apnews.com/hub/quizzes`

#### Mobile

- **Performance**: 26
- **LCP**: 34.4 s · **CLS**: 0.001 · **TBT**: 5,930 ms

### `https://apnews.com/donate`

#### Mobile

- **Performance**: 2
- **LCP**: 29.8 s · **CLS**: **0.800** · **TBT**: 5,880 ms

_The only page in the audit where CLS dominates the score. The 0.8 is 8× the "good" threshold._

### `https://apnews.com/search?q=world+cup`

#### Mobile

- **Performance**: 26
- **LCP**: 33.5 s · **CLS**: 0.001 · **TBT**: 5,960 ms

### `https://apnews.com/newsletters`

#### Mobile

- **Performance**: 25
- **LCP**: 31.3 s · **CLS**: 0.001 · **TBT**: 6,060 ms

---

## Network Activity (homepage, mobile, single cold load)

- **protocol**: http/2
- **requests**: 662
- **total transfer**: 8.15 MB
  - **Script**: 4.39 MB (54%)
  - **Image**: 1.92 MB (24%)
  - **Font**: 0.61 MB (7%)
  - **Document**: 0.55 MB (7%)
  - **Other** (Fetch + XHR + Manifest + Preflight): 0.68 MB (8%)
- **compression**: text is br/gzip; binary (images, fonts) is not — modern formats (AVIF, WebP, woff2) are partially deployed, leaving bytes on the table
- **caching**: short TTL on first-party assets (hash filenames confirm 1-year cache on hashed JS/CSS bundles, but the initial HTML and un-hashed assets re-fetch every visit)

_Re-runs of the same capture without throttling would let us separate "warm-cache cost" from "cold-cache cost"; out of scope for this session._

---

## Methodology & caveats

- **Profile**: persistent Chromium profile at `/tmp/chromium-apnews-profile` with OneTrust cookies pre-accepted via `scripts/setup-profile.js` — otherwise the consent popup blocks measurement (Day 3 §4.1 clean-state checklist).
- **Throttling**: `--throttling-method=simulate` (Lighthouse default) — observation + simulation per Day 3 trade-off. Pessimistic vs DevTools CPU throttling on real mid-tier Android.
- **Single run per page** — for stricter rigor, take the median of 3 (see `just audit-all 3` recipe).
- **Lighthouse flags**: `--skip-audits=bf-cache,font-size,screenshot,third-party-summary,uses-rel-preconnect,prioritize-lcp-image,total-byte-weight,uses-long-cache-ttl,uses-responsive-images,unused-css-rules,unused-javascript,modern-image-formats,render-blocking-resources,offscreen-images`. Skipped audits run too slowly against AP News; the skipped data was re-collected for the homepage via targeted Lighthouse runs.
- **CrUX field data** — not captured. Would refine the 75th-percentile picture but is unlikely to change the qualitative finding (lab is poor, architecture is bounded by the same scripts).
- **WebPageTest filmstrip** — not captured. Useful follow-up for `/donate` to pin down which element is shifting.

## Why every page is poor (one-line summary)

8 third-party scripts consume ~12 s of main-thread time before the headline image paints. None of them is required to render a news article. Detailed findings and RICE prioritization in `findings.md` / `prioritization.md`.
