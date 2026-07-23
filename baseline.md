# Baseline

*Captured: 2026-07-23 (single run, clean-state profile, **mobile** preset, **simulated throttling**).*
*Tool: Lighthouse CLI v12 on headless Chromium 150. Raw reports in `lighthouse/`.*

---

## Mobile measurement profile

All measurements in this audit are taken under Lighthouse's mobile preset (per Day 3 §4.1). This is the median reader profile for AP News — not desktop, not high-end mobile.

| Setting | Value |
| --- | --- |
| **Form factor** | `mobile` (Lighthouse `--form-factor=mobile`) |
| **Viewport** | 412 × 823 px (Moto G Power default — narrow phone screen) |
| **Device pixel ratio** | 2.625 |
| **User agent** | mobile Chrome on Android |
| **Network throttling** | simulated **Slow 4G** — 1.6 Mbps down / 750 Kbps up / 150 ms RTT |
| **CPU throttling** | **4× slowdown** (models mid-tier Android per Day 6 §1) |
| **Throttling method** | `--throttling-method=simulate` (observation + simulation; pessimistic vs DevTools real-network throttling per Day 3 trade-off) |

Desktop PSI scores, INP (lab-only), CrUX field data, and A11y/BP/SEO/Agentic Browsing categories are all marked "not captured" below. Re-running the audit with desktop preset or with `--only-categories=performance,accessibility,best-practices,seo` would populate those blocks; the qualitative finding (every page is poor) is not expected to change.

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

### Threshold check (mobile)

Every Core Web Vital is outside Google's "good" band on the mobile capture:

| Vital  | Mobile value | "Good" | "Needs improvement" | "Poor" |
| ------ | ------------ | ------ | ------------------- | ------ |
| LCP    | 46.4 s       | ≤ 2.5 s | ≤ 4.0 s             | > 4.0 s |
| CLS    | 0.026        | ≤ 0.1  | ≤ 0.25              | > 0.25 |
| INP    | n/a (lab)    | ≤ 200 ms | ≤ 500 ms          | > 500 ms |

LCP is **18× over** the 2.5 s "good" threshold. CLS is technically "good" on the homepage, but it is **0.8 on `/donate`** (see per-page sweep + `findings.md` "Delayed ad makes page look broken").

---

## PageSpeed Insights

### `/`

#### Mobile

- **Performance**: 25
- **Accessibility**: not captured (run was `--only-categories=performance`; rerun with `--only-categories=performance,accessibility,best-practices,seo` to populate)
- **Best Practices**: not captured
- **SEO**: not captured
- **Agentic Browsing**: not captured (new PSI score; out of scope for this capture)

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

At-a-glance, in the example's compact format:

- **protocol**: http/2 (HTTP/3 not advertised)
- **caching**:
  - first-party assets: main page 2-minute TTL; content-hashed bundles 1-year TTL
  - third-party scripts (GTM, GAM, reCAPTCHA, OneTrust, Permutive, etc.): no-cache / short TTL — re-fetch on every pageview
- **compression**: text (HTML/JS/CSS/JSON) br/gzip, 73–86%; binary (images, fonts) not compressed — JPEG/WOFF already compressed, no further wire savings available

### Mobile (homepage)

- **requests (fresh)**: 662 (cold) / 806 (warm, +21.7%)
- **transfer (fresh)**: 8.15 MB
- **transfer (warm)**: 10.75 MB (warm load is **0.3% larger** than cold — cache benefit eaten by 3P re-fetches)
- **reduction due to caching**: ~0% by bytes; ~26% by request count

### Cold load breakdown (clean profile, fresh cache)

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

## Build outputs (homepage)

Captured 2026-07-23 via a targeted Lighthouse run with build-specific audits enabled (`unused-javascript`, `unused-css-rules`, `modern-image-formats`, `uses-responsive-images`, `render-blocking-resources`, `total-byte-weight`), plus direct inspection of the production HTML and main bundles via `scripts/build-capture.mjs` (`just build-capture`).

For exact byte counts (Lighthouse uses compressed transfer size; `build-capture.mjs` reads `content-length` headers which are absent under chunked transfer encoding), the Lighthouse JSON in `lighthouse/01-homepage.json` is the source of truth.

