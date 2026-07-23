# Findings

*Each finding follows the four-part structure from Day 13 §2: Evidence → Interpretation → Impact → Recommendation.*
*Target: 15–25 findings raised to recommendations per Day 1 §5.2.1; in this audit, the strongest 8–12 will move to `prioritization.md`.*
*Lab evidence drawn from the captures in `lighthouse/` (see `baseline.md`). Field evidence (CrUX, RUM) not captured — confidence ratings reflect lab-only data.*

---

## F-01 — TBT of 6–9 s on every page is the root cause of poor performance scores

**Evidence:** Per-page Total Blocking Time from `lighthouse/*.json`: homepage 6,950 ms, world-news 6,370, single-article 8,950, photography 6,070, quizzes 5,930, donate 5,880, search 5,960, newsletters 6,060. **All 8 pages are 30–45× the 200 ms "good" threshold.**

**Interpretation:** Between FCP and TTI, the main thread is blocked for 6–9 s by JS execution. This single bottleneck directly drags LCP into the 22–46 s range (LCP cannot fire while the render thread is busy), and explains the perf scores clustering at 24–26 (any single score above ~50 requires a "good" LCP and TBT).

**Impact:** Affects every pageview on the site, on both mobile and desktop, every session. Field TBT-bound p75s likely also in the 2–5 s range (lab throttling is pessimistic vs real mobile CPUs). Hits every Core Web Vital threshold; drags organic search ranking per Day 3 §1.

**Recommendation:** Identify the top 3 contributors to TBT via Lighthouse's "JS Execution Time" + "Third-Party Summary" + Coverage tab. Likely candidates: ad SDKs (OpenX, PubMatic), comments widget (Viafoura), and one or more framework bundles. Defer all third-party scripts with `defer` or load post-LCP. Audit the main bundle for code-splitting opportunities.

**Priority (RICE, see `prioritization.md`):** High

---

## F-02 — LCP element loads in 22–46 s across all pages (target: ≤2.5 s)

**Evidence:** LCP measured via simulated throttling: homepage 46.4 s, world-news 21.9 s, single-article 32.4 s, photography 37.4 s, quizzes 34.4 s, donate 29.8 s, search 33.5 s, newsletters 31.3 s. All 10–18× over the 2.5 s "good" threshold.

**Interpretation:** LCP can't fire while the main thread is blocked (F-01). Even on World News — the fastest page at 21.9 s — LCP is still ~9× over budget. The LCP element is almost certainly the hero image or large text block, both of which would otherwise render in well under 1 s on a clean machine.

**Impact:** Largest single contributor to user-perceived "slow site" verdict. Google has used CWV (with LCP tightened from 2.5 s → 2.0 s in March 2026) as a ranking signal since June 2021; AP News is now out of "good" for every page on every CWV metric.

**Recommendation:** Fixing TBT (F-01) is the highest-leverage move. Secondary: preconnect/preload the LCP image origin, serve hero images via AVIF with `srcset`, reserve image dimensions in CSS to prevent CLS-induced LCP shifts.

**Priority:** High

---

## F-03 — Donate page CLS is 0.8 (target: ≤0.1)

**Evidence:** `lighthouse/06-donate.json` CLS = 0.8 — 8× the "good" threshold, and uniquely high among the 8 pages (next-highest is single-article at 0.069).

**Interpretation:** Something on the donate page injects late-occupying DOM. Common causes for this pattern on a donate flow:
- Payment provider iframe (Stripe, PayPal, Donorbox) loaded after initial paint without reserved dimensions
- A paywall / contribution modal that pushes the form down when it mounts
- Hero CTA button resized by a late-loading font swap
- "Secure donation" trust badges that load from a third-party CDN after the form is rendered

**Impact:** The donate page is the **highest-value page in the audit** — it's the conversion target. A 0.8 CLS at the moment the user is about to commit money is a direct revenue risk: clicking the wrong button mid-shift leads to abandoned carts and support tickets. Field CrUX data (not captured) would likely confirm this in the 75th percentile.

