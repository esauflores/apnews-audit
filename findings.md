# Findings

*Findings cleaned per HW4 spec: each is independently observable. Lab evidence only — CrUX / INP / A11y / BP / SEO field-equivalent data not captured (noted in `baseline.md`).*

*Six corrective + two good findings from the example audit structure are reproduced below. Additional corrective findings cover networking-specific issues.*

---

## Rendering

- **Initial page render is significantly delayed.**
  - **Prioritization**: 80.00
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
  - **Prioritization**: 25.00
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
  - **Prioritization**: 60.00
    - **Effort**: 2 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 4 — 10.7 MB on every homepage view; cold and warm are identical in bytes
      - **Usability**: 2 — readers on capped data plans pay for the same payload twice
      - **User Delight**: 1 — second visit feels no faster than first
  - **Baseline**: 1,096 cold-load requests, 806 warm-load (only 26% drop). Transfer: 10.72 MB cold → 10.75 MB warm (~0% reduction). Top warm-load talkers are third-party: reCAPTCHA (373 KB), GAM (196 KB), GTM (181 KB), JWPlayer (227 KB), Primis video (338 KB).
  - **Cause**: third-party scripts and ad/pixel/tracking endpoints serve cache policies not under AP News's control. They re-fetch on every pageview even when first-party bundles cache for 1 year.
  - **Solution**: audit which third-party scripts actually cache across visits (DevTools → Network → `Cache-Control` and `Age` headers). Set `stale-while-revalidate` on first-party HTML. For 3P, use a service worker to cache their static JS at AP News's origin (self-host reCAPTCHA, GTM, OneTrust). Drop the lowest-yield bidders.

- **JavaScript dominates the homepage payload (4.39 MB / 54% of transfer).**
  - **Prioritization**: 40.00
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
  - **Prioritization**: 25.00
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
  - **Prioritization**: 50.00
    - **Effort**: 2 · **Reach**: 5 · **Confidence**: 3 (lower confidence — a11y audits not run)
    - **Impact**:
      - **Initial Load**: 0
      - **Usability**: 5 — screen-reader users cannot reach key controls
      - **User Delight**: 4
  - **Baseline**: visual inspection of the homepage DOM suggests icon-only buttons in the section header and mega-nav may lack `aria-label`. Lighthouse `--only-categories=accessibility` was not run in this session.
  - **Cause**: not verified — likely missing `aria-label` on icon buttons/links, missing `alt` on images, heading-order issues.
  - **Solution**: re-run Lighthouse with `--only-categories=accessibility` for a verified baseline. Add `aria-label` to icon buttons/links, `alt` to images, fix heading order, add `title` to iframes.

---

## Additional findings (verified but not in the top set)

- **Single-article template has moderate layout shift (CLS 0.069).** Distinct mechanism from `/donate` — late-loading ad slots and related-articles widgets injecting after the article body. Independently observable (every article view), but smaller impact than the donate-page CLS. Same fix pattern: reserve dimensions for late-loading iframes / ad slots in the article template. (RICE 40)
- **1,096 total requests on the homepage — half are third-party tracking, ad pixels, and analytics.** Top of the request-storm is reCAPTCHA, GAM, JWPlayer, Primis video, GTM. Consolidate bid requests through a single header-bidding wrapper; batch analytics beacons; use `sendBeacon` for non-critical pings. (RICE 25)
- **No web-vitals RUM installed (no `sendBeacon` traffic observed in network panel).** AP News sees traffic numbers but not CWV numbers tied to specific users; performance decisions today are based on lab audits (like this one), not continuous field data. Install `web-vitals` with attribution build + beacon on `visibilitychange` (Day 14 §4.2). (RICE 18.8)
- **No field data captured (CrUX, RUM).** Lab-only evidence; field data would refine the 75th-percentile picture. Recommended as PR-4 in the rollout sequence. (RICE 40)
- **Lighthouse DOM-size audits skipped for runtime reasons.** AP News section hubs include the full mega-nav with hundreds of links. Audit per route; consider lazy-rendering mega-nav on user interaction. (RICE 10)
- **`Storage.getUsageAndQuota` hangs in Lighthouse.** Cloudflare bot detection or browser storage abuse. Operational, not user-facing. (RICE 2)