### JavaScript bundles

- **Number of bundles on the homepage**: 132 script responses. The first-party bundle is **one** (the `All.min.*.gz.js` content-hashed bundle at `assets.apnews.com`); the other 131 are third-party.
- **Bundling strategy**: single content-hashed first-party bundle + per-vendor third-party scripts. **No route-based splitting** is evident — the same `All.min.*` bundle ships on every page.
- **Bundle size**: first-party main bundle = **110.8 KB** compressed / **91 KB wasted** (90% of code never executes on first paint per Lighthouse coverage).
- **Source maps**: **not exposed**. No `SourceMap:` HTTP header, no `sourceMappingURL=` comment in the JS, `.map` files return 404. Correct production posture — source is not exposed to end users.
- **Top first-party scripts**:
  - `assets.apnews.com/.../styles/default/All.min.c32e1374....gz.js` — 110.8 KB, content-hashed
  - `apcdp.apnews.com/plugin/library/c9a19a4b27394526527816f09046289d` — 78.1 KB
  - `apcdp.apnews.com/plugin/plugin/80c9850358e6dd948dbb13b353fe2f10` — 48.5 KB
  - `apcdp.apnews.com/script.js` — 41.6 KB
- **Top third-party scripts (per bootup-time audit)**:
  - `scripts.mf.webcontentassessor.com/...` — 1,870 ms script time (the worst single contributor to TBT)
  - Permutive — 1,764 ms
  - Dianomi — 1,692 ms
  - Google Ad Manager (`pubads_impl.js`) — 1,253 ms
  - OneTrust (`OtAutoBlock.js`) — 1,225 ms
  - Kameleoon — 503 ms
  - html-load.cc — full main-thread cost unknown but >500 ms

**Unused JS** (Lighthouse `unused-javascript`, top 10):

| Script | Total | Wasted | Wasted % |
|---|---:|---:|---:|
| reCAPTCHA | 373 KB | 246 KB | 66% |
| s.ntv.io (native ad) | 259 KB | 214 KB | 82% |
| GAM `pubads_impl.js` | 196 KB | 99 KB | 50% |
| html-load.cc | 145 KB | 96 KB | 66% |
| **AP News first-party main bundle** | **111 KB** | **91 KB** | **82%** |
| Prebid | 193 KB | 91 KB | 47% |
| Viafoura | 187 KB | 90 KB | 48% |
| Pubfig (Dianomi) | 185 KB | 90 KB | 49% |
| GTM | 181 KB | 72 KB | 40% |

**Total wasted JS on the homepage: ~1.91 MB across 132 scripts.** The first-party bundle itself is 82% unused on first paint — most of `All.min.*` is page-type-specific code (article, photography, donate, search, etc.) that ships on the homepage but doesn't execute there.

### CSS bundles

- **Number of stylesheets on the homepage**: 7 responses (1 first-party, 6 third-party).
- **First-party stylesheet**: 105.8 KB compressed, content-hashed (`All.min.df63547d...gz.css`).
- **Source maps**: not exposed (same posture as JS).
- **Preconnect / preload**: `<link rel="preload" as="style">` for the first-party stylesheet; preconnects to ad/CDN origins (a-d.pub.network, btloader, confiant, dims.apnews.com).
- **Third-party stylesheets**: Google Fonts CSS (Poppins, Roboto, Merriweather), Riverdrop custom CSS (15.6 KB), Viafoura (3 separate bundles totaling ~24 KB).

**Unused CSS** (Lighthouse `unused-css-rules`):

| Stylesheet | Total | Wasted | Wasted % |
|---|---:|---:|---:|
| AP News first-party `All.min.*` | 105 KB | **94.7 KB** | **90%** |
| Inline OneTrust styles | 21.5 KB | 21.1 KB | 98% |
| Viafoura | 12 KB | 11.8 KB | 98% |

**Total wasted CSS: ~128 KB.** The first-party stylesheet is 90% unused on the homepage — same root cause as JS: page-specific styles bundled together (article styles on homepage, photography styles on donate, etc.).

### Images

