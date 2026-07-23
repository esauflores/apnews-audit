# Prioritization

This file documents three prioritization systems applied to all current corrective findings:

1. **RICE** (Reach × Impact × Confidence ÷ Effort) — Day 5 §4, used in `findings.md`.
2. **ICE** (Impact × Confidence × Ease) — different from RICE: no Reach, Ease as multiplier.
3. **WSJF** (Weighted Shortest Job First) — SAFe framework: Cost of Delay ÷ Job Size.

All three systems are applied to the same 18 corrective findings (17 main + 1 mobile callout counted as a separate line) + 6 appendix items, so the rankings can be triangulated.

---

## ICE prioritization system

**Why ICE (and not just RICE):** RICE's `Reach` dimension scores how many users a finding affects, which inflates organization-wide findings and deflates page-specific ones. For AP News — a single-property site where every page shares the same script bundle — Reach is essentially a constant 5, making it a redundant axis. ICE drops Reach and lets Impact + Confidence + Ease do all the work.

**Dimensions (1–5 scale each):**
- **Impact** — How much does this finding move the needle for the user? (1 = barely noticeable, 5 = severe revenue/risk impact)
- **Confidence** — How sure are we about the impact estimate? (1 = hypothesis only, 5 = verified with multiple sources)
- **Ease** — How easy is it to ship? (5 = trivial one-line PR, 1 = multi-quarter architectural change). Inverse of Effort.

**Score formula:** `ICE = Impact × Confidence × Ease`. Maximum = 125, minimum = 1.

### Impact derivation rule

The 3 sub-bullets in `findings.md` (Initial Load / Usability / User Delight, each 1–5) collapse to a single ICE Impact via this mechanical rule:

> **`Impact = max(Initial Load, Usability)`**

Rationale:
- A severe issue in any one user-facing dimension (e.g., `Usability = 5` on a conversion page, or `Initial Load = 5` on the LCP image) is more important than uniform-moderate impact across all three. Peak severity should win.
- `User Delight` is excluded because it is downstream of the other two — if `Initial Load` is good and `Usability` is good, `User Delight` follows. Including it would dilute the score for findings with a single sharp issue.
- No subjective judgment — same input → same output.

### Derivation table

| Finding | Initial Load | Usability | User Delight | **Derived Impact** | Original ICE Impact | Δ |
|---|---:|---:|---:|---:|---:|---:|
| Initial page render is significantly delayed | 5 | 3 | 2 | **5** | 3 | +2 |
| Initial visual page load is significantly delayed (LCP) | 5 | 3 | 2 | **5** | 5 | 0 |
| Initial page functionality is significantly delayed (TBT) | 4 | 5 | 3 | **5** | 4 | +1 |
| Images do not render in order of user need | 4 | 2 | 2 | **4** | 4 | 0 |
| Delayed ad makes page look broken (donate CLS) | 1 | 5 | 1 | **5** | 5 | 0 |
| Soft-refresh transfer savings are ~0% | 4 | 2 | 1 | **4** | 4 | 0 |
| Interactive controls invisible to AT | 0 | 5 | 4 | **5** | 5 | 0 |
| Images ship without AVIF | 3 | 2 | 2 | **3** | 3 | 0 |
| JavaScript dominates the homepage payload | 5 | 4 | 1 | **5** | 4 | +1 |
| Fonts re-fetch on warm load | 2 | 2 | 1 | **2** | 2 | 0 |

Three findings' Impact scores change under the rule (initial render, TBT, JS dominates — all of which had `Initial Load = 5` but my original subjective scoring had marked them moderate).

---

## WSJF prioritization system

**Why WSJF:** RICE and ICE both weight user-facing Impact heavily. WSJF flips the framing — instead of asking "how much does this affect users?", it asks "how much does delaying this cost us, and how big is the job?" This surfaces quick wins that RICE/ICE might rank lower because their impact is moderate but their Job Size is small (the opposite of JS dominates).

**Formula:** `WSJF = Cost of Delay ÷ Job Size`

**Cost of Delay (CoD)**, sum of three 1–10 subscores:
- **UBV** (User-Business Value) — how much user/business value does fixing this deliver?
- **TC** (Time Criticality) — does the user/business value decay if we wait? (e.g., donate CLS is critical during fundraising)
- **RR** (Risk Reduction) — does fixing reduce risk of revenue loss, a11y lawsuit, brand harm?

**Job Size (JS)**, 1–10 (1 = trivial one-line PR, 10 = multi-quarter architectural change; 5 = half-day to one-day).

### WSJF scoring table

