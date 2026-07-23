# Prioritization

*Method: RICE scoring per Day 5 §4. Score = (Reach × Impact × Confidence) ÷ Effort.*
*Reach and Confidence reflect lab-only evidence (no field data captured this session); Impact is a single 1–5 score derived from the per-finding Initial Load / Usability / User Delight sub-bullets in `findings.md`.*
*Sequencing per Day 13 §7.4: low-effort wins first, structural work against the release calendar.*

---

## Top-priority recommendations (top quartile by RICE score)

Cutoff: **RICE ≥ 25**. 9 of 12 main findings clear the bar. The "must do now" set:

| # | Finding | R | I | C | E | RICE | Phase |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | **Initial page functionality is significantly delayed** (TBT 5.9–9.0 s, 8 third-party scripts in `<head>`) | 5 | 4 | 5 | 1 | **100.00** | 1 |
| 2 | **Images do not render in order of user need** (no `fetchpriority`; secondary content paints before headline) | 5 | 3 | 4 | 1 | **60.00** | 1 |
| 3 | **Initial page render is significantly delayed** (FCP 5–12 s; render-blocking scripts in `<head>`) | 5 | 4 | 4 | 2 | **40.00** | 1 |
| 4 | **Delayed ad makes page look broken** (`/donate` CLS 0.8 — late-injecting element on conversion page) | 4 | 5 | 4 | 2 | **40.00** | 1 |
| 5 | **Soft-refresh transfer savings are ~0%** (10.75 MB warm vs 10.72 MB cold — cache benefit eaten by 3P re-fetches) | 5 | 4 | 4 | 2 | **40.00** | 2 |
| 6 | **Interactive controls invisible to assistive technology** (suspected, a11y audits not run) | 5 | 5 | 3 | 2 | **37.50** | 2 |
| 7 | **Initial visual page load is significantly delayed** (LCP 22–46 s; no preload/srcset) | 5 | 5 | 4 | 3 | **33.33** | 1 |
| 8 | **Images ship without AVIF** (1.92 MB transfer ≈ 1.87 MB uncompressed) | 5 | 3 | 4 | 2 | **30.00** | 2 |
| 9 | **JavaScript dominates the homepage payload** (4.39 MB / 54% of transfer) | 5 | 4 | 4 | 3 | **26.67** | 2 |

Below the cutoff (not in top quartile):

| # | Finding | R | I | C | E | RICE | Phase |
|---|---|---:|---:|---:|---:|---:|---|
| 10 | Fonts re-fetch on warm load (0.61 MB → 3.09 MB, 5× more bytes) | 5 | 2 | 3 | 3 | **10.00** | 3 |

---

## Appendix findings (verified but below the main-set cutoff)

These are still real issues but smaller in scope or harder to act on without more data. Tracked for future passes:

| Finding | RICE | Notes |
|---|---:|---|
| Single-article template CLS (0.069) — reserve ad-slot dims | **40.00** | Same fix pattern as donate CLS; deferred to phase 1 alongside it |
| No field data captured (CrUX, RUM) | **40.00** | Cheap to do — capture PSI Field Data for all 8 URLs |
| 1,096 total requests on the homepage (request storm) | **20.00** | Related to JS dominates; consolidate via header-bidding wrapper |
| No web-vitals RUM installed | **18.75** | Install `web-vitals` attribution build + beacon |
| DOM-size audits skipped (mega-nav) | **10.00** | Lazy-render mega-nav on user interaction |
| `Storage.getUsageAndQuota` hangs in Lighthouse | **2.00** | Operational, not user-facing |

---

## Sequencing

### Phase 1 — Low-effort wins (≤1 week)

Five findings, all single-PR front-end changes, no backend rebuild:

1. **TBT: defer/async every non-critical script in `<head>`** — RICE 100, effort 1. **Single PR.** Removes ~6 s of main-thread blocking across every page.
2. **fetchpriority on images** — RICE 60, effort 1. **Single PR.** Add `fetchpriority="high"` to LCP image, `low` to below-fold, `loading="lazy"` elsewhere.
3. **Extract critical CSS, inline only above-the-fold** — RICE 40, effort 2.
4. **Reserve `/donate` element dimensions** — RICE 40, effort 2. **One template change.** Drops CLS 0.8 → ~0.05.
5. **Reserve article-template ad-slot dimensions** (appendix) — RICE 40, effort 2. **One template change.**
6. **Preload LCP image, AVIF + `srcset`** — RICE 33, effort 3. **Pipeline + image CDN config.**

**Phase 1 outcome:** Median TBT should drop from 6 s → ~1 s. Median LCP from 33 s → ~4 s. CLS on `/donate` should move from "poor" (0.8) → "good" (<0.1).

### Phase 2 — Structural fixes (weeks 2–4)

6. **Service worker for 3P static JS** — RICE 40, effort 2. Self-host reCAPTCHA, GTM, OneTrust. Drops warm transfer 10.75 MB → closer to 3 MB.
7. **A11y audit + fix** — RICE 37.5, effort 2. Re-run `--only-categories=accessibility`; add `aria-label`, `alt`, fix heading order.
8. **AVIF conversion for hero + photography hub** — RICE 30, effort 2. CDN content-negotiation config.
9. **Route-based code splitting** — RICE 27, effort 3. `/newsletters`, `/donate` ship sub-100 KB shells.
10. **No field data capture** (appendix) — RICE 40, effort 1. Pull CrUX for all 8 URLs.

**Phase 2 outcome:** Warm-cache transfer drops by ~70%. All accessibility audits should pass. Field data flowing.

### Phase 3 — Architectural (weeks 4+)

11. **Font subset/preload cleanup** — RICE 10, effort 3.
12. **Consolidate ad bid requests via single header-bidding wrapper** — RICE 20, effort 3. (Appendix)
13. **Mega-nav lazy rendering on interaction** — RICE 10, effort 3. (Appendix)
14. **web-vitals RUM + attribution build** — RICE 18.75, effort 4. (Appendix)

---

## 25% threshold discussion

Per Day 13 §5.4, the top quartile (3 of 12 main findings at score ≥ 40) is the priority set. The full top-quartile table above includes scores down to RICE 25 — extending the cutoff to the lower quartile catches two more findings (LCP image preload, AVIF) which together would close the lab LCP gap by ~60%.

The cutoff is not strict: a finding with RICE 26 (route-based code splitting) may still ship in phase 2 if its dependencies are already in place from phase 1 work. RICE is a ranking aid, not a gate.

---

## Overrides

Per Day 13 §5.4: overrides are legitimate and recorded. None applied yet. The audit ran without product owner input; if AP News weights any of these dimensions differently (e.g., ad revenue vs CWV), they'd shift Impact scores and re-rank. Document any overrides here.

The single override to flag: **F-04 (donate CLS)** scored as Reach = 4 (it only affects the conversion page), but AP News's revenue team would likely score Reach = 5 because every donation click is on that page. Same finding, different RICE ranking. Not applied — recorded for completeness.
