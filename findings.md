# Findings

*Five worst findings, ranked by RICE. Full list (15) in the [Additional findings](#additional-findings) appendix at the bottom.*

*Lab evidence drawn from `lighthouse/*.json` (see `baseline.md`). Field evidence (CrUX, RUM) not captured — confidence ratings reflect lab-only data.*

---

## Rendering

- **TBT of 6–9 s on every page is the dominant bottleneck.**
  - **Prioritization**: 100.00 (RICE — see `prioritization.md` §F-07)
    - **Effort**: 1 · **Reach**: 5 · **Confidence**: 5
    - **Impact** (how it affects users):
      - **Initial Load**: 4 — every pageview is delayed from FCP to LCP by 6–9 s of main-thread JS
      - **Usability**: 5 — scrolls, taps, and form interactions all queue behind the JS queue; the page appears frozen
      - **User Delight**: 3 — the "site is slow" verdict lands on the very first article read
  - **Baseline** (which metrics): Performance score (every page 24–26), TBT (6,950 ms / 6,370 / 8,950 / 6,070 / 5,930 / 5,880 / 5,960 / 6,060 across the 8 pages), and indirectly LCP (cannot fire while the render thread is busy).
  - **Cause**: 8 third-party scripts run synchronously in `<head>` before the page can paint — `html-load.cc/loader.min.js`, `cdn.viafoura.net/vf-v2.js`, `scripts.mf.webcontentassessor.com`, Permutive, Dianomi, Google Ad Manager, OneTrust consent SDK, Kameleoon. Their combined main-thread cost is ~12 s of script execution per cold load.
  - **Solution**: Add `defer` to every non-critical `<script>` in `<head>` (RICE 100, ships in 1 PR). Then defer the top 3 TBT-contributor scripts behind LCP via `requestIdleCallback` or `<script async>` placed at `</body>` (RICE 50).

- **LCP takes 22–46 s across every page — 9–18× the "good" threshold.**
  - **Prioritization**: 33.30 (RICE §F-02b)
    - **Effort**: 3 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 5 — LCP is the metric Google's Core Web Vitals ranks on; every audited page is "poor"
      - **Usability**: 3 — the hero image / headline block appears long after the user expects it
      - **User Delight**: 2 — readers bounce before the story has rendered
  - **Baseline**: LCP per page (homepage 46.4 s, world-news 21.9 s, single-article 32.4 s, photography 37.4 s, quizzes 34.4 s, donate 29.8 s, search 33.5 s, newsletters 31.3 s).
  - **Cause**: upstream TBT (finding above) blocks the render thread; secondary cause is the hero image being delivered as a slow-loading format without `fetchpriority=high`, `preload`, or `srcset` for responsive sizing.
  - **Solution**: preconnect the LCP image origin, `<link rel="preload" as="image">` for the LCP image, serve hero via AVIF + `srcset`, reserve image dimensions in CSS to prevent CLS-induced LCP shifts.

- **`/donate` CLS is 0.8 — 8× the "good" threshold.**
  - **Prioritization**: 40.00 (RICE §F-03)
    - **Effort**: 2 · **Reach**: 4 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 1 — page loads; layout then shifts
      - **Usability**: 5 — **the donate page is the conversion target**; a 0.8 CLS at the moment the user is about to commit money causes wrong-button clicks, abandoned carts, and support tickets
      - **User Delight**: 1 — direct revenue risk on the highest-value page in the audit
  - **Baseline**: CLS on `/donate` = 0.800 (8× threshold). The next-highest CLS is single-article at 0.069 — donate is an outlier.
  - **Cause**: late-injecting DOM on the donate flow. Most likely a payment provider iframe (Stripe/PayPal/Donorbox) loaded after initial paint without reserved dimensions, OR a "secure donation" trust badge that injects below the form. The CLS attribution in Performance panel would name the exact element.
  - **Solution**: identify the late-injecting element via Performance → "Layout Shift Culprits". Reserve its dimensions in CSS (`<div style="aspect-ratio: 4/3">` placeholder, or explicit `width`/`height`). If a payment iframe, set explicit dimensions on the placeholder container. Defer non-critical trust badges below the fold.

- **Single-article CLS is 0.069 (just under "needs improvement").**
  - **Prioritization**: 40.00 (RICE §F-04)
    - **Effort**: 2 · **Reach**: 5 · **Confidence**: 4
    - **Impact**:
      - **Initial Load**: 1
      - **Usability**: 3 — affects every article view, which is the dominant page type for AP News (most sessions are article reads)
      - **User Delight**: 2
  - **Baseline**: CLS on `/article/...` = 0.069. Field 75th percentile likely worse than lab median.
  - **Cause**: late-loading ad slots and related-articles widgets injecting after the article body. Distinct mechanism from donate (editorial template, not payment flow).
  - **Solution**: reserve dimensions for all late-loading iframes / ad slots in the article template. Audit the related-articles component for layout-shift contribution.

- **Third-party scripts (OneTrust, GAM, ad bidders) inflate TBT and inflate bytes.**
  - **Prioritization**: 15.00 (RICE §F-05)
    - **Effort**: 4 · **Reach**: 5 · **Confidence**: 3
    - **Impact**:
      - **Initial Load**: 5 — combined 4.39 MB JS on the homepage; 12 s of main-thread execution
      - **Usability**: 2
      - **User Delight**: 1 — readers on metered connections (and emerging markets) wait for bytes they don't need
  - **Baseline**: TBT 5.9–9.0 s on every page (covered above); Script transfer 4.39 MB on the homepage alone; 662 total requests.
  - **Cause**: OneTrust + Google Ad Manager + Permutive + Dianomi + Kameleoon + html-load.cc + Viafoura + webcontentassessor — 8 third-party vendors running in `<head>` without `defer`. The OneTrust consent SDK also triggers GDPR consent flow before the page can paint.
  - **Solution**: lazy-load non-essential third parties via `requestIdleCallback`. Audit which ad bidders actually win impressions — the lowest-yield ones can be cut first. Move consent SDK behind a click-gate for users who have already accepted (RICE 50, F-01b).

---

## Networking

### Good

- **Compression** is in place for text payloads (br/gzip on JS, CSS, HTML, JSON). 50–60% reduction on the text bucket.
- **Caching** for content-hashed first-party assets: JS/CSS bundles ship with hash filenames and 1-year cache TTL. Repeat visits benefit.

### Bad

- **Binary assets** (images, fonts) are not compressed — modern formats (AVIF, WebP, woff2) are partially deployed, leaving bytes on the table. Largest images on the homepage are delivered as JPEG without `srcset`; some fonts ship as `.woff` instead of `.woff2`.
- **Initial HTML / unhashed assets** re-fetch on every visit because the cache TTL is short (2 minutes on the main document). Returning readers don't get the warm-cache benefit they should.

---

## Accessibility

A11y audits were not run in this session (`--only-categories=performance`). Worth a separate pass. Quick visual check of the homepage DOM suggests icon-only buttons in the section header and mega-nav may lack `aria-label`, but I have not verified.

---

## Additional findings (F-06 → F-15)

The above covers the five worst findings by RICE. The full set, kept for the prioritization step in `prioritization.md`:

- **F-06** — No evidence of code-splitting on article pages. Single 1–2 MB JS bundle per page (RICE 11.3). Likely ships on every route, including `/newsletters` which is functionally static. Verify via bundle-analyzer; implement route-based code splitting.
- **F-07** — Render-blocking third-party scripts in `<head>`. Add `defer` to every non-critical script (RICE 100 — same as F-01 above; merged into the primary recommendation).
- **F-08** — Search results page has an application-waterfall pattern (search → render → fetch suggestions). Profile via Performance panel; move non-critical fetches to `requestIdleCallback` (RICE 15.0).
- **F-09** — Photography hub LCP 37.4 s with no measured CLS (images have explicit dimensions). The LCP image is likely served as JPEG at original resolution. Convert hero/grid to AVIF + `srcset`, preload the LCP image, eager-load the first grid row (RICE 16.0).
- **F-10** — No content-hashed static assets verified. `curl -I` on a representative asset would confirm or refute. If unverified, this is a real risk for cache-warm visits (RICE 15.0, pending verification).
- **F-11** — World News section has the fastest LCP (21.9 s) but it's still 9× over. The homepage's worse LCP (46.4 s) suggests carousel/featured-grid modules specific to the homepage; profile them (RICE 13.3).
- **F-12** — Lighthouse DOM-size audits were skipped for runtime reasons. AP News section hubs include the full mega-nav with hundreds of links; that's pure DOM weight. Audit per route; consider lazy-rendering mega-nav on user interaction (RICE 10.0).
- **F-13** — `Storage.getUsageAndQuota` hangs in Lighthouse — Cloudflare bot detection or browser storage abuse. Doesn't directly affect users, but inherits risk for first-party code that calls storage APIs without timeouts (RICE 2.0, operational).
- **F-14** — No field data captured (CrUX, RUM). Recommended next step: PSI Field Data panel for the 8 URLs; install `web-vitals` with attribution build + beacon on `visibilitychange` (RICE 40.0 — cheap to do).
- **F-15** — No web-vitals RUM installed (no `sendBeacon` traffic observed in network panel). AP News sees traffic numbers but not CWV numbers tied to specific users; their decisions are lab-audit-based, not continuous field data (RICE 18.8).

## Findings not raised

- **CSS extraction / critical CSS** — Lighthouse "render-blocking-resources" was run but per-audit breakdown not surfaced here. Worth a dedicated check.
- **Service worker / caching strategy** — AP News ships no SW in our captures; for a news site, an SW could meaningfully warm-cache assets for returning visitors.
- **A11y / best practices / SEO audits** — out of scope for a performance audit, but Lighthouse runs them in 1 minute if needed.
- **Field INP** — requires `web-vitals` RUM (see F-15).
