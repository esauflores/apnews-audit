# Prioritization

This file documents two prioritization systems used across the audit:

1. **RICE** (Reach × Impact × Confidence ÷ Effort) — used in `findings.md` and the top-half of this file. Same as the instructor's framework (Day 5 §4).
2. **ICE** (Impact × Confidence × Ease) — the new system documented here per the HW directive. Different from RICE: no Reach dimension, Ease replaces Effort as a direct multiplier.

Both systems are applied to all current corrective findings so the rankings can be compared.

---

## ICE prioritization system

**Why ICE (and not RICE):** RICE's `Reach` dimension scores how many users a finding affects, which inflates organization-wide findings (every-page bugs) and deflates page-specific ones (donate-page CLS). For AP News — a single-property site where every page shares the same script bundle — Reach is essentially a constant 5, making it a redundant axis. ICE drops Reach and lets the Impact + Confidence + Ease axes do all the work.

**Dimensions (1–5 scale each):**
- **Impact** — How much does this finding move the needle for the user? (1 = barely noticeable, 5 = severe revenue/risk impact)
- **Confidence** — How sure are we about the impact estimate? (1 = hypothesis only, 5 = verified with multiple sources)
- **Ease** — How easy is it to ship? (5 = trivial one-line PR, 1 = multi-quarter architectural change). Inverse of Effort.

**Score formula:** `ICE = Impact × Confidence × Ease`. Maximum = 125, minimum = 1.

**Why this is different from RICE:**
- No `Reach` — irrelevant when every page shares a template (single-property sites).
- Ease is multiplied, not used as a denominator. This rewards "low-effort wins" with a higher score, which RICE also does, but the math is simpler to reason about.
- No risk of `divide by Effort = 1` artifacts (RICE can blow up to 100+ for trivial fixes).

**Trade-offs acknowledged:** ICE is shorter than RICE (3 axes vs 4) and lacks the population-scale dimension. It's appropriate for a single-property audit like AP News; it would be wrong for a portfolio-level prioritization across many sites.

---

## All corrective findings, ICE-scored

Sorted by ICE descending. Score range 1–125.