| Finding | UBV | TC | RR | CoD | JS | **WSJF** |
|---|---:|---:|---:|---:|---:|---:|
| TBT 6–9 s on every page | 9 | 6 | 8 | 23 | 2 | **11.50** |
| TBT amplified 4× by mobile CPU throttle *(mobile callout)* | 9 | 6 | 7 | 22 | 2 | **11.00** |
| Delayed ad makes page look broken (donate CLS) | 10 | 9 | 9 | 28 | 3 | **9.33** |
| Interactive controls invisible to AT | 9 | 6 | 8 | 23 | 3 | **7.67** |
| Mobile data cost on cellular *(mobile callout)* | 7 | 5 | 6 | 18 | 4 | **4.50** |
| Initial visual page load is significantly delayed (LCP) | 9 | 7 | 6 | 22 | 5 | **4.40** |
| Initial page render is significantly delayed | 7 | 5 | 5 | 17 | 4 | **4.25** |
| Soft-refresh transfer savings are ~0% | 6 | 5 | 5 | 16 | 4 | **4.00** |
| Images do not render in order of user need | 6 | 4 | 4 | 14 | 1 | **14.00** |
| Images ship without AVIF | 5 | 4 | 4 | 13 | 4 | **3.25** |
| JavaScript dominates the homepage payload | 7 | 5 | 5 | 17 | 7 | **2.43** |
| Fonts re-fetch on warm load | 3 | 3 | 3 | 9 | 5 | **1.80** |

**Notable**: "Images do not render in order of user need" tops the WSJF ranking purely because Job Size = 1 (a one-line `fetchpriority` attribute change). RICE and ICE rank it lower because their Impact is moderate.

---

## All corrective findings, three-system comparison

| # | Finding | RICE | ICE | WSJF |
|---|---|---:|---:|---:|
| 1 | Initial page functionality is significantly delayed (TBT) | **100.00** | **125** | **11.50** |
| 2 | TBT amplified 4× by mobile CPU *(mobile callout)* | 100.00 | 125 | 11.00 |
| 3 | Page renders at ~1 fps during load/scroll/click *(HW8 frame chart)* | 80.00 | **100** | 12.00 |
| 4 | First-party bundle ships 82% unused code *(HW7 build outputs)* | 80.00 | 80 | 3.00 |
| 5 | First-party stylesheet render-blocking + 100% unused *(HW8 coverage)* | 70.00 | 70 | 4.00 |
| 6 | Images do not render in order of user need | 60.00 | 80 | **14.00** |
| 7 | OneTrust consent SDK runs sync in `<head>` *(HW7 build outputs)* | 60.00 | 60 | 5.00 |
| 8 | webcontentassessor.com is unnecessary vendor *(HW7)* | 50.00 | 50 | 6.00 |
| 9 | Delayed ad makes page look broken (donate CLS) | 40.00 | 80 | 9.33 |
| 10 | Initial page render is significantly delayed | 40.00 | 80 | 4.25 |
| 11 | Soft-refresh transfer savings are ~0% | 40.00 | 64 | 4.00 |
| 12 | Mobile data cost on cellular *(mobile callout)* | 40.00 | 64 | 4.50 |
| 13 | Interactive controls invisible to AT | 37.50 | 60 | 7.67 |
| 14 | Initial visual page load is significantly delayed (LCP) | 33.33 | 60 | 4.40 |
| 15 | Images ship without AVIF | 30.00 | 48 | 3.25 |
| 16 | No aggressive layer creation *(HW8 layers — paint cost is healthy)* | 25.00 | 25 | 1.00 |
| 17 | JavaScript dominates the homepage payload | 26.67 | 60 | 2.43 |
| 18 | Fonts re-fetch on warm load | 10.00 | 18 | 1.80 |

**Bold** = top-3 in that system. RICE scores for the 6 new (HW7 + HW8) findings reuse the same scoring methodology; ICE / WSJF scores derived via the same derivation rule. Ranking shifts as new findings enter the system.

### Appendix findings (three-system)

| Finding | RICE | ICE | WSJF |
|---|---:|---:|---:|
| Single-article template CLS | 40 | 64 | 7.00 |
| No field data captured (CrUX) | 40 | 50 | 5.00 |
| 1,096 total requests | 20 | 36 | 2.00 |
| No web-vitals RUM | 18.75 | 30 | 1.50 |
| DOM-size audits skipped | 10 | 18 | 1.00 |
| `Storage.getUsageAndQuota` hangs | 2 | 16 | 0.50 |

---

## Triangulation: top tier is robust, mid tier is contested