**Recommendation:** Identify the late-injecting element via Performance panel's "Layout Shift Culprits" attribution. Reserve its dimensions in CSS. If it's a payment iframe, set explicit width/height on the placeholder container. Consider deferring non-critical trust badges below the fold.

**Priority:** High

---

## F-04 — Single-article CLS is 0.069 (just below "needs improvement")

**Evidence:** `lighthouse/03-single-article.json` CLS = 0.069.

**Interpretation:** Smaller than donate but still above 0 — likely late-loading ad slots or related-articles widgets injecting after the article body. Distinct from donate (different mechanism) — this is an editorial template issue, not a payment-flow issue.

**Impact:** Affects every article view, which is the dominant page type for AP News (most sessions are article reads). Field 75th percentile likely worse than lab median.

**Recommendation:** Reserve dimensions for all late-loading iframes / ad slots in the article template. Audit the related-articles component for layout-shift contribution.

**Priority:** High

---

## F-05 — Third-party scripts likely include an ad SDK that blocks parsing (html-load.cc, viafoura)

**Evidence:** Source HTML for every AP News page references `html-load.cc/loader.min.js` and `cdn.viafoura.net/vf-v2.js` in the `<head>`. The OneTrust consent string includes ad bidders: PubMatic, OpenX, Rubicon, IndexExchange.

**Interpretation:** These scripts load in the document head with no `defer` or `async`. Ad SDKs in particular are typically synchronous because they want to bid before render. The cumulative cost is visible in F-01 (TBT 6–9 s).

**Impact:** Beyond TBT, these scripts are also a privacy/CMP burden — they trigger GDPR consent flow, contribute to CLS via delayed DOM injection, and add to data-usage on metered connections.

**Recommendation:** Load html-load.cc and viafoura with `defer` (or move to `body > script[async]`). Ad SDKs: lazy-load after LCP via `requestIdleCallback`. Audit which bidders actually win impressions — the lowest-yield ones can be cut first.

**Priority:** High

---

## F-06 — No evidence of code-splitting on article pages (single 1–2 MB JS bundle per page)

**Evidence:** Per-page transfer size + Lighthouse "Avoid an excessive DOM size" + "Reduce JavaScript execution time" audits (visible in raw JSON, not all extracted here). TBT 6–9 s on every page type — including `/newsletters`, which is functionally static — strongly suggests the same JS bundle ships on every route.

**Interpretation:** The site appears to ship an SPA-style bundle across all page types, even ones that don't need interactive JS. AP News's article pages are mostly static content; the JS budget for them should be near zero (just the comments widget + analytics), not 1+ MB.

**Impact:** Wasted bytes on metered connections; wasted parse/eval time on lower-end Android devices (Day 6 §1 — 4–6× CPU slowdown); wasted memory on background tabs (Day 6 §1.3).

**Recommendation:** Confirm via bundle-analyzer run (Day 7 §2.2) — `webpack-bundle-analyzer` against the production build. Implement route-based code splitting: the newsletter page, donate page, and section hubs each ship a much smaller bundle than the full site shell.

**Priority:** High

---

## F-07 — Render-blocking third-party scripts in `<head>`

**Evidence:** Lighthouse "Render-Blocking Resources" audit (visible in JSON). Combined with F-01's TBT figure and the fact that `html-load.cc/loader.min.js` appears in `<head>`, render-blocking is the upstream cause.

**Interpretation:** Synchronous scripts in `<head>` block the parser. The browser must execute or skip each before it can render anything.

**Impact:** Adds ~200–500 ms of blank-screen time on top of the JS execution cost. Compounds with F-01.

**Recommendation:** Add `defer` to every non-critical `<script>` in `<head>`. Reserve `async` for truly independent scripts (analytics, ads).

**Priority:** High

---

