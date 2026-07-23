# AP News Performance Audit · Implementation Guide

For: the engineer who picks up approved findings and has to actually fix them.
Companion to: `presentation.md` (stakeholder), `findings.md` (all findings), `prioritization.md` (ranking), `baseline.md` (raw data).

**Reader's question:** *What do I change, and how will I know it worked?*

Each PR is a self-contained unit of work. You can pick any PR, implement it, and ship it without reading the rest of the guide.

---

## How to use this guide

| If you need… | Go to |
| --- | --- |
| Specific PR instructions (mechanism, repro, fix, verify) | This document, per-PR section |
| Full evidence trail for a finding | `findings.md` |
| Raw measurements behind a claim | `baseline.md` |
| Why this PR is prioritized | `prioritization.md` |
| Stakeholder framing (for the leadership convo) | `presentation.md` |

---

## Coverage statement

> A silently-skipped domain and a domain with no findings look identical from outside. Below is the explicit boundary — anything not mentioned here, we didn't look.

### Covered

- 8 audited pages (homepage + 7 archetypes)
- Mobile preset (Lighthouse `--form-factor=mobile`)
- JS bundles, CSS bundles, images
- 3rd-party loading strategy + impact
- Unused JS / unused CSS via puppeteer v8 coverage API
- Frame chart (load + scroll)
- Stacking contexts + paint layers
- Rendering strategy per page

### Skipped (explicit "no findings" — looked, concluded not applicable for these pages)

- Desktop PSI scores
- INP field data (lab TBT only)
- CrUX / RUM field data
- Full accessibility audit (visual inspection only — see PR 4)
- SEO / Best Practices / Agentic Browsing Lighthouse categories
- WebPageTest filmstrip

### Considered and concluded not applicable