**Consensus across all three systems (top 3 in every system):**
- ✅ TBT 6–9 s on every page — top 3 in all 3 systems
- ✅ Images do not render in order — top 3 in all 3 systems
- ✅ Delayed ad / donate CLS — top 5 in all 3 systems

**Contested in the mid tier:**
- **Initial render delayed** ranks #3 in RICE, #2 in ICE, but **#8 in WSJF**. Reason: WSJF weights Job Size heavily; this finding is real engineering work (critical CSS extraction, defer render-blocking) even though it affects every page.
- **LCP** ranks #6 in RICE, #6 in ICE, but #7 in WSJF. Similar story.
- **JS dominates payload** ranks #10 in RICE, #7 in ICE, but **#11 in WSJF** (worst after Fonts). Real engineering work, modest direct user impact.

**Bottom tier (consensus):**
- Fonts re-fetch on warm load — bottom 2 in all 3 systems.

### Sensitivity analysis

How robust is the top tier to ±1 perturbation of any single dimension?

| Finding | Base ICE | ICE if C drops to 3 | ICE if E drops to 3 | Still top 3? |
|---|---:|---:|---:|---|
| TBT (125) | 125 | 100 | 100 | ✅ Yes |
| Initial render (80) | 80 | 60 | 60 | ✅ Yes |
| Images (80) | 80 | 60 | 64 | ✅ Yes |
| Delayed ad (80) | 80 | 60 | 60 | ✅ Yes |
| Soft-refresh (64) | 64 | 48 | 48 | ⚠️ drops to mid |
| LCP (60) | 60 | 45 | 45 | ⚠️ drops |

**Top 4 are robust** — TBT, Initial render, Images, Delayed ad remain top quartile even with ±1 perturbation. Soft-refresh and LCP could fall with a one-step Confidence or Ease reduction.

For WSJF, ±1 perturbation of CoD shifts scores by ~10% — top 3 (Images 14, TBT 11.5, TBT mobile 11, Delayed ad 9.33) all remain top tier.

---

## Sequencing — Phase 1 plan under triangulation

The Phase 1 plan that satisfies **all three systems** (top tier in RICE, ICE, AND WSJF):

| Phase 1 item | RICE rank | ICE rank | WSJF rank | Job Size | Notes |
|---|---:|---:|---:|---|---|
| **Initial page functionality is significantly delayed (TBT)** | 1 | 1 | 2 | XS | defer scripts in `<head>` — single PR |
| **Images do not render in order of user need** | 2 | 3 | 1 | XS | add `fetchpriority="high"` to LCP image |
| **Delayed ad makes page look broken (donate CLS)** | 4 | 4 | 4 | S | reserve `/donate` element dimensions |
| **Interactive controls invisible to AT** | 6 | 8 | 5 | S | add `aria-label` after a11y audit |

All four of these are consensus top-3-or-better across all three systems. The Phase 1 plan is **defensible against any single prioritization framework**.

The mid-tier (Initial render, LCP, JS dominates, Soft-refresh) move to Phase 2. They are real and worth doing, but their priority is framework-dependent — they're robust under RICE/ICE but the WSJF view (which weights Job Size heavily) demotes them.

---

## Mobile callouts

Both mobile-specific findings (TBT × 4× CPU throttle; cellular data cost on warm visits) score in the top tier across all three systems. They reinforce why Phase 1 (defer scripts) and Phase 2 (service worker + code splitting + AVIF) matter most for the median reader.

---

## Overrides

Per Day 13 §5.4: overrides are legitimate and recorded.

- **RICE: donate CLS Reach override** — AP News's revenue team would score Reach = 5 instead of 4. Same finding, higher RICE rank. Documented for completeness.
- **No ICE or WSJF overrides applied.** The audit ran without product owner input; if AP News weights Impact differently (e.g., brand reputation vs CWV), the rankings would shift but the math holds.

---

## Why three systems?

Three systems = three different framings of the same problem:

1. **RICE** asks "how many users, how much impact, how sure, how big a job?" — favors reach-everywhere wins.
2. **ICE** asks "how much impact, how sure, how easy?" — drops Reach (constant for single-property audits) and rewards quick wins.
3. **WSJF** asks "how much does waiting cost us, divided by job size?" — directly surfaces "tiny job + non-trivial cost of delay" items like Images-not-in-order.

A finding that ranks top-3 in **all three** systems is robust to methodology. A finding that ranks top-3 in **only one** system is method-dependent and deserves a second look before committing engineering time.

This triangulation is the deliverable. The Phase 1 plan is what we'd actually ship; the three-system comparison is the audit trail that justifies the plan.