## F-08 — Search results page likely has an application waterfall (search → render → fetch)

**Evidence:** Search page score is 26 (matches the average), but with CLS = 0.001 and TBT = 5,960 ms — the low CLS suggests the layout is reserved, but TBT is still extreme. Lighthouse does not directly surface "application waterfall" patterns, but the Day 11 §3.2 diagnostic (fetch → render → fetch → fetch) matches AP News's hub architecture: page loads → shell renders → search component fetches → suggestions fetch.

**Interpretation:** The single-article page also fetches related articles, gallery images, ad slots, and tag manager data after initial paint. Each fetch is a potential reflow + JS execution.

**Impact:** Affects the perceived snappiness of navigation between pages — even after LCP fires, the page keeps "loading" visible content.

**Recommendation:** Profile via Performance panel. Identify the top 3 fetches after LCP and inline / defer / prefetch them. Move non-critical fetches to `requestIdleCallback`.

**Priority:** Medium

---

## F-09 — Photography hub: image-heavy page with no measured CLS, but no AVIF / responsive checks either

**Evidence:** `lighthouse/04-photography.json` LCP 37.4 s. The Photography hub is an image grid; no CLS likely because images have explicit dimensions. Lighthouse "modern-image-formats" and "uses-responsive-images" audits were intentionally skipped (too slow on AP News); need a targeted check.

**Interpretation:** LCP 37 s on a photo hub strongly suggests the first photo (the grid lead) is either not preloaded or is being delivered as a slow-loading format/size. Likely JPEG, possibly the original-resolution source.

**Impact:** Photography hubs are a key driver of engagement on news sites; 37 s LCP on what should be a visual-first page is a brand problem, not just a CWV one.

**Recommendation:** Capture the LCP element via Performance panel; convert hero/grid images to AVIF with `srcset`; add `<link rel="preload" as="image">` for the LCP image; consider eager-loading the first row of the grid.

**Priority:** High

---

## F-10 — Likely no content-hashed static assets (long cache lifetimes)

**Evidence:** TBT / LCP figures alone don't prove this, but the overall build pattern (full SPA bundle per page, no code splitting per F-06) is consistent with no content hashing. Lighthouse "uses-long-cache-ttl" was skipped for speed; needs a separate check on a representative asset.

**Interpretation:** If static assets don't have content hashes in their filenames, the only safe cache lifetime is short — meaning repeat visitors re-download unchanged assets on every visit, which inflates TBT and LCP on warm-cache scenarios.

**Impact:** Field data (Day 14 §1.4) on cache-warm visits is likely worse than the lab shows, because the cache isn't actually being leveraged. The Day 14 §2.2 "cache asymmetry" warning applies: lab is cold, field is warm — but only if caching is properly configured.

**Recommendation:** Confirm via `curl -I` on a static asset: look for `cache-control: max-age=31536000` AND a content-hash filename like `main.a3f9c2.js`. If either is missing, this is real.

**Priority:** Medium (pending verification)

---

## F-11 — World News section has the fastest LCP (21.9 s) — but it's still 9× the threshold

**Evidence:** `lighthouse/02-world-news.json` LCP = 21.9 s, the lowest of the 8 pages. CLS 0.001, TBT 6,370 ms.

**Interpretation:** Even the best-performing page is poor. The fact that section hubs render faster than the homepage (46.4 s) or article pages (~32 s) suggests the homepage is paying for additional above-the-fold modules (carousel, featured grid) that section pages don't carry.

**Impact:** Homepages typically get the most traffic, so its 46.4 s LCP hurts the most users.

**Recommendation:** Profile the homepage specifically to identify the top LCP-contributing module — likely the hero carousel or featured-story tiles. Consider deferring non-first-slide carousel images.

**Priority:** Medium

---

## F-12 — Lighthouse "Optimize DOM size" audit not run (too slow on AP News) — needs targeted check