- Offline support / service worker for offline (news content is perishable; not a fit)
- HTTP/3 (not advertised by AP News's CDN)
- WebSockets / SSE (not used by the site)
- PWA / install prompts (not a news-content fit)

---

## Reproduction tooling

The `justfile` is the source of truth for measurement. If you need to verify a claim from this guide, run the recipe and compare.

| Recipe | What it does |
| --- | --- |
| `just setup` | One-time: pre-accepts OneTrust cookies via puppeteer |
| `just audit URL NAME` | Single-page Lighthouse (mobile, simulated throttling) |
| `just audit-all` | All 8 audited pages in sequence; JSON to `lighthouse/*.json` |
| `just build-capture` | Puppeteer scan of JS/CSS bundles, image formats, 3P loading |
| `just coverage-frames` | Coverage API + frame chart + layers/animations |
| `just rendering-strategy` | Detect rendering strategy per page |
| `just shoot` | Capture viewport screenshots |
| `just present` | Render this presentation as PNGs |
| `just report` | Print markdown summary table |

If a number in this guide differs from what you measure, do not assume this guide is correct. Re-run, and update the guide.

---

## Phase 1 · Week 1 — Stop the bleed

### PR 1 · Defer scripts in `<head>` to stop blocking paint

> `local` — no cross-team coordination required (one vendor contract check).

**Mechanism**

8 third-party scripts load synchronously in `<head>`. HTML parsing blocks until each executes. Browser cannot paint or respond to user input until the script chain completes → FCP 7.2 s, TBT 6.95 s on the homepage.

**Reproduction**

```bash
# Look for render-blocking scripts in head
just audit https://apnews.com/ homepage
# Expected: ≥8 render-blocking resources listed

just build-capture | jq '.syncScripts'
# Lists the sync (no async/defer) external scripts
```

**The fix**

```html
<!-- before -->
<script src="https://cdn.cookielaw.org/.../OtAutoBlock.js"></script>

<!-- after (most scripts) -->
<script src="https://cdn.cookielaw.org/.../OtAutoBlock.js" defer></script>

<!-- OR (cleaner): -->
<script type="module" src="..."></script>  <!-- modules are deferred by default -->
```

**Verify it worked**

Re-run `just audit`. Expected deltas on the homepage:

| metric | before | after |
| --- | --- | --- |
| FCP | 7.2 s | 2–3 s |
| TBT | 6.95 s | 1–2 s |
| LCP | 46.4 s | 10–15 s |
| perf score | 25 | 60–80 |

**Risks / edge cases**

- Don't blindly defer everything. Anti-flicker / consent SDKs may need synchronous load to avoid FOUC. OneTrust's `OtAutoBlock.js` is intentionally sync — coordinate with CMP/legal before deferring it (covered in PR 6).
- Test page on slow 3G — some scripts may need to be ordered, not just deferred.
- Verify interactive features still work (search box, comments widget, video player).
- `webcomponents-loader` is already deferred — preserve that.

**Structural vs local**

Mostly local. The template file(s) that render `<head>` content are in Brightspot's control. One vendor contract check (OneTrust) before deferring their SDK.

---

### PR 2 · Add `fetchpriority="high"` to the LCP image

> `local` — no cross-team coordination.

**Mechanism**

Browser fetches the LCP image at the same priority as below-fold images and ads. They compete for bandwidth. Adding `fetchpriority="high"` tells the browser which image to start first.

**Reproduction**

```
# Network panel → filter by Img
# LCP image shows Priority: Low / Medium
# Compare to a below-fold ad image
# Both have same priority — wrong.
```

**The fix**

```html
<!-- before (LCP img tag) -->
<img src="https://dims.apnews.com/.../hero.webp"
     srcset="..." sizes="..."
     width="1200" height="800"
     alt="Headline story image">

<!-- after -->
<img src="https://dims.apnews.com/.../hero.webp"
     srcset="..." sizes="..."
     width="1200" height="800"
     fetchpriority="high"
     alt="Headline story image">

<!-- OR via link preload (works for CSS background images too) -->
<link rel="preload" as="image"
      href="https://dims.apnews.com/.../hero.webp"
      imagesrcset="..." imagesizes="...">
```

**Verify it worked**

```bash
# Re-run lighthouse, watch LCP timing
just audit https://apnews.com/ homepage
# LCP should drop noticeably (10-30%)

# Network panel: LCP image should
# show "Priority: High" instead of Low/Medium
```

**Risks / edge cases**

- Don't add to all images. Only the LCP element. Otherwise you create contention.
- Different pages have different LCP elements. Coordinate with each template's rendering logic.
- Test on slow connections — preloading can hurt if it starves other resources.
- Some ad slots have their own priority logic; don't override.

**Structural vs local**

Local.

---

### PR 3 · Reserve dimensions on `/donate` page elements

> `local` — no cross-team coordination.

**Mechanism**

Late-injecting element on `/donate` — most likely a payment-provider iframe (Stripe / PayPal / Donorbox) or a trust-badge — pushes existing content down after paint. Reader clicks "Give monthly", the button slides under their cursor. CLS = 0.8 (8× the "good" threshold of 0.1).

**Reproduction**

```bash
# Chrome DevTools → Performance
# Enable "Layout Shift Regions"
# Reload /donate
# Watch for the late-injecting element
# (clue: the shift happens ~1s after FCP)

just audit https://apnews.com/donate donate
# CLS = 0.8 (this is what you should see)
```

**The fix**

Identify the late-injecting element via Performance panel, then:

```html
<!-- option A: placeholder with explicit dimensions -->
<div class="payment-iframe-placeholder"
     style="width: 100%; aspect-ratio: 4/3; background: #f5f4ef;">
  <!-- iframe mounts here at runtime, no shift -->
</div>

<!-- option B: explicit width + height on the iframe itself -->
<iframe src="https://payments.example.com/..."
        width="600" height="450"
        loading="lazy"
        title="Donation form"></iframe>

<!-- option C: defer non-critical trust badges below the fold -->
<!-- move them to the footer or load on user scroll -->
```

**Verify it worked**

```bash
just audit https://apnews.com/donate donate
# CLS should drop to <0.05
# perf score should rise to ~50+
```

**Risks / edge cases**

- Identify the right element first. Don't blindly reserve space — use Performance → Layout Shift Regions to confirm which element causes the shift.
- Some payment providers need a fixed pixel size, not aspect-ratio. Check the provider's docs.
- Trust-badge height varies by provider; pick the largest variant.
- If the badge is dynamically loaded with different content sizes, reserve the maximum.

**Structural vs local**

Local.

---

### PR 4 · A11y audit + `aria-label` on icon-only buttons

> `structural` — needs full a11y audit before fixes.

**Mechanism**

Icon-only buttons in the section header and mega-nav likely lack accessible names. Screen-reader users cannot reach key controls. Visual inspection of the homepage DOM suggests buttons without text or `aria-label`; full a11y audit not yet run (Confidence = 3).

**Reproduction**

```bash
# Run a full a11y audit (we only did visual inspection)
npx --yes lighthouse https://apnews.com/ \
  --only-categories=accessibility \
  --chrome-flags="--headless=new --no-sandbox --user-data-dir=/tmp/chromium-apnews-profile"
# Or: axe DevTools / Pa11y / WAVE
```

**The fix**

```html
<!-- before (icon-only button) -->
<button class="icon-search">
  <svg aria-hidden="true">...</svg>
</button>

<!-- after -->
<button class="icon-search" aria-label="Search">
  <svg aria-hidden="true">...</svg>
</button>

<!-- image elements without alt -->
<img src="...">           <!-- before -->
<img src="..." alt="Brief description">  <!-- after -->
<img src="..." alt="">             <!-- decorative -->
```

**Verify it worked**

```bash
# Re-run a11y audit; expect:
# - 0 elements with missing aria-label
# - 0 images with missing alt
# - 0 headings out of order
# - Lighthouse a11y score ≥ 90

just audit https://apnews.com/ homepage   # manual a11y review
```

**Risks / edge cases**

- Don't localize just one icon. Apply consistent labels across the site.
- Decorative images should have `alt=""`, not be removed (screen readers handle missing alt differently).
- Heading order matters: don't promote a styled div to h3 if no h2 exists above it.
- Test with screen reader (VoiceOver / NVDA) — automated audits catch ~30% of issues.

**Structural vs local**

Structural. The visual inspection only flagged the homepage. A full a11y audit across all 8 pages is a prerequisite. Coordinate with a11y lead or external auditor.

---

### Phase 1 · Ship criteria

After all 4 PRs:

- All 4 PRs merged
- Homepage perf score > 60
- No regressions on existing pages
- A11y audit clean
- Frame chart shows > 25 fps on load
- /donate CLS < 0.05

**If any criterion fails, do not declare phase 1 done. Investigate before moving to phase 2.**

---

## Phase 2 · Weeks 2–4 — Fix the structure

### PR 5 · Cut `webcontentassessor.com`

> `structural` — vendor contract check required.

**Mechanism**

"Content quality assessment" script. 1.87 s of script execution per pageview — the single largest TBT contributor. Provides no visible user value.

**The fix**

```bash
# In tag manager: exclude scripts.mf.webcontentassessor.com
# If only used on /article/*, scope to that template only
# If unused entirely, remove the <script> tag

# Verify by checking if editor team uses the score
# (ask product owner; if no internal user, delete)
```

**Risks**

- Check the contract — is there a minimum-spend clause?
- Editor team may use the dashboard; coordinate before deleting.

---

### PR 6 · OneTrust async mode

> `structural` — CMP / legal review required.

**Mechanism**

`OtAutoBlock.js` loads synchronously, blocks parsing for ~1.2 s. Intentional by OneTrust to ensure consent state before ad bid fires.

**The fix**

```html
<!-- before -->
<script src="https://cdn.cookielaw.org/.../OtAutoBlock.js"></script>

<!-- after (using OneTrust's async config) -->
<script src="https://cdn.cookielaw.org/.../otSDKStub.js"
        data-document-script="true" async></script>
<!-- OtAutoBlock loaded via OtAutoBlock.js URL still, but called from OneTrustStub -->
```

**Risks**

- Ad bidders may fire before consent is recorded → GDPR violation risk.
- OneTrust support contract may require specific load order; check docs.

---

### PR 7 · Route-based code splitting

> `structural` — bundler config.

**Mechanism**

Single content-hashed `All.min.*.gz.js` bundle ships on every page. Homepage coverage shows 91 KB of the 111 KB bundle never executes on first paint. /newsletters (mostly static) ships the same shell as /article (heavy interactive).

**Reproduction**

```bash
# Same All.min.* bundle is requested
# on /, /article/*, /donate, /search,
# /photography, /quizzes, /newsletters.

just build-capture | jq '.topScriptsByBytes | .[0:3]'
```

**The fix**

```js
// webpack.config.js (or equivalent in your bundler)
{
  optimization: {
    splitChunks: {
      cacheGroups: {
        article: { test: /\/article\//, name: 'article', chunks: 'async' },
        donate:  { test: /\/donate/,   name: 'donate',  chunks: 'async' },
        search:  { test: /\/search/,   name: 'search',  chunks: 'async' },
        shell:   { minChunks: 2, name: 'shell' }
      }
    }
  }
}

// At route boundary
const ArticlePage = lazy(() => import('./routes/article'));
```

**Verify it worked**

```bash
# /newsletters initial bundle should be < 50KB
just build-capture | jq '.topScriptsByBytes | .[0:3]'

# Per-route Lighthouse runs
just audit https://apnews.com/newsletters newsletters
```

**Risks / edge cases**

- Bundler config is the riskiest change. Test every route, not just the homepage.
- Don't break shared chunks — common utilities should not be duplicated.
- Lazy-load fallback (loading spinner) must exist for every lazy route.
- Verify all 8 audited pages still load — not just /newsletters.

---

### PR 8 · AVIF image CDN

> `structural` — CDN + design team.

**Mechanism**

All images on the homepage are JPEG or WebP. AVIF saves 40–50% over JPEG at the same perceptual quality. CDN supports WebP via URL param but doesn't generate AVIF.

**The fix**

```html
<!-- before (WebP via CDN URL param) -->
<img src="https://dims.apnews.com/.../format/webp">

<!-- after: <picture> with AVIF + WebP + JPEG fallback -->
<picture>
  <source type="image/avif" srcset=".../format/avif">
  <source type="image/webp" srcset=".../format/webp">
  <img src=".../format/jpeg" alt="...">
</picture>
```

---

### PR 9 · Service worker for 3P caching

> `structural` — app shell conflict.

**Mechanism**

Third-party scripts re-fetch every pageview because their cache policies are not under AP News's control. Soft-refresh transfer savings ≈ 0%. Caching 3P static JS at the edge eliminates the waste.

**The fix**

```js
// service-worker.js (registered at root)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.hostname.endsWith('gstatic.com') ||
      url.hostname.endsWith('cookielaw.org') ||
      url.hostname.endsWith('viafoura.net')) {
    event.respondWith(caches.match(event.request)
      .then(cached => cached || fetch(event.request)));
  }
});
```

---

## Phase 3 · Weeks 4+ — Reset the contract

### PR 10 · Performance budget in CI

> `structural` — CI/CD pipeline.

**Mechanism**

Phase 1 + 2 fixes will erode in 6 months unless regressions are caught at PR time. Lab audits run manually today; CI gates are the difference between "we measured once" and "we keep measuring."

**The fix**

```yaml
# .github/workflows/perf-budget.yml
name: perf-budget
on: [pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Lighthouse budget check
        run: |
          npx lhci autorun \
            --collect.url=https://apnews.com/ \
            --assert.assertionCount=1 \
            --assert.assertions.categories:performance=85 \
            --assert.assertions.first-contentful-paint=3000
```

**Risks**

- Set thresholds from the post-phase-2 baseline, not the pre. Don't gate at "current score" — set the bar at "what we know is achievable."
- Allow ±5% variance — lab numbers fluctuate.
- Run CI audits against a stable staging URL, not prod (to avoid noise).
- Team-lead approval needed to override failed gates — don't let them be bypassed.

---

### PR 11 · 3P vendor SLA

> `structural` — vendor contracts.

**Mechanism**

Third-party vendors each consume part of the JS / network / main-thread budget. Without a per-vendor SLA, vendors grow without accountability. The audit identified webcontentassessor (1.87 s, 101 KB), Viafoura (1.4 MB / page), and Permutive (1.76 s) as the largest offenders.

**The fix**

```js
// 1. Inventory all 3P vendors and their cost
// 2. Set per-vendor budgets (script size, main-thread, transfer)
// 3. Add SLA clauses to vendor contracts
// 4. Quarterly vendor review: cut or renegotiate worst

// Example budget table:
// vendor        | script KB | main-thread | allowed
// Google Tag Mgr | < 250 KB | < 300ms   | ✓
// GAM           | < 250 KB | < 1.5 s    | ✗ over budget
// OneTrust      | < 150 KB | < 1.5 s    | ✓
// Viafoura      | < 200 KB | < 500ms   | ✗ over budget (cut)
```

**Risks**

- Some contracts have minimum spend clauses. Renegotiation has business-side cost.
- Cutting a vendor requires a replacement or business-acceptance of the loss.
- Vendors change their SDK without notice. Set up monitoring (RUM, PR 12).
- Get procurement / legal involved early.

---

### PR 12 · RUM instrumentation

> `structural` — backend.

**Mechanism**

All measurements in this audit are lab-only. Field data (CrUX, INP, real-user LCP) is the missing signal. Without it, decisions are based on lab evidence + 1 PR's intuition.

**The fix**

```js
// src/lib/rum.js
import { onLCP, onINP, onCLS } from 'web-vitals/attribution';

onLCP(sendToRUM);
onINP(sendToRUM);
onCLS(sendToRUM);

// src/lib/rum-endpoint.js
function sendToRUM(metric) {
  navigator.sendBeacon(
    '/api/rum',
    JSON.stringify({
      name: metric.name,
      value: metric.value,
      id: metric.id,
      attribution: metric.attribution  // element, time, etc.
    })
  );
}
```

**Risks**

- Need a backend endpoint. Even a Google Sheet via Apps Script works for MVP.
- Beacon on `visibilitychange`, not `unload` (latter is unreliable on mobile).
- PII concerns: don't ship user identifiers in attribution.
- Self-host the web-vitals library to control cache + version pinning.

---

## Cross-references

### While implementing

- `baseline.md` — raw measurements behind every PR claim
- `findings.md` — full evidence trail per finding
- `/tmp/build-capture.json` — bundle data
- `/tmp/coverage-frame-capture.json` — coverage + frame chart

### For context

- `prioritization.md` — RICE / ICE / WSJF scoring across 21 findings
- `presentation.md` — stakeholder framing (for the leadership convo)
- `lighthouse/01-homepage.json` — raw Lighthouse output

---

## Rule of thumb

**If you can't reproduce a number in this guide, the fix won't reproduce either. Run the recipe before you ship.**

---

*This is the same content as `implementation.html` (slide deck format), presented in markdown for review and sharing.*
