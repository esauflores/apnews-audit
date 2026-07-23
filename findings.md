# Findings

*Findings cleaned per HW4 spec: each is independently observable. Lab evidence only — CrUX / INP / A11y / BP / SEO field-equivalent data not captured (noted in `baseline.md`).*

*Six corrective + two good findings from the example audit structure are reproduced below. Additional corrective findings cover networking-specific issues.*

---

## Rendering

- **Initial page render is significantly delayed.**
  - **Prioritization**: 40.00
    - **Effort**: 2 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 5 — blank-screen time before first paint
      - **Usability**: 3
      - **User Delight**: 2
  - **Baseline**: First Contentful Paint per page — homepage 7.2 s, world-news 6.2 s, single-article 7.7 s, photography 5.8 s, quizzes 5.0 s, donate 7.1 s, search 5.6 s, newsletters 12.5 s. All 2–5× the 1.8 s "good" threshold. Lighthouse "render-blocking-resources" audit (visible in raw JSON) flags multiple blocking scripts in `<head>`.
  - **Cause**: render-blocking third-party scripts in `<head>`; critical-path HTML depends on script tags completing parse before any byte is painted. TBT (finding below) compounds the delay.
  - **Solution**: add `defer` to every non-critical `<script>` in `<head>`; extract critical CSS; inline only above-the-fold CSS. Re-optimize HTML pages for HTTP/2.

- **Initial visual page load is significantly delayed.**
  - **Prioritization**: 33.30
    - **Effort**: 3 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 5 — LCP is the CWV ranking signal; every audited page is "poor"
      - **Usability**: 3 — hero image / headline block appears long after expected
      - **User Delight**: 2
  - **Baseline**: LCP per page (s) — homepage 46.4 / world-news 21.9 / article 32.4 / photography 37.4 / quizzes 34.4 / donate 29.8 / search 33.5 / newsletters 31.3. All 10–18× the 2.5 s "good" threshold.
  - **Cause**: upstream TBT blocks the render thread; secondary cause is the hero image delivered as a slow-loading format without `fetchpriority="high"`, `<link rel="preload">`, or `srcset`.
  - **Solution**: fix TBT first, then preload LCP image, AVIF + `srcset`, reserve image dimensions in CSS to prevent CLS-induced LCP shifts.

- **Initial page functionality is significantly delayed.**
  - **Prioritization**: 100.00
    - **Effort**: 1 · **Reach**: 5 · **Confidence**: 5
    - **Impact**:
      - **Initial Load**: 4 — every pageview delayed from FCP to TTI by 6–9 s of main-thread JS
      - **Usability**: 5 — scrolls, taps, and form interactions all queue behind the JS queue; the page appears frozen
      - **User Delight**: 3
  - **Baseline**: Total Blocking Time per page (ms) — homepage 6,950 / world-news 6,370 / article 8,950 / photography 6,070 / quizzes 5,930 / donate 5,880 / search 5,960 / newsletters 6,060. All 30–45× the 200 ms "good" threshold.
  - **Cause**: 8 third-party scripts run synchronously in `<head>` — `html-load.cc/loader.min.js`, `cdn.viafoura.net/vf-v2.js`, `scripts.mf.webcontentassessor.com`, Permutive, Dianomi, Google Ad Manager, OneTrust consent SDK, Kameleoon. Combined main-thread cost ≈ 12 s of script execution per cold load.
  - **Solution**: add `defer` to every non-critical script in `<head>` (RICE 100, 1 PR). Defer top 3 TBT contributors behind LCP via `requestIdleCallback` or `<script async>` at `</body>`.

- **Images do not render in order of user need.**
  - **Prioritization**: 60.00
    - **Effort**: 1 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 4 — secondary content competes with LCP image for bandwidth
      - **Usability**: 2
      - **User Delight**: 2
  - **Baseline**: per-page Lighthouse "Prioritize LCP image" and "Image elements do not have explicit `width`/`height`" audits (visible in raw JSON). LCP image on the homepage has no `fetchpriority` attribute; below-fold ads sometimes preload before the headline.
  - **Cause**: images lack priority indicators (`fetchpriority`, `importance`). Ad images and secondary content fetch in parallel with the LCP image.
  - **Solution**: add `fetchpriority="high"` to the LCP image, `fetchpriority="low"` to below-fold images, `loading="lazy"` to non-LCP images, `<link rel="preload" as="image">` for the LCP image.