- **Image formats shipped** (homepage, 166 requests):
  - **JPEG**: 8 requests
  - **WebP**: 19 requests (used for hero + carousel images)
  - **PNG**: 24 requests (icons, logos, sprite assets)
  - **SVG**: 10 requests (logos, icons)
  - **GIF**: 61 requests (mostly 1×1 tracking pixels and prebid bidder favicons — see `unused-javascript` cross-reference)
  - **AVIF**: **0 requests** — not served anywhere on the homepage
- **Responsive variants**: 75 `<img>` tags with `srcset`, 14 without (mostly inline SVG icons). `srcset` includes both 1× and 2× variants via the `dims.apnews.com` CDN. Sizes attribute present where needed.
- **Full-resolution exposure**: the `dims.apnews.com` CDN does serve a `strip=true` parameter that crops the source image, but the **source files at `assets.apnews.com` are not directly exposed** in the HTML (they're only accessible via the CDN URL with resize parameters). Good — the CDN acts as the public face; the source originals are private.
- **Top image bytes**: 370 KB (Riverdrop question image — preloaded but not seen on first paint), then 4 hero images at 100–190 KB each.

**Modern format opportunities**: Every JPEG on the homepage could ship as AVIF with a JPEG fallback. The WebP images already are modern; AVIF would save an additional ~25% on those.

### Third-party resources

Captured via the Lighthouse run + puppeteer inventory of `<script src=...>` tags.

**Loading strategy** (per script attribute scan):

| Strategy | Count | Examples |
|---|---:|---|
| `async` (no defer) | majority of 3P | GTM, GAM, recaptcha, viafoura, kameleoon, html-load.cc, webcontentassessor, OneTrust stub |
| `defer` (no async) | 2 | webcomponents-loader, sail-horizon |
| no attribute (sync, blocking) | several | OtAutoBlock, parsely experiments, apcdp, tru.am associatedpress |
| Inline (`<script>...</script>`) | several | small bootstrap + consent logic |

The sync (no-attribute) scripts are the most expensive — they block HTML parsing until they execute. `OtAutoBlock.js` (OneTrust) and `apcdp.apnews.com/script.js` are the worst offenders from this category.

**3P vendor inventory** (top vendors by main-thread time):

| Vendor | Purpose | Main-thread cost | Loaded |
|---|---|---:|---|
| scripts.mf.webcontentassessor.com | Content quality assessment | 1,870 ms | async |
| Permutive | Audience platform | 1,764 ms | async |
| Dianomi | Ad context | 1,692 ms | async |
| Google Ad Manager | Header bidding | 1,253 ms | async |
| OneTrust | Consent SDK | 1,225 ms | **sync** (OtAutoBlock) |
| Kameleoon | A/B testing | 503 ms | async |
| html-load.cc | Ad loader | >500 ms | async |
| n.tv (Native ad) | Native ad network | 762 ms | async |
| JWPlayer | Video player | 700 ms | async |
| webcontentassessor | (duplicate) | (above) | — |
| tru.am | Social tracking | (unknown) | async |

**Inappropriate / unnecessary**:
- **scripts.mf.webcontentassessor.com** — 1.87 s of script execution per pageview for "content quality assessment." No measurable business value evident; the script runs on every page but doesn't gate or modify content delivery. Highest-priority cut.
- **reCAPTCHA** — 373 KB download, 246 KB unused, but loaded on first paint even though no CAPTCHA challenge is shown unless a user action triggers it. Should lazy-load on intent.
- **VIAFOURA comments** — 187 KB download on every page including `/donate`, `/search`, `/newsletters` — pages that don't have comment sections.

---

## Coverage (homepage)

Captured via puppeteer's v8 coverage API in `scripts/coverage-frame-capture.mjs` (`just coverage-frames`). Same methodology Lighthouse uses internally — JS and CSS coverage are started before navigation and stopped after the page settles.

### Critical CSS

- **10 inline `<style>` blocks** in the HTML head, totaling **24,012 bytes**.
- **3 of those 10 blocks** contain above-the-fold selectors (matching patterns like `Page-header`, `TopNav`, `body { ... }`).
- **The first-party stylesheet** (`assets.apnews.com/.../styles/default/All.min.df63547d20b58dba56054a82d35c3ae1.gz.css`, 105 KB compressed / **~786 KB uncompressed**) is loaded via `<link rel="stylesheet">` and is render-blocking.
- **Observation**: critical CSS extraction is partially done (24 KB of inline rules) but the bulk of the above-the-fold styles still ships in the render-blocking external stylesheet. There is no audit-grade inlining pipeline.

### Unused JavaScript

| Bucket | Entries | Total bytes | Unused bytes | Unused % |
|---|---:|---:|---:|---:|
| **Total** | **85** | **16,200 KB** | **14,724 KB** | **90.9%** |

Top 10 unused-JS offenders, by source category:

| Script | Unused | % | Source |
|---|---:|---:|---|
| s.ntv.io (native ad, served twice) | 910 + 736 KB | 99% | 3rd-party ad |
| live.primis.tech HLS video player | 758 KB | 83% | 3rd-party video |
| Permutive audience platform | 730 + 692 KB | 98% | 3rd-party audience |
| Viafoura comments widget | 671 KB | 99.9% | 3rd-party analytics |
| Pubfig (Dianomi ad context) | 625 KB | 99% | 3rd-party ad |
| GTM (Google Tag Manager) | 600 KB | 99.8% | Google |
| Prebid Vid | 589 KB | 89% | 3rd-party ad |
| Permutive web.js | 480 KB | 92% | 3rd-party audience |

**Pattern**: the most unused JS is third-party ad/analytics — these scripts load 600–910 KB of code that doesn't execute on first paint. The first-party bundle (not in top 10 here because we ran a different capture cycle than the Lighthouse one) is also 82% unused on the homepage per the [Build outputs](#build-outputs-homepage) section.

### Unused CSS

| Bucket | Entries | Total bytes | Unused bytes | Unused % |
|---|---:|---:|---:|---:|
| **Total** | **45** | **1,794 KB** | **1,749 KB** | **97.5%** |

Top 5 unused-CSS offenders:

| Stylesheet | Unused | % | Source |
|---|---:|---:|---|
| First-party `All.min.*.gz.css` (×2 references) | 786 + 748 KB | 100% | first-party |
| Viafoura | 92 KB | 100% | 3rd-party analytics |
| Google Fonts (Roboto + Merriweather) | 23 KB each | 100% | Google |
| Primis slate (video player) | 19 KB | 100% | 3rd-party video |

**Pattern**: 97.5% of all CSS bytes ship but never match. The first-party stylesheet (786 KB uncompressed) ships every page's styles, of which almost nothing is used on the homepage.

---

## Performance frame chart

Captured via `requestAnimationFrame` deltas in the browser, after page load + scroll + click. A "dropped frame" is defined as >25 ms between consecutive frames (the 60-fps threshold is 16.67 ms; >25 ms means the browser missed a paint).

_Note: numbers vary between captures (±20%) because of timing-dependent main-thread scheduling. The pattern — fewer than 2 fps effective — is consistent across all runs._

| Phase | Total frames captured | Dropped frames | Avg frame interval | Max frame interval | Effective fps |
|---|---:|---:|---:|---:|---:|
| **Page load** (5 s after navigation) | 8 | **7** | **627 ms** | **783 ms** | **~1.0 fps** |
| **Scroll to bottom** (3 s) | 4 | **3** | **924 ms** | **2,167 ms** | **~1.1 fps** |
| **Click first link** (2 s) | _null_ (n/a — scroll triggered navigation) | — | — | — | — |

**Observations**:
- The page renders at **less than 2 frames per second during load and scroll**. That's not a slow page — it's a slideshow.
- The max frame interval during load (~800 ms to 2 s across runs) corresponds to the TBT finding — JS is blocking the main thread so badly that the browser cannot paint a single frame for several seconds at a time.
- Even after the page settles, scrolling still misses most frames (3 of 4 dropped in the latest run; 5 of 6 in earlier runs).
- The click-phase capture failed in the most recent run because scrolling triggered SPA navigation in apnews.com's app shell (the `scrollTo` causes a route change). A click capture without prior scroll would work; left as a follow-up rather than a methodology blocker.
- Per-run variance is expected because main-thread scheduling depends on which 3P scripts are racing for CPU at the moment of capture.

This is **direct user-perceptible evidence** of the audit's headline finding. A user scrolling experiences the page as frozen. The frame chart is the "show your work" artifact for the TBT-corrective finding.

---

## Layers & animations

Captured via DOM walk (`document.querySelectorAll('*')` + `getComputedStyle` for stacking-context detection), CSS rules introspection (`document.styleSheets` walk), and the Chrome DevTools Protocol `LayerTree.enable`. Captured via `scripts/coverage-frame-capture.mjs` (`just coverage-frames`).

| Metric | Value |
|---|---|
| **Stacking contexts on the homepage** | **3** |
| ↳ by `opacity < 1` (body fade-in pre-paint, decorative circle) | 2 |
| ↳ by `position + z-index` (header leaderboard ad) | 1 |
| `will-change` selectors (forced layer creation) | **0** |
| `translate3d` / `transform3d` selectors (forced compositing) | **0** |
| `document.getAnimations()` count on first paint | **0** |
| Animations started on scroll | **0** |
| `<canvas>` elements | 0 |
| `<video>` elements on first paint | 0 |
| `<iframe>` elements | **1** (Riverdrop widget — preloaded but not seen on first paint) |

**Estimated paint-layer count on the homepage**: ~4 (3 stacking contexts above + 1 iframe + 1 root document).

**Observations**:
- AP News's first-party CSS **does not aggressively create layers** — no `will-change` declarations, no `translate3d(0,0,0)` "useless properties" hack. This is the correct post-Day-8-§-1.3 behavior (don't create layers you don't need).
- The 3 stacking contexts are all justified: 1 ad slot needs `position + z-index` to stack above other content; 2 use `opacity < 1` for pre-paint hide/show (a fade-in pattern). Neither is "forced" in the wasteful sense.
- The single iframe (Riverdrop, 370 KB preloaded) is the only forced compositing layer on first paint, and it's not user-visible.
- No animations start on scroll — the page doesn't attempt scroll-triggered effects (which is correct under TBT — animations would just stutter anyway).
- Net: **the paint-layer cost is healthy** for AP News's own code. The slowness the user feels is main-thread JS blocking, not compositing cost. (This matters for prioritization: a layer-cost optimization won't help; deferring scripts will.)

