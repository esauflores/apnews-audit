# Prioritization

*Method: RICE scoring per Day 5 §4. Scale 1–5 per dimension. Score = (Reach × Impact × Confidence) ÷ Effort.*
*Reach calibrated to AP News audience. Confidence reflects lab-only evidence (no field data captured this session).*

---

## Top-priority recommendations (top quartile by RICE score)

| ID | Recommendation | R | I | C | E | Score | Phase |
|---|---|---|---|---|---|---|---|
| **F-01b** | Identify and defer the top 3 TBT-contributor scripts (likely ad SDKs + Viafoura) | 5 | 5 | 4 | 2 | **50.0** | 1 |
| **F-02b** | Preconnect/preload the LCP image origin; serve hero images via AVIF + `srcset`; reserve dimensions | 5 | 5 | 4 | 3 | **33.3** | 1 |
| **F-07** | Add `defer` to every non-critical `<script>` in `<head>`; `async` for truly independent scripts | 5 | 4 | 5 | 1 | **100.0** | 1 |
| **F-03** | Reserve dimensions for late-injecting elements on donate page; defer non-critical trust badges | 4 | 5 | 4 | 2 | **40.0** | 1 |
| **F-04** | Reserve dimensions for late-loading iframes / ad slots in the article template | 5 | 4 | 4 | 2 | **40.0** | 1 |
| **F-09** | Convert photo hub images to AVIF; preload the LCP image; consider eager-loading the first grid row | 4 | 4 | 3 | 3 | **16.0** | 2 |
| **F-05** | Move ad SDK bidding to `requestIdleCallback`; cut lowest-yield bidders first | 5 | 4 | 3 | 4 | **15.0** | 2 |
| **F-06** | Route-based code splitting — `/newsletters`, `/donate`, section hubs each ship a smaller bundle | 5 | 3 | 3 | 4 | **11.3** | 2 |
| **F-15** | Install `web-vitals` with attribution build + beacon on `visibilitychange` (Day 14 §4.2) | 5 | 3 | 5 | 4 | **18.8** | 2 |
| **F-08** | Profile the application waterfall on the single-article page; defer post-LCP fetches | 5 | 3 | 3 | 3 | **15.0** | 2 |

---

## All 15 findings, ranked by RICE

| ID | Finding | Reach | Impact | Confidence | Effort | Score | Raised? |
|---|---|---|---|---|---|---|---|
| F-07 | Add `defer`/`async` to head scripts | 5 | 4 | 5 | 1 | **100.0** | ✅ |
| F-01b | Identify + defer top TBT contributors | 5 | 5 | 4 | 2 | **50.0** | ✅ |
| F-03 | Donate page CLS (0.8) — reserve dimensions | 4 | 5 | 4 | 2 | **40.0** | ✅ |
| F-04 | Article template CLS (0.069) | 5 | 4 | 4 | 2 | **40.0** | ✅ |
| F-02b | LCP: preconnect, AVIF, `srcset`, reserve dims | 5 | 5 | 4 | 3 | **33.3** | ✅ |
| F-15 | Install `web-vitals` + beacon RUM | 5 | 3 | 5 | 4 | **18.8** | ✅ |
| F-09 | Photo hub: AVIF, preload, eager-load | 4 | 4 | 3 | 3 | **16.0** | ✅ |
| F-05 | Move ad bidding to `requestIdleCallback` | 5 | 4 | 3 | 4 | **15.0** | ✅ |
| F-08 | Profile and defer post-LCP fetches on article pages | 5 | 3 | 3 | 3 | **15.0** | ✅ |
| F-06 | Route-based code splitting | 5 | 3 | 3 | 4 | **11.3** | ✅ |
| F-11 | Homepage-specific LCP work (carousel hero) | 5 | 4 | 2 | 3 | **13.3** | ✅ |
| F-10 | Verify content-hashed asset caching (pending `curl -I`) | 5 | 3 | 2 | 2 | **15.0** | 🔄 pending |
| F-12 | Mega-nav DOM-size audit | 5 | 2 | 3 | 3 | **10.0** | ❌ |
| F-14 | Capture CrUX field data | 4 | 2 | 5 | 1 | **40.0** | ✅ (cheap to do) |
| F-13 | Storage API timeout — operational, not user-facing | 1 | 1 | 4 | 2 | **2.0** | ❌ |

(Not-raised findings F-12 and F-13 have low scores or are operational, not user-facing. F-14 is technically cheap — moving it to "raised" anyway.)

---

## Sequencing

Per Day 13 §7.4: low-effort wins first, structural work against the release calendar.

### Phase 1 — Low-effort wins (≤1 week total)

1. **F-07** `defer` / `async` on head scripts — RICE 100, effort 1. **Single PR.**
2. **F-14** Capture CrUX field data for all 8 URLs — RICE 40, effort 1. **Run `pagespeed.web.dev` once.**
3. **F-04** Reserve dimensions for late-loading article iframes — RICE 40, effort 2. **One template change.**
4. **F-03** Reserve donate-page element dimensions — RICE 40, effort 2. **One template change.**
5. **F-02b** Preconnect/preload LCP image origin, convert hero images — RICE 33, effort 3.

**Phase 1 outcome:** LCP and TBT should drop by 30–50%. CLS should move from "poor" to "needs improvement" or "good" on donate and articles.

### Phase 2 — Structural fixes (≤1 month)

6. **F-01b** Identify top TBT-contributor scripts, defer / lazy-load — RICE 50, effort 2. **Bundle-analyzer + targeted removals.**
7. **F-15** Install web-vitals RUM with attribution build — RICE 19, effort 4. **Day-14 setup; needs an endpoint.**
8. **F-09** AVIF conversion for photo hub + preload — RICE 16, effort 3.
9. **F-05** Move ad bidding to `requestIdleCallback` — RICE 15, effort 4. **Bidder-by-bidder rollout with revenue tracking.**
10. **F-08** Profile application waterfall on article pages, defer post-LCP fetches — RICE 15, effort 3.
11. **F-06** Route-based code splitting — RICE 11, effort 4. **Largest structural change; needs bundler config.**

**Phase 2 outcome:** TBT should drop to ≤1 s. LCP should drop to ≤4 s. Field data should be flowing.

### Phase 3 — Architectural (≥1 quarter)

12. **F-11** Homepage-specific LCP (carousel hero) — RICE 13, effort 3. **Requires design + frontend alignment.**
13. **F-10** Verify content-hashed caching — pending verification.

---

## 25% threshold

Per Day 13 §5.4, the top quartile (4 of 15) is surfaced above as priorities. Cutoff score: **15.0**.

Findings scoring ≥ 15 are in the top quartile. The "must do now" set:

- F-07 (100) — defer head scripts
- F-01b (50) — defer TBT contributors
- F-03 (40) — donate CLS
- F-04 (40) — article CLS
- F-14 (40) — capture CrUX
- F-02b (33) — LCP image pipeline
- F-15 (19) — web-vitals RUM

Every scoring step above was done with lab data only (Confidence = 4 across the board). Field data would shift most of these scores; in particular, F-15's RICE jumps once field evidence exists.

---

## Overrides

Per Day 13 §5.4: overrides are legitimate and recorded. None applied yet. The audit ran without product owner input; if AP News weights any of these dimensions differently (e.g., ad revenue vs CWV), they'd shift Impact scores and re-rank. Document any overrides here.