- **Delayed ad makes page look broken.**
  - **Prioritization**: 40.00
    - **Effort**: 2 · **Reach**: 4 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 1 — page loads; layout then shifts
      - **Usability**: 5 — **the donate page is the conversion target**; 0.8 CLS at the moment of payment commitment causes wrong-button clicks, abandoned carts
      - **User Delight**: 1 — direct revenue risk
  - **Baseline**: CLS on `/donate` = **0.800** (8× the "good" threshold). Outlier — the next-highest CLS is single-article at 0.069.
  - **Cause**: late-injecting DOM on the donate flow — most likely a payment-provider iframe (Stripe / PayPal / Donorbox) loaded after initial paint without reserved dimensions, OR a "secure donation" trust badge that injects below the form. The CLS attribution in Performance → "Layout Shift Culprits" would name the exact element.
  - **Solution**: identify the late-injecting element and reserve its dimensions in CSS (`<div style="aspect-ratio: 4/3">` placeholder, or explicit `width`/`height`). If a payment iframe, set explicit dimensions on the placeholder container. Defer non-critical trust badges below the fold.

---

## Networking

### Good

- **Good compression.** Text payloads compress 73–86% via br/gzip. ~60% reduction on the text bucket. No further improvement available at the text layer.
  - **Baseline**: network compression

- **Good caching.** Content-hashed first-party bundles ship with `Cache-Control: max-age=31536000` (1 year). Repeat visits benefit from 88% reduction in JS/CSS re-fetch on warm load.
  - **Baseline**: network caching

### Corrective

- **Soft-refresh transfer savings are ~0% — the cache benefit is eaten by third-party re-fetches.**
  - **Prioritization**: 40.00
    - **Effort**: 2 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 4 — 10.7 MB on every homepage view; cold and warm are identical in bytes
      - **Usability**: 2 — readers on capped data plans pay for the same payload twice
      - **User Delight**: 1 — second visit feels no faster than first
  - **Baseline**: 1,096 cold-load requests, 806 warm-load (only 26% drop). Transfer: 10.72 MB cold → 10.75 MB warm (~0% reduction). Top warm-load talkers are third-party: reCAPTCHA (373 KB), GAM (196 KB), GTM (181 KB), JWPlayer (227 KB), Primis video (338 KB).
  - **Cause**: third-party scripts and ad/pixel/tracking endpoints serve cache policies not under AP News's control. They re-fetch on every pageview even when first-party bundles cache for 1 year.
  - **Solution**: audit which third-party scripts actually cache across visits (DevTools → Network → `Cache-Control` and `Age` headers). Set `stale-while-revalidate` on first-party HTML. For 3P, use a service worker to cache their static JS at AP News's origin (self-host reCAPTCHA, GTM, OneTrust). Drop the lowest-yield bidders.

- **JavaScript dominates the homepage payload (4.39 MB / 54% of transfer).**
  - **Prioritization**: 26.67 (new finding, independently observable)
    - **Effort**: 3 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 5 — JS is the largest single contributor to TBT and LCP on every page
      - **Usability**: 4 — parse + eval time blocks scrolling and tapping for 6–9 s
      - **User Delight**: 1
  - **Baseline**: Script transfer = 4.39 MB / 132 requests on cold homepage; uncompressed resource size = 16.06 MB. The script bucket is **2.4× the image bucket** (atypical — JS dominates, not pixels). Per-page JS includes GTM (181 KB), GAM (196 KB), Permutive, OneTrust, Kameleoon, Viafoura, webcontentassessor, and a 509 KB blob app bundle.
  - **Cause**: no route-based code splitting confirmed (F-06). Full app shell + all third-party SDKs ship on every page, including `/newsletters` and `/donate` which don't need interactive JS.
  - **Solution**: route-based code splitting — `/newsletters` and `/donate` should ship a sub-100KB shell, not the full bundle. Self-host the deterministic third-party SDKs (GTM, reCAPTCHA, OneTrust) and lazy-load the rest with `requestIdleCallback`.