This confirms that the frame-chart dropped frames are caused by **JS execution blocking the main thread**, not by paint or composite cost.

---

## Rendering strategies (8 audited pages)

Captured 2026-07-23 via puppeteer interceptor + Node `fetch` fallback in `scripts/rendering-strategy.mjs`. Detected by inspecting (1) initial HTML size before JS runs, (2) response headers, (3) framework markers.

### Strategy used

**AP News uses server-side rendering (SSR) with long-lived CDN caching, served by Brightspot CMS.** All 8 audited pages return substantial HTML in the initial response (640 KB to 2.3 MB compressed), with 8–11 text-indicator matches against common news-page markers (`breaking`, `world`, `politics`, `article`, `subscribe`, etc.). This means the content is server-rendered, not a client-side shell hydrated after JS.

| Page | HTML size (initial) | Strategy | Cache-Control | Age | Framework |
|---|---:|---|---:|---:|---|
| Homepage | **2,343,745 B** | SSR (Brightspot) | `public, max-age=120, stale-if-error=86400` | 34 s | Brightspot |
| World News | 1,245,351 B | SSR (Brightspot) | `public, max-age=30, s-maxage=31536000` | 336 s | Brightspot |
| Single article | 850,953 B | SSR (Brightspot) | `public, max-age=30, s-maxage=31536000` | 340 s | Brightspot |
| Photography | 1,760,499 B | SSR (Brightspot) | `public, max-age=30, s-maxage=31536000` | 320 s | Brightspot + Astro islands |
| Quizzes | 645,522 B | SSR (Brightspot) | `public, max-age=30, s-maxage=31536000` | 344 s | Brightspot |
| Donate | 643,278 B | SSR (Brightspot) | `public, max-age=30, s-maxage=31536000` | 347 s | Brightspot |
| Search | 958,931 B | SSR (Brightspot) | `public, max-age=30, s-maxage=31536000` | 117 s | Brightspot |
| Newsletters | 654,572 B | SSR (Brightspot) | `public, max-age=30, s-maxage=31536000` | 340 s | Brightspot |