**Evidence:** We intentionally skipped `unused-dom-nodes` and similar DOM-size audits for runtime reasons. AP News's HTML output (visible in screenshots) shows dense article lists with hundreds of section-nav links per hub page.

**Interpretation:** AP News section hubs (World, US, Politics, Sports, etc.) all share a template that includes the full mega-nav with hundreds of links. That's pure DOM weight — not visibly used by most visitors, but fully paid for in parse + layout cost.

**Impact:** Inflates LCP indirectly (more DOM = more layout work) and hurts INP (more elements to hit-test on every interaction).

**Recommendation:** Audit DOM size per route. Consider lazy-rendering the mega-nav on user interaction (hover/click), not on initial paint.

**Priority:** Low

---

## F-13 — Storage.getUsageAndQuota hangs in Lighthouse — Cloudflare bot detection or browser storage abuse

**Evidence:** Multiple lighthouse runs failed with `Runtime error encountered: Waiting for DevTools protocol response has exceeded the allotted time. (Method: Storage.getUsageAndQuota)`.

**Interpretation:** AP News's origin (or one of its third-party scripts) calls `navigator.storage.estimate()` in a way that doesn't resolve promptly. This is either legitimate site behavior (pre-allocating quota for IndexedDB) or bot-detection behavior (an anti-scraping measure that hangs on headless requests).

**Impact:** Doesn't directly affect users, but it makes Lighthouse audits harder to run — and any first-party scripting that calls storage APIs without timeouts inherits the same risk on real users.

**Recommendation:** If intentional, add a timeout. If bot detection, document for the Lighthouse runner script.

**Priority:** Low (operational, not user-facing)

---

## F-14 — No field data captured (CrUX, RUM)

**Evidence:** The PSI rate limit prevented capturing CrUX field data in this session. The Day 14 §2 divergence diagnostic — comparing field vs lab — would have given a stronger picture of which findings are worse on real mobile devices vs cold lab.

**Interpretation:** Per Day 14 §1.2, lab and field often diverge. AP News likely has a *better* field LCP than the lab suggests (warmer caches, faster real devices), but the gap between lab 30 s and field 4 s is still well outside "good".

**Impact:** Findings F-01 through F-09 are corroborated by lab data only. Field data would either downgrade the urgency (if field LCP is 5 s) or upgrade it (if field INP is failing).

**Recommendation:** Run `just setup` once and capture PSI field data for apnews.com origin and each of the 8 target URLs. Note divergences in `baseline.md`.

**Priority:** Medium

---

## F-15 — No web-vitals RUM installed (no `beacon`, no `sendBeacon` traffic)

**Evidence:** Network panel inspection of AP News shows no `sendBeacon` POSTs to a RUM endpoint (Day 14 §4.1.3). Their analytics appears to be traditional page-view tracking (Google Analytics, Chartbeat) rather than CWV-aware RUM.

**Interpretation:** AP News can see traffic numbers but not CWV numbers tied to specific users. Their performance decisions today are based on lab audits (like this one) rather than continuous field data.

**Impact:** They'll keep paying for fixes that affect real users only after the fact. No ability to detect regressions before users complain.

**Recommendation:** Per Day 14 §4.2 — install `web-vitals` with the attribution build, beacon on `visibilitychange` to a small endpoint. Even a Google Sheet receiving the JSONs would be enough to start.

**Priority:** Medium

---

## Findings not raised (out of scope or unverifiable from this session)

- **CSS extraction / critical CSS** — Lighthouse "render-blocking-resources" was run but the per-audit breakdown isn't surfaced here. Worth a dedicated check.
- **Service worker / caching strategy** — AP News ships no SW in our captures; for a news site, an SW could meaningfully warm-cache assets for returning visitors.
- **A11y / best practices / SEO audits** — out of scope for a performance audit, but Lighthouse runs them in 1 minute if needed.
- **Field INP** — requires `web-vitals` RUM (see F-15).