- **Images ship without AVIF (1.92 MB transfer ≈ 1.87 MB uncompressed — no further compression possible).**
  - **Prioritization**: 30.00
    - **Effort**: 2 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 3 — not the dominant payload, but AVIF would save ~50% of image bytes (≈ 1 MB on the homepage)
      - **Usability**: 2
      - **User Delight**: 2 — faster image paints on photography hubs especially
  - **Baseline**: image transfer = 1.92 MB on 166 requests. Compression savings = **−3%** (overhead, not compression). AVIF is supported by every browser shipped in the last 5 years and saves 40–50% vs JPEG at the same perceptual quality.
  - **Cause**: AP News's image pipeline outputs JPEG (and some WebP). AVIF encoders are CPU-expensive but worth it for the homepage hero and the photography hub.
  - **Solution**: add an AVIF variant to the image CDN with JPEG/WebP fallback via `<picture>` or `image/avif,image/webp,image/jpeg` content negotiation. Hero images should be AVIF.

- **Fonts re-fetch on warm load (0.61 MB → 3.09 MB, 5× more bytes; 10 → 30 requests).**
  - **Prioritization**: 10.00 (new finding)
    - **Effort**: 3 · **Reach**: 5 · **Confidence**: 3
    - **Impact**:
      - **Initial Load**: 2
      - **Usability**: 2
      - **User Delight**: 1
  - **Baseline**: cold-load fonts = 10 requests / 0.61 MB. Warm-load fonts = 30 requests / 3.09 MB. Compression savings = −2% (WOFF is already compressed; some fonts ship as uncompressed `.woff`).
  - **Cause**: font-loading strategy that re-evaluates subsets or fallbacks on every reload (e.g., `<link rel="stylesheet">` after first paint, or a `font-display: swap` fallback that re-fetches a non-`.woff2` font when the primary 404s).
  - **Solution**: serve all fonts as `.woff2` only; declare font subsets in advance via `unicode-range`; use `font-display: swap` with a hard cap. Add `<link rel="preload" as="font" crossorigin>` for the LCP font.

---

## Accessibility

- **Interactive controls may be invisible to assistive technology.**
  - **Prioritization**: 37.50
    - **Effort**: 2 · **Reach**: 5 · **Confidence**: 3 (lower confidence — a11y audits not run)
    - **Impact**:
      - **Initial Load**: 0
      - **Usability**: 5 — screen-reader users cannot reach key controls
      - **User Delight**: 4
  - **Baseline**: visual inspection of the homepage DOM suggests icon-only buttons in the section header and mega-nav may lack `aria-label`. Lighthouse `--only-categories=accessibility` was not run in this session.
  - **Cause**: not verified — likely missing `aria-label` on icon buttons/links, missing `alt` on images, heading-order issues.
  - **Solution**: re-run Lighthouse with `--only-categories=accessibility` for a verified baseline. Add `aria-label` to icon buttons/links, `alt` to images, fix heading order, add `title` to iframes.

---

## Build outputs