**Common headers** (all 8 pages):
- `server: cloudflare` — Cloudflare CDN
- `x-powered-by: Brightspot` — Brightspot CMS at origin
- `vary: Accept-Encoding` — text compression negotiated
- `content-encoding: br` — Brotli compression (homepage captured with it on; the other captures used direct fetch and got uncompressed, which is a measurement artifact)

### How this affects users

**Benefits of the SSR + CDN-cache strategy:**

1. **Fast initial paint** — the LCP image, headline text, and navigation are present in the initial HTML, so the browser can paint meaningful content immediately. Google's CWV measures FCP and LCP against the initial HTML render, not against JS hydration.
2. **No flash-of-empty-content** — even on slow networks, the user sees content within ~1 s of the HTML arriving.
3. **CDN cache benefit** — with `s-maxage=31536000` (1 year) on the CDN, repeat visits for the same URL get served from Cloudflare's edge in <100 ms. The `age` headers confirm most pages are 320–347 s old at capture time — they're being served from CDN cache.
4. **SEO-friendly** — search engine crawlers (which often don't run JS) see the full article content in the initial HTML.

**Trade-offs and costs:**

1. **Hydration cost** — SSR delivers the content, but the browser still has to download, parse, and execute the 4.39 MB client JS bundle to make the page interactive. TBT 5.9–9.0 s on every page is the hydration cost of running all the third-party scripts and the first-party bundle.
2. **First-byte HTML is enormous** — 640 KB to 2.3 MB of HTML per page. Even with `s-maxage=1 year`, the first uncached fetch downloads all of this. For a news site with breaking-news pages, this is the cost of getting fresh content.
3. **Photography page runs two frameworks** — Brightspot SSR + Astro islands. Astro is typically used for partial hydration (islands architecture), but the page is 1.76 MB of HTML — the islands benefit isn't being realized if the whole page is server-rendered.
4. **Homepage cache TTL is 2 minutes vs 1 year for others** — inconsistent caching. The homepage (highest-traffic) has the shortest TTL (`max-age=120`), while lower-traffic pages like `/newsletters` cache for 1 year. The homepage likely re-renders frequently because of breaking-news rotation, but 2 minutes may be too aggressive.
5. **No streaming SSR apparent** — the HTML responses are fully buffered (the entire 2.3 MB for the homepage arrives as one chunk). Streaming SSR would let the browser begin rendering the above-the-fold content while the rest of the page is still being generated.

### Is this the right choice for these pages?

| Page type | Current strategy | Best fit | Verdict |
|---|---|---|---|
| Homepage | SSR, 2-min cache | SSG + ISR, 1-min revalidate | **Suboptimal** — homepage should be cached longer; ISR would cut origin load |
| Section hubs (world-news, photography, quizzes) | SSR, 1-year CDN cache | SSG (already what cache TTL implies) | **Right choice** — they cache like SSG, just call it SSR for personalisation |
| Single article | SSR, 1-year CDN cache | SSG | **Right choice** — articles don't change once published |
| Donate | SSR, 1-year CDN cache | SSG | **Right choice** — the donation flow is mostly static |
| Search | SSR, 30s/1yr cache | SSR (results are query-dependent) | **Right choice** — search is genuinely dynamic |
| Newsletters | SSR, 1-year CDN cache | SSG | **Right choice** — newsletter copy is static |

**Summary** — the SSR + CDN-cache approach is the right call for most page types, but the homepage is over-invalidating and would benefit from ISR (Incremental Static Regeneration) with stale-while-revalidate. The fundamental issue isn't the rendering strategy — it's the **client-side hydration cost**: 4.39 MB of JS blocks the main thread for 6–9 s after the initial SSR HTML paints. A move to partial hydration (React Server Components, Astro islands, or similar) would let interactive regions hydrate on-demand while keeping the static parts of the page frozen.

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