| # | Finding | Impact | Confidence | Ease | **ICE** | RICE (for comparison) |
|---|---|---:|---:|---:|---:|---:|
| 1 | Initial page functionality is significantly delayed (TBT) | 4 | 5 | 5 | **100** | 100.00 |
| 2 | TBT amplified 4× by mobile CPU throttle *(mobile callout of #1)* | 4 | 5 | 5 | **100** | 100.00 |
| 3 | Images do not render in order of user need | 4 | 4 | 5 | **80** | 60.00 |
| 4 | Delayed ad makes page look broken (donate CLS) | 5 | 4 | 4 | **80** | 40.00 |
| 5 | Soft-refresh transfer savings are ~0% | 4 | 4 | 4 | **64** | 40.00 |
| 6 | Mobile data cost: 10.75 MB per warm pageview on cellular *(mobile callout)* | 4 | 4 | 4 | **64** | 40.00 |
| 7 | Initial visual page load is significantly delayed (LCP) | 5 | 4 | 3 | **60** | 33.33 |
| 8 | Interactive controls invisible to AT | 5 | 3 | 4 | **60** | 37.50 |
| 9 | Initial page render is significantly delayed | 3 | 4 | 4 | **48** | 40.00 |
| 10 | Images ship without AVIF | 3 | 4 | 4 | **48** | 30.00 |
| 11 | JavaScript dominates the homepage payload | 4 | 4 | 3 | **48** | 26.67 |
| 12 | Fonts re-fetch on warm load | 2 | 3 | 3 | **18** | 10.00 |

**Top quartile (ICE ≥ 60):** 8 findings. Same quartile members as RICE, but the order changes.

**Below-threshold (ICE < 60):** 4 findings. The render-delay, AVIF, and JS-dominates findings drop here — they require meaningful engineering work that ICE's Ease axis correctly discounts.

### Appendix findings, ICE-scored

| Finding | I | C | E | **ICE** | RICE |
|---|---:|---:|---:|---:|---:|
| Single-article template CLS (0.069) | 4 | 4 | 4 | **64** | 40.00 |
| No field data captured (CrUX, RUM) | 2 | 5 | 5 | **50** | 40.00 |
| 1,096 total requests (request storm) | 3 | 4 | 3 | **36** | 20.00 |
| No web-vitals RUM installed | 3 | 5 | 2 | **30** | 18.75 |
| DOM-size audits skipped (mega-nav) | 2 | 3 | 3 | **18** | 10.00 |
| `Storage.getUsageAndQuota` hangs | 1 | 4 | 4 | **16** | 2.00 |

---

## ICE vs RICE — what changes?

Five findings have a **different quartile or rank** under ICE vs RICE:

| Finding | RICE rank | ICE rank | Δ | Why |
|---|---:|---:|---:|---|
| **Images do not render in order** | 2 | 3 (tie) | -1 | Same rank but ICE boosts it to ICE 80 (Ease 5 multiplier); RICE had it lower because Effort = 1 was already minimum. ICE rewards "trivial fix" more visibly. |
| **Initial visual load (LCP)** | 7 | 7 | — | Same rank. ICE = 60 (Ease 3 = medium effort). RICE = 33.3 (Effort 3 in denominator). Both rank this below the defer-script work. |
| **JS dominates payload** | 9 (last in main) | 11 | -2 | Drops under ICE because Ease = 3 (route-based splitting is real work). RICE's denominator dampens this less. |
| **Interactive controls (a11y)** | 6 | 8 (tie) | -2 | Drops because Confidence = 3 (visual inspection only, audit not run). RICE weighted Confidence at 4. |
| **Initial render delayed** | 3 (tie) | 9 (tie) | **-6** | **Biggest drop.** ICE sees Effort = 2 + Impact = 3 as low-priority; RICE saw Reach = 5 carry it to the top. **RICE's Reach axis was masking that this is moderate-effort, moderate-impact work.** |

**Key takeaway:** ICE correctly ranks "trivial fixes with high user impact" higher (Images-not-in-order), and correctly demotes "reach-everywhere but lots of work" findings (Initial render, JS dominates). The RICE ranking hid the fact that the render-delayed finding is actually a moderate-priority item because every page inherits it — under ICE, that "every page" effect is captured in Impact (which is moderate here, not severe).

---

## Sequencing (using ICE ranking)

Per Day 13 §7.4: low-effort wins first, structural work against the release calendar.

### Phase 1 — Low-effort wins (≤1 week)

Five findings, all ICE ≥ 80 OR Ease = 5:

1. **Initial page functionality is significantly delayed** (ICE 100, Ease 5) — defer scripts.
2. **Images do not render in order** (ICE 80, Ease 5) — add `fetchpriority`.
3. **Delayed ad makes page look broken (donate CLS)** (ICE 80, Ease 4) — reserve `/donate` element dimensions.
4. **Soft-refresh transfer savings are ~0%** (ICE 64, Ease 4) — service worker for 3P (start of phase).
5. **Interactive controls invisible to AT** (ICE 60, Ease 4) — add `aria-label`s after audit.

### Phase 2 — Structural fixes (weeks 2–4)

6. **Initial visual page load is significantly delayed (LCP)** (ICE 60, Ease 3) — preload + AVIF + srcset.
7. **Initial page render is significantly delayed** (ICE 48, Ease 4) — critical CSS + defer render-blocking.
8. **Images ship without AVIF** (ICE 48, Ease 4) — CDN content negotiation.
9. **Single-article template CLS** (ICE 64, appendix) — reserve ad-slot dimensions.
10. **JavaScript dominates the homepage payload** (ICE 48, Ease 3) — route-based code splitting.
11. **No field data captured** (ICE 50, appendix, Ease 5) — pull CrUX for 8 URLs.

### Phase 3 — Architectural (weeks 4+)

12. **Fonts re-fetch on warm load** (ICE 18) — font subset/preload cleanup.
13. **1,096 total requests** (ICE 36, appendix) — consolidate bid requests.
14. **No web-vitals RUM installed** (ICE 30, appendix) — install RUM.
15. **DOM-size audits skipped** (ICE 18, appendix) — lazy-render mega-nav.

---

## Mobile callouts (ICE)

Same as RICE: the 2 mobile-specific findings reinforce Phase 1 (TBT mobile ICE 100) and Phase 2 (mobile data cost ICE 64). They don't introduce new phase items.

---

## Overrides

Per Day 13 §5.4: overrides are legitimate and recorded.

- **F-04 (donate CLS) Reach override (RICE)**: AP News's revenue team would likely score Reach = 5 instead of 4. Same finding, different RICE rank. Documented for completeness.
- **No ICE overrides applied.** The audit ran without product owner input; if AP News weights Impact differently (e.g., brand reputation vs CWV), the ranking would shift but the math holds.

---

## Why two systems?

Both RICE and ICE are valid. RICE is the instructor's standard (Day 5 §4); ICE is the per-property alternative. The point of using both here is to show that:

1. **The top-tier findings are robust across systems.** Top 3 under RICE = top 3 under ICE.
2. **The middle-tier rankings shift meaningfully.** Items that RICE ranks high because of Reach can drop under ICE, where Impact + Confidence + Ease tell a different story.
3. **The same fix list emerges in both.** Phase 1 work is the same under both systems — high-impact, easy-to-ship, high-confidence fixes ship first regardless of how you weight Reach.

This redundancy is the point: the recommendations aren't artifacts of one scoring system.
