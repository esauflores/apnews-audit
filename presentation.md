# AP News Performance Audit · Stakeholder Report

*Prepared for product leadership, March 2026 · FE413 Web Performance*

---

## The bottom line

**Yes. And most of the wins ship in week one.**

Every page we tested fails the standard mobile performance bar. The cause is well-understood: **eight third-party scripts consume 12 seconds of main-thread time** before the headline image paints. None of them is needed to render an article.

| Phase | Scope | Time | Expected outcome |
| --- | --- | --- | --- |
| **Phase 1** | Four quick wins | Week 1 | Address 90% of the user-visible cost. No backend rebuild. |
| **Phase 2** | Five structural fixes (route splitting, AVIF, service worker, vendor cuts) | Weeks 2–4 | Median LCP −60%. |
| **Phase 3** | Architectural (vendor SLAs, performance budget in CI, audit dashboard) | Weeks 4+ | Hold perf score > 75 long-term. |

---

## What it costs the business, today

Four ways the slow page costs us money, right now:

### Readers leaving

**22–46 second page loads** are 9–18× the threshold where most users bounce. Google's research shows bounce rate climbs sharply with load time past 3 seconds. *Sources: Google / DoubleClick "The Need for Mobile Speed" (2016); AKAMAI / Gomez "Impact of Web Latency on Conversion Rates" (2017).*

### Search ranking

**"Poor" on every audited page.** Google uses page speed as a mobile-first ranking signal since 2020. Every page we tested is in their "poor" band. Competitors above us on the same search results pages have faster pages.

### /donate conversion

**Buttons move during checkout.** Layout shift of 0.8 on the donate page is 8× the threshold. Readers click "Give monthly" and the button slides under their cursor. Direct revenue risk.

### Brand perception

**Pages render at 0.9 frames per second.** Independent frame measurements: scroll is frozen, click lags, pages paint at less than one frame per second. Readers perceive the site as broken — and then they tell their friends.

---

## What we found

**One root cause:** eight third-party scripts that don't need to be in the first paint.

They serve ads, analytics, and personalization — all of which can wait until after the article is visible. None of them is required to read a news story. Together they run for 12 seconds before the headline image paints.

Three numbers that explain it:

- **90.9%** of JavaScript ships but doesn't execute on first paint. On the homepage, 14.7 MB of JavaScript is downloaded but never runs. Most of it is third-party vendor bundles loaded speculatively.
- **97.5%** of CSS bytes ship but never match. Styles for article, photography, and donate pages all ship on every page. Most of the stylesheet is for components the user never sees.
- **1.87 seconds** — the largest single offender is a "content quality assessment" tool that runs for nearly 2 seconds per pageview with no visible user value. Highest-priority cut.

---

## What is already working

A failure-only report reads as hostile. The team's prior work matters — and there's a lot of it that the next phase of work builds on, not tears down.

- **Content delivery is pre-rendered, edge-cached.** Pages are server-rendered and cached at the CDN edge — first byte to first paint is under 100 ms.
- **Compression is in place.** Brotli delivers 73–86% savings on text payloads across HTML, JS, CSS, and JSON. No further improvement available at the text layer.
- **Caching works.** Content-hashed first-party bundles cache for 1 year. Return visitors skip most of the download entirely.
- **First-party code is lean.** 91% of the homepage's unused bytes are from third-party vendors. Your own code is clean — the fix lives with the vendors, not the codebase.

---

## The fixes, ranked

**Four fixes ship in week one.** Ranked by three independent frameworks. These four rank top-tier in all three — meaning the priority is robust to methodology, not an artifact of how we scored it.

| # | Fix | Effort | Addresses |
| --- | --- | --- | --- |
| **1** | Defer scripts in `<head>` so they don't block paint | 1 PR · 1 engineer-day | readers leaving, search ranking |
| **2** | Add `fetchpriority="high"` to the LCP image | 1 line of HTML | readers leaving, search ranking |
| **3** | Reserve dimensions on the `/donate` page elements | 1 CSS line | /donate conversion, brand perception |
| **4** | Audit and add `aria-label` to icon-only buttons | 1 PR · 1-day audit | brand perception, legal risk (a11y) |

**No backend rebuild. No ads product change. No business logic touched.**

---

## The plan

### Phase 1 · Week 1 — Stop the bleed

- Defer scripts in `<head>`
- Add `fetchpriority` to LCP image
- Reserve /donate element dimensions
- Add `aria-label`s after audit

**Expected outcome:** −55% blocking time · +30 perf score

### Phase 2 · Weeks 2–4 — Fix the structure

- Route-based code splitting
- AVIF images
- Service worker for 3P caching
- Cut webcontentassessor
- OneTrust async mode

**Expected outcome:** median LCP −60%

### Phase 3 · Weeks 4+ — Reset the contract

- Vendor SLA: each 3P pays for its budget
- Performance budget in CI
- Per-route 3P allowlist
- Audit dashboard, monthly review

**Expected outcome:** hold perf > 75 long-term

---

## Cost of inaction

What happens if we do nothing?

- Median page speed stays at **~33 seconds**. We continue to rank below faster competitors on every search term.
- **/donate** keeps shifting 0.8 during checkout. Donations lost per month are unmeasured but not zero.
- Every new feature ships against a 6-second main-thread bottleneck. Every engineer pays for it in time spent waiting on dev tools.
- Engineering time continues to be spent firefighting reader complaints about "the site is slow" instead of building things that grow the business.

The fix is bounded — **two engineering weeks** for phase 1 + 2. The cost of not fixing it is unbounded.

---

## The ask

**We need three things from you:**

1. **Approve phase 1.** Four PRs ship in week one. No backend changes. No stakeholder meetings required mid-stream.
2. **Stakeholder alignment on ads.** Phase 2 includes asking bidders (Prebid, GAM) to defer their scripts. We need a contact at the ads product team to drive that conversation.
3. **Sign off on a performance budget.** Once phase 1 ships, we add a performance budget in CI. Without it, regressions are inevitable in six months.

---

*Full audit data, methodology, and finding-level evidence: [github.com/esauflores/apnews-audit](https://github.com/esauflores/apnews-audit)*

*This is the same report as `presentation.html` (slide deck format), presented in markdown for review and sharing.*
