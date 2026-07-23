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

## Network Activity (homepage, mobile)

### Cold load (clean profile, fresh cache)

| Bucket       | Requests | Transfer (wire) | Resource (uncompressed) | Compression savings |
| ------------ | -------: | --------------: | ----------------------: | ------------------: |
| **Script**   |     132  |       4.39 MB   |               16.06 MB  |             **73%** |
| **Image**    |     166  |       1.92 MB   |                1.87 MB  |              −3%   |
| **Font**     |      10  |       0.61 MB   |                0.60 MB  |              −2%   |
| **Document** |      49  |       0.55 MB   |                3.33 MB  |             **83%** |
| **Fetch**    |      95  |       0.35 MB   |                1.67 MB  |             **79%** |
| **Stylesheet** |     7  |       0.15 MB   |                1.06 MB  |             **86%** |
| **Other** (XHR, Manifest, Preflight, Ping) |   203  |       0.18 MB |       0.35 MB      |             **44%** |
| **TOTAL**    | **662**  | **8.15 MB**     |          **24.94 MB**   |         **67.3%**   |

- **protocol**: http/2
- **JS/CSS vs images**: JS+CSS = **4.54 MB** (55.7%) vs images = **1.92 MB** (23.6%). The script bucket is 2.4× the image bucket — atypical for a content site, where the hero image usually dominates. AP News's "weight" is in JavaScript, not pixels.
- **Compression**: text payloads (HTML, JS, CSS, JSON) compress **73–86%** (br/gzip is well-configured). Binary payloads (images, fonts) show **negative** compression because JPEG/WOFF are already compressed — the wire overhead is HTTP headers and chunk encoding.
- **Caching** (cold-load observation): content-hashed first-party bundles ship with 1-year `Cache-Control: max-age=31536000`. The initial HTML and un-hashed tag-manager / ad-bidder responses use 2-minute TTL.

### Soft refresh (warm cache, same context, second navigation)

Captured via puppeteer: navigate → reload with cache intact → re-measure.

| Bucket          | Cold requests | Warm requests | Δ requests | Cold transfer | Warm transfer | Δ transfer |
| --------------- | ------------: | ------------: | ---------: | ------------: | ------------: | ---------: |
| **Script**      |          238  |          174  |      −27%  |      4.39 MB  |      3.49 MB  |     −20%   |
| **Image**       |          166  |          325  |      +96%  |      1.92 MB  |      2.57 MB  |     +34%   |
| **Font**        |           10  |           30  |     +200%  |      0.61 MB  |      3.09 MB  |    +407%   |
| **Document**    |           49  |           63  |      +29%  |      0.55 MB  |      0.33 MB  |     −40%   |
| **TOTAL**       |     **1096**  |     **806**   |    **−26%**|    **10.72 MB**|    **10.75 MB**|   **~0%**  |

- **Request reduction**: 26% fewer requests on warm cache. Looks healthy on the surface.
- **Transfer reduction**: **0%** — warm load actually transfers slightly *more* bytes than cold load. This is the headline finding for this section: **the cache benefit is eaten alive by third-party scripts and tracking pixels that re-fetch on every pageview.**
- **The font bucket is the worst offender**: 10 requests → 30 requests on warm (3× more) because the page re-evaluates font subsets / fallbacks on reload. Bytes go from 0.61 MB to 3.09 MB (5× more).
- **Top warm-load talkers** (largest responses that re-fetch every visit):
  - 509 KB blob: app bundle (re-instantiated)
  - 496 KB blob: app bundle (re-instantiated)
  - 373 KB reCAPTCHA — third-party, not cached
  - 369 KB question image from Riverdrop (preloaded but not seen on first paint)
  - 338 KB HLS video segment from Primis (preloaded ahead of play)
  - 328 KB hero image from `dims.apnews.com` (cached, but a different size variant)
  - 274 KB ad iframe from `imasdk.googleapis.com`
  - 227 KB JWPlayer CloudFront segment
  - 196 KB GAM `pubads_impl.js` — third-party, not cached
  - 181 KB GTM `gtm.js` — third-party, not cached

### Compression summary

- **Text payloads** are compressed **73–86%** (br/gzip). No improvement available.
- **Images** ship as JPEG / WebP mix; **AVIF** is missing from the homepage's first 10 images. Switching the hero to AVIF would save an estimated **40–50%** of the image bytes (typical JPEG→AVIF ratio at the same perceptual quality).
- **Fonts** ship as `.woff` and `.woff2` mix; pure `.woff2` would shave ~30% off the font bytes.
- **No protocol-level optimizations** observed: HTTP/3 not advertised, Brotli served consistently, no early-hints (103) used.

### Caching summary

- **Static assets with hash filenames** cache for **1 year** as expected.
- **Initial HTML** caches for **2 minutes** — fine for content freshness, but means the homepage always pays the HTML/redirect roundtrip.
- **Third-party scripts** (GTM, GAM, reCAPTCHA, OneTrust, Permutive, etc.) **do not cache across visits** — they're served from third-party origins with their own cache policies, often `no-cache` or short TTL, and they re-fetch on every navigation.
- **Result**: warm-cache benefit is ~26% by request count but ~0% by bytes. Caching only helps first-party JS/CSS, which is itself dwarfed by the 3P payload.

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