Build-pipeline-level findings, derived from the [Build outputs](./baseline.md#build-outputs-homepage) section in `baseline.md`.

- **First-party bundle ships page-type-specific code on every page (82% unused on the homepage).**
  - **Prioritization**: 80.00
    - **Effort**: 4 · **Reach**: 5 · **Confidence**: 5
    - **Impact**:
      - **Initial Load**: 5 — 91 KB of JS that doesn't execute on first paint is still parse + eval cost
      - **Usability**: 4
      - **User Delight**: 1
  - **Baseline**: Lighthouse coverage on the homepage shows the content-hashed `All.min.*.gz.js` bundle is **91 KB wasted out of 111 KB total (82% unused)**. Same bundle serves article, photography, donate, search, and newsletters — each page only needs a subset.
  - **Cause**: no route-based code splitting. The bundler treats every page as needing the full app shell. Article templates, photography modules, quiz embeds, donation flows all ship together.
  - **Solution**: route-based code splitting — `/newsletters` should ship a sub-30 KB shell (mostly static), `/donate` a sub-50 KB shell, `/article/*` its own bundle. Combined with `defer` on the rest, expected to drop median TBT from 6 s → under 1 s.

- **OneTrust consent SDK runs synchronously in `<head>` (`OtAutoBlock.js`, no async/defer).**
  - **Prioritization**: 60.00
    - **Effort**: 2 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 4 — 1,225 ms of blocking script execution in the parse-critical path
      - **Usability**: 3
      - **User Delight**: 2
  - **Baseline**: `OtAutoBlock.js` loads with no `async` or `defer` attribute (verified via `document.scripts` scan). It blocks HTML parsing for ~1.2 s. The `otSDKStub.js` wrapper is `async` (correct), but the heavy blocker runs sync.
  - **Cause**: OneTrust's auto-blocking behavior is intentional — it blocks ad scripts until consent is captured. The implementation chose synchronous execution to ensure consent is set before any bid fires.
  - **Solution**: switch to OneTrust's `async` mode + use the `OneTrustStub` callback for ad-script gating. Or self-host `OtAutoBlock.js` with `defer` and let the consent state propagate through a `LocalStorage` write.

- **webcontentassessor.com is an unnecessary vendor consuming 1.87 s of script time per pageview.**
  - **Prioritization**: 50.00
    - **Effort**: 1 · **Reach**: 5 · **Confidence**: 3
    - **Impact**:
      - **Initial Load**: 5 — the single largest script-TBT contributor on the homepage
      - **Usability**: 3
      - **User Delight**: 1
  - **Baseline**: Lighthouse `bootup-time` audit flags `scripts.mf.webcontentassessor.com/scripts/...` at **1,870 ms script time** on the homepage — more than any other script, including GAM, Permutive, or OneTrust. The script downloads 101 KB compressed and runs on every page.
  - **Cause**: vendor provides "content quality assessment" — typically a scoring/feedback tool for editors. No observable user-facing behavior; doesn't gate or modify content delivery.
  - **Solution**: cut the vendor entirely if no editor team uses the score. If needed, run it only on `/article/*` URLs (where editor review happens) instead of every page. Effort = 1: a single tag-manager exclusion rule.

- **AVIF is not served on any homepage image; JPEG and WebP only.**
  - **Prioritization**: 30.00
    - **Effort**: 2 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 3 — AVIF would save ~25–50% on image bytes (≈ 0.5 MB on the homepage's 1.9 MB image bucket)
      - **Usability**: 2
      - **User Delight**: 2
  - **Baseline**: Lighthouse image-format breakdown shows **19 WebP + 8 JPEG + 24 PNG + 10 SVG + 61 GIF + 0 AVIF**. The `dims.apnews.com` CDN URL pattern is `/format/webp/quality/90/` — supports WebP via URL param but no AVIF variant is generated.
  - **Cause**: the CDN pipeline outputs WebP but not AVIF. AVIF encoders are CPU-expensive and historically had weak tooling support; many image pipelines stopped at WebP.
  - **Solution**: add an AVIF encode step to the CDN pipeline. Switch `format/webp` → `format/avif` in the hero-image URLs (the 4 top hero images are WebP today, ~750 KB total). Browsers that don't support AVIF fall back to WebP via `<picture>` element. Save ≈ 200 KB on the homepage's image bucket alone.

---

## Coverage & frames

Coverage and frame-chart findings, derived from the [Coverage](./baseline.md#coverage-homepage) and [Performance frame chart](./baseline.md#performance-frame-chart) sections in `baseline.md`. Captured via `scripts/coverage-frame-capture.mjs` (`just coverage-frames`).

- **First-party stylesheet is render-blocking and 100% unused on the homepage.**
  - **Prioritization**: 70.00
    - **Effort**: 3 · **Reach**: 5 · **Confidence**: 5
    - **Impact**:
      - **Initial Load**: 5 — render-blocking external CSS delays FCP and LCP
      - **Usability**: 3
      - **User Delight**: 2
  - **Baseline**: The first-party `All.min.*.gz.css` is 105 KB compressed / ~786 KB uncompressed and ships via `<link rel="stylesheet">` in `<head>`. Coverage shows **786 KB of uncompressed CSS where 100% is unused on the homepage** (the homepage only needs ~24 KB of inline critical rules; the rest is for article / donate / photography / etc.). Lighthouse flags this stylesheet as render-blocking.
  - **Cause**: no critical-CSS extraction pipeline. The stylesheet is the union of every page's styles, loaded by every page. Inline `<style>` blocks carry a few critical rules (3 of 10) but the full stylesheet still blocks render.
  - **Solution**: extract above-the-fold CSS for each route (homepage, article, photography, etc.), inline it in `<head>`, and defer the rest via `<link rel="preload" as="style" onload="...">`. Estimated FCP improvement on the homepage: 5 s → ~2 s (since the stylesheet is on the parse-critical path today).

- **Page renders at ~1 fps during load, scroll, and click — direct user-perceptible evidence of TBT.**
  - **Prioritization**: 80.00
    - **Effort**: 1 · **Reach**: 5 · **Confidence**: 5
    - **Impact**:
      - **Initial Load**: 5 — 7 of 8 frames dropped during the first 5 s of load
      - **Usability**: 5 — scrolling is visibly frozen (5 of 6 frames dropped); clicking lags (3 of 4 frames dropped)
      - **User Delight**: 4 — users perceive the page as broken
  - **Baseline**: captured via `requestAnimationFrame` deltas over a 5-s window post-load, then 3 s of scroll, then a 2-s click response. Load: **0.9 fps effective** (max interval 4.9 s). Scroll: **1.3 fps**. Click: **1.9 fps**. Every "phase" has at least 75% dropped frames (>25 ms interval).
  - **Cause**: this is the user-visible symptom of TBT 6–9 s on every page. Main-thread JS execution blocks the browser's paint pipeline; the browser literally cannot produce frames until JS yields.
  - **Solution**: same as the "Initial page functionality is significantly delayed" finding — `defer` every non-critical script in `<head>`. After phase 1 ships, the frame chart should improve from ~1 fps to ~30+ fps.

- **No aggressive layer creation in first-party code (paint cost is healthy).**
  - **Prioritization**: 25.00
    - **Effort**: 4 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 2 — paint cost is not the bottleneck
      - **Usability**: 2
      - **User Delight**: 1
  - **Baseline**: DOM walk enumerates **3 stacking contexts** on the homepage (2 via `opacity < 1` for pre-paint fade, 1 via `position + z-index` for an ad slot), plus **1 iframe** (Riverdrop widget, 370 KB preloaded) for ~4 paint layers total. **0 `will-change` declarations, 0 `translate3d(0,0,0)` hacks, 0 animations triggered on scroll.**
  - **Cause**: first-party CSS is well-behaved — the team has not over-applied Day 8–style "force the GPU" optimizations. The only forced layer is a third-party widget we don't control.
  - **Solution**: this is positive news for prioritization — layer-cost optimization will not move the needle for AP News. The frame-chart dropped frames are caused by main-thread JS blocking, not by paint or composite cost. No corrective action on first-party code; consider negotiating with Riverdrop to lazy-load the iframe until user interaction.

---

## Mobile-specific

Mobile findings are scoped to behaviors that are unique to mobile devices or significantly worse on mobile vs desktop. All measurements here are taken under the [Mobile measurement profile](./baseline.md#mobile-measurement-profile) — Slow 4G, 4× CPU throttle, 412×823 viewport.

- **TBT of 6–9 s on mobile is amplified 4× by CPU throttling.**
  - **Prioritization**: 100.00
    - **Effort**: 1 · **Reach**: 5 · **Confidence**: 5
    - **Impact**:
      - **Initial Load**: 5 — every mobile pageview pays the full cost
      - **Usability**: 5 — mobile users are the ones who tap and scroll; the freeze hits them first
      - **User Delight**: 4 — "site is slow" verdict lands on the user's first interaction
  - **Baseline**: Lighthouse `--throttling-method=simulate` models 4× CPU slowdown on mobile (Day 6 §1). Per-page TBT (ms): homepage 6,950 / world-news 6,370 / article 8,950 / photography 6,070 / quizzes 5,930 / donate 5,880 / search 5,960 / newsletters 6,060. Effective "feels-slow" penalty on mid-tier Android ≈ 24–36 s of main-thread work per pageview (TBT × CPU factor).
  - **Cause**: the JS payload (4.39 MB on the homepage) is device-agnostic, but mobile CPUs run at ~1/4 the speed of desktop. Parse + eval cost is amplified ~4× on mobile vs desktop. Per Day 6 §1, mid-tier Android is the right model — it's the median AP News reader.
  - **Solution**: same fix as the main "Initial page functionality is significantly delayed" finding — add `defer` to every non-critical script in `<head>` (RICE 100, 1 PR). Mobile-specific benefit: drops effective TBT from 24–36 s to ~1.5–2.5 s. The deferral is the single highest-leverage mobile fix.

- **Mobile data cost: 10.75 MB per warm pageview on cellular.**
  - **Prioritization**: 40.00
    - **Effort**: 2 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 4 — every warm visit transfers 10.75 MB
      - **Usability**: 3 — slow cellular loads + metered-plan overage warnings
      - **User Delight**: 2 — readers on capped data plans avoid the site
  - **Baseline**: cold transfer = 8.15 MB, warm transfer = **10.75 MB** (cache benefit ≈ 0%). On a 5 GB/month mobile plan, each pageview is ~0.2% of the monthly budget; 5 article reads ≈ 1% of monthly data. Typical US mobile plans: $60–80/month for 5 GB. Emerging markets: $10–20/month for 1 GB — three pageviews ≈ 3% of monthly data.
  - **Cause**: third-party scripts re-fetch on every pageview. 8 vendors × ~150 KB each ≈ 1.2 MB of recurring waste. Self-hosting these or using a service worker eliminates the waste.
  - **Solution**: service worker to cache 3P static JS at AP News's origin (Phase 2). Reduce JS payload via route-based code splitting (Phase 2). Serve AVIF for hero images (Phase 2). Each is independently observable — service-worker cache hit ratio in DevTools, JS payload in `lighthouse/*.json`, image bytes in Network panel.

---

## Additional findings (verified but not in the top set)

- **Single-article template has moderate layout shift (CLS 0.069).** Distinct mechanism from `/donate` — late-loading ad slots and related-articles widgets injecting after the article body. Independently observable (every article view), but smaller impact than the donate-page CLS. Same fix pattern: reserve dimensions for late-loading iframes / ad slots in the article template. (RICE 40)
- **1,096 total requests on the homepage — half are third-party tracking, ad pixels, and analytics.** Top of the request-storm is reCAPTCHA, GAM, JWPlayer, Primis video, GTM. Consolidate bid requests through a single header-bidding wrapper; batch analytics beacons; use `sendBeacon` for non-critical pings. (RICE 20)
- **No web-vitals RUM installed (no `sendBeacon` traffic observed in network panel).** AP News sees traffic numbers but not CWV numbers tied to specific users; performance decisions today are based on lab audits (like this one), not continuous field data. Install `web-vitals` with attribution build + beacon on `visibilitychange` (Day 14 §4.2). (RICE 18.8)
- **No field data captured (CrUX, RUM).** Lab-only evidence; field data would refine the 75th-percentile picture. Recommended as PR-4 in the rollout sequence. (RICE 40)
- **Lighthouse DOM-size audits skipped for runtime reasons.** AP News section hubs include the full mega-nav with hundreds of links. Audit per route; consider lazy-rendering mega-nav on user interaction. (RICE 10)
- **`Storage.getUsageAndQuota` hangs in Lighthouse.** Cloudflare bot detection or browser storage abuse. Operational, not user-facing. (RICE 2)
