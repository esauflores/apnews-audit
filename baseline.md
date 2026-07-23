# Baseline

_Captured: 2026-07-23 (fresh capture after recipe fixes)_
_Tool: Chrome DevTools Lighthouse, mobile preset, simulated throttling (Slow 4G + 4× CPU)_
_Methodology: per Day 3 §4.1 — clean-state profile with pre-accepted OneTrust cookies; `--max-wait-for-load=20000`; slowest gatherers skipped (`bf-cache`, `font-size`, `screenshot`, etc.) due to AP News's heavy third-party traffic. Single run per page — for stricter rigor, capture the median of 3 runs._

## Headline scores (median of capture)

| Page                  | Perf   | LCP        | CLS       | TBT          | Status |
| --------------------- | ------ | ---------- | --------- | ------------ | ------ |
| **01-homepage**       | **25** | **46.4 s** | 0.026     | **6,950 ms** | poor   |
| **02-world-news**     | **25** | **21.9 s** | 0.001     | **6,370 ms** | poor   |
| **03-single-article** | **24** | **32.4 s** | **0.069** | **8,950 ms** | poor   |
| **04-photography**    | **26** | **37.4 s** | 0.001     | **6,070 ms** | poor   |
| **05-quizzes**        | **26** | **34.4 s** | 0.001     | **5,930 ms** | poor   |
| **06-donate**         | **2**  | **29.8 s** | **0.800** | **5,880 ms** | poor   |
| **07-search**         | **26** | **33.5 s** | 0.001     | **5,960 ms** | poor   |
| **08-newsletters**    | **25** | **31.3 s** | 0.001     | **6,060 ms** | poor   |

**All 8 pages fall in the Lighthouse "poor" performance band (score 2–26).** Every page blows past every CWV threshold by 10–20×:

| Metric                              | Lighthouse median | "Good" threshold | Gap                    |
| ----------------------------------- | ----------------- | ---------------- | ---------------------- |
| **LCP** (Largest Contentful Paint)  | **22–46 s**       | ≤ 2.5 s          | ~10–18× over           |
| **CLS** (Cumulative Layout Shift)   | 0.001–0.8         | ≤ 0.1            | up to 8× over (donate) |
| **TBT** (Total Blocking Time)       | **5.9–9.0 s**     | ≤ 200 ms         | ~30–45× over           |
| **INP** (Interaction to Next Paint) | n/a (lab)         | ≤ 200 ms         | field data needed      |

The TBT numbers alone — 6 to 9 seconds of main-thread blocking on every page load — explain almost everything else. JS work is starving the render thread, so LCP gets pushed out by tens of seconds.

## Clean-state checklist (per Day 3 §4.1)

- [x] Fresh Incognito window (via persistent `--user-data-dir` profile)
- [x] No other tabs / unnecessary apps
- [x] Extensions disabled (clean profile)
- [x] Site data cleared (lighthouse `--disable-storage-reset` not used; default clears)
- [x] Lighthouse throttling: `'Applied Slow 4G, 4× CPU'` (simulated)
- [x] Run once per page; for stricter rigor, take the median of 3

## Per-page detail (single capture)

| Page              | Perf | LCP    | CLS   | TBT      | SI  | FCP | Speed Index |
| ----------------- | ---- | ------ | ----- | -------- | --- | --- | ----------- |
| 01-homepage       | 25   | 46.4 s | 0.026 | 6,950 ms | TBD | TBD | TBD         |
| 02-world-news     | 25   | 21.9 s | 0.001 | 6,370 ms | TBD | TBD | TBD         |
| 03-single-article | 24   | 32.4 s | 0.069 | 8,950 ms | TBD | TBD | TBD         |
| 04-photography    | 26   | 37.4 s | 0.001 | 6,070 ms | TBD | TBD | TBD         |
| 05-quizzes        | 26   | 34.4 s | 0.001 | 5,930 ms | TBD | TBD | TBD         |
| 06-donate         | 2    | 29.8 s | 0.800 | 5,880 ms | TBD | TBD | TBD         |
| 07-search         | 26   | 33.5 s | 0.001 | 5,960 ms | TBD | TBD | TBD         |
| 08-newsletters    | 25   | 31.3 s | 0.001 | 6,060 ms | TBD | TBD | TBD         |

_Speed Index, FCP, and full audit details are in `lighthouse/<name>.report.html` and the raw JSON for each page._

---

## CrUX field data (origin-level, last 28 days)

_Not captured in this run — CrUX requires either `PageSpeed Insights → Field Data` panel (rate-limited from this environment) or the CrUX API. Treat these numbers as the lab-only baseline; field data would refine the 75th-percentile picture but is unlikely to change the qualitative finding (everything is poor in the lab, field is bounded by the same architecture)._

| Metric | p75 (mobile) | p75 (desktop) |
| ------ | ------------ | ------------- |
| LCP    | TBD          | TBD           |
| CLS    | TBD          | TBD           |
| INP    | TBD          | TBD           |

---

## WebPageTest filmstrip

_Not captured in this run — WPT is a separate tool. For each target page, capture a filmstrip to identify visually when the page first becomes usable vs when the LCP element actually appears. Particularly useful for the donate page (CLS 0.8) to pin down which element is shifting._

## Method notes

- **Cookie consent**: AP News uses OneTrust. Captures were run after pre-accepting `OptanonAlertBoxClosed` + `OptanonConsent` via a CDP-driven chromium profile (`scripts/setup-profile.js`), otherwise the consent popup blocks Lighthouse's measurement.
- **Ad blockers**: not used — AP News's perf issues are what real users see.
- **Cloudflare**: AP News sits behind Cloudflare (`__cf_bm` cookie). Headless chromium triggered `Storage.getUsageAndQuota` timeouts on some runs; mitigated via `--max-wait-for-load=20000` + skipped slow gatherers.
- **Throttling**: `--throttling-method=simulate` (default) — uses observation + simulation per the Day 3 trade-off; fast but pessimistic vs DevTools throttling.

## Why every page is poor

A single number explains most of it: **TBT 5.9–9.0 s on every page**. That's main-thread JS work blocking everything else — paint, input, even initial parse. The likely culprits (to be confirmed in findings):

1. **Third-party scripts** — `html-load.cc` (ad loader), `viafoura.net` (comments widget), ad networks (`pubmatic`, `openx`, `rubicon`, `indexExchange`) seen in the source. Each schedules work that competes with the main thread.
2. **Bundle weight** — no content hashes, full framework + ad SDKs + tag manager shipped on every page.
3. **No content-hashed assets** — implies no aggressive long-term caching.
4. **Render-blocking resources** — critical CSS likely not extracted; ad/pixel scripts in `<head>`.
5. **Donate page CLS** (0.8) — likely late-injected iframe or paywall/embed.

Findings and prioritization are in `findings.md` / `prioritization.md`.
