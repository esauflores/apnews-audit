// coverage-frame-capture.mjs
// Capture the three metrics sets from the HW8 spec:
//   1. Coverage  — critical CSS presence, unused JS/CSS, source attribution
//   2. Performance frame chart — dropped frames during load / scroll / interaction
//   3. Layers & animations — paint-layer count, will-change / transform3d use
//
// Run:  node scripts/coverage-frame-capture.mjs
// Output: stdout summary + writes /tmp/coverage-frame-capture.json

import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs/promises';

const PROFILE = '/tmp/chromium-apnews-profile';
const HOME = 'https://apnews.com/';
const OUTPUT = '/tmp/coverage-frame-capture.json';

// ---------- 1. Launch + start coverage + start tracing ----------
const browser = await puppeteer.launch({
  executablePath: '/usr/lib/chromium/chromium',
  headless: 'new',
  userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 800 },
});

const page = await browser.newPage();
const client = await page.createCDPSession();

// Start JS + CSS coverage
await Promise.all([
  page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: true }),
  page.coverage.startCSSCoverage({ resetOnNavigation: false }),
]);

// Start tracing for frame timing during load
await client.send('Tracing.start', {
  traceConfig: { includedCategories: ['disabled-by-default-devtools.timeline', 'devtools.timeline'] },
  bufferUsageReportingIntervalMs: 1000,
});

// ---------- 2. Navigate + measure load frames ----------
await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: 90000 });
await sleep(8000); // let scripts run

// Capture the frame timing from the page (uses requestAnimationFrame delta times)
async function captureFrames(label, durationMs) {
  const result = await page.evaluate(async (label, durationMs) => {
    const frames = [];
    let last = performance.now();
    let next = last + durationMs;
    while (last < next) {
      await new Promise((r) => requestAnimationFrame((t) => {
        const dt = t - last;
        frames.push({ t, dt, dropped: dt > 16.67 * 1.5 }); // >25ms = dropped frame
        last = t;
        r();
      }));
    }
    return { label, totalFrames: frames.length, droppedFrames: frames.filter((f) => f.dropped).length, avgDt: frames.reduce((a, f) => a + f.dt, 0) / frames.length, maxDt: Math.max(...frames.map((f) => f.dt)), frames: frames.slice(0, 200) };
  }, label, durationMs);
  return result;
}

const loadFrames = await captureFrames('load', 5000);

// ---------- 3. Scroll-trigger frames ----------
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await sleep(1000);
const scrollFrames = await captureFrames('scroll', 3000);

// Reset scroll
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(500);

// ---------- 4. Click-trigger frames ----------
// Find a clickable element near the top of the page
const clickResult = await page.evaluate(async () => {
  const target = document.querySelector('a[href], button');
  if (!target) return { error: 'no clickable target' };
  const rect = target.getBoundingClientRect();
  return { found: true, tag: target.tagName, top: rect.top, left: rect.left };
});

let clickFrames = null;
if (clickResult.found) {
  await page.mouse.click(clickResult.left + 10, clickResult.top + 10);
  await sleep(500);
  clickFrames = await captureFrames('click', 2000);
}

// ---------- 5. Layer + animation introspection ----------
const layerInfo = await client.send('LayerTree.enable');
// Get all layers via the rendering agent
const layerTree = await client.send('LayerTree.compositingReasons', {
  layerId: layerInfo.rootLayerId || '',
}).catch(() => null);

// Pull will-change and transform3d usage from all stylesheets via DOM walk
const willChangeInfo = await page.evaluate(() => {
  const matches = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) {
        if (!rule.style) continue;
        const wc = rule.style.getPropertyValue('will-change');
        const t = rule.style.transform || '';
        if (wc && wc !== 'auto') matches.push({ selector: rule.selectorText || '(media)', willChange: wc, type: 'will-change' });
        if (/transform3d|translate3d|matrix3d/.test(t)) matches.push({ selector: rule.selectorText || '(media)', transform: t, type: 'translate3d' });
      }
    } catch (e) { /* cross-origin sheet, skip */ }
  }
  return matches;
});

// Inspect inline <style> blocks for critical-CSS markers
const inlineStyles = await page.evaluate(() => {
  const styles = Array.from(document.querySelectorAll('style'));
  return styles.map((s) => ({
    len: s.textContent.length,
    hasAboveFoldRules: /(\.Page-header|\.TopNav|\.Lead|\.Hero|body\s*\{|html\s*\{)/i.test(s.textContent),
    preview: s.textContent.slice(0, 200),
  }));
});

// Count composited layers via runtime evaluation
const compositedCount = await page.evaluate(() => {
  // Layer count is opaque from JS; approximate via DOM + animated elements
  const animated = document.getAnimations ? document.getAnimations().length : 0;
  const iframes = document.querySelectorAll('iframe').length;
  const canvas = document.querySelectorAll('canvas').length;
  const videos = document.querySelectorAll('video').length;
  return { animationsActive: animated, iframes, canvas, videos };
});

// ---------- 6. Coverage stop + collect ----------
await client.send('Tracing.end');
const [jsCoverage, cssCoverage] = await Promise.all([
  page.coverage.stopJSCoverage(),
  page.coverage.stopCSSCoverage(),
]);

await browser.close();

// ---------- 7. Summarize coverage ----------
const unusedFromCoverage = (entries) =>
  entries
    .map((entry) => {
      const total = entry.text.length;
      const executed = entry.ranges.reduce((a, r) => a + (r.end - r.start), 0);
      const unused = total - executed;
      return {
        url: entry.url,
        totalBytes: total,
        usedBytes: executed,
        unusedBytes: unused,
        unusedPercent: total > 0 ? (unused / total) * 100 : 0,
      };
    })
    .filter((e) => e.totalBytes > 0)
    .sort((a, b) => b.unusedBytes - a.unusedBytes);

const unusedJs = unusedFromCoverage(jsCoverage);
const unusedCss = unusedFromCoverage(cssCoverage);

// ---------- 8. Write + print ----------
const result = {
  capturedAt: new Date().toISOString(),
  homepage: HOME,
  criticalCss: {
    inlineStyles: inlineStyles,
    totalInlineBytes: inlineStyles.reduce((a, s) => a + s.len, 0),
    renderBlockingStylesheets: 'see Lighthouse render-blocking audit (baseline.md)',
    observation: inlineStyles.length === 0 || inlineStyles.every((s) => !s.hasAboveFoldRules)
      ? 'No above-the-fold critical CSS detected in inline <style> blocks'
      : 'Some inline styles present; verify above-the-fold selectors',
  },
  unusedJs: {
    totalEntries: unusedJs.length,
    totalBytes: unusedJs.reduce((a, e) => a + e.totalBytes, 0),
    totalUnusedBytes: unusedJs.reduce((a, e) => a + e.unusedBytes, 0),
    topOffenders: unusedJs.slice(0, 10).map((e) => ({
      url: e.url,
      unusedBytes: e.unusedBytes,
      unusedPercent: Math.round(e.unusedPercent * 10) / 10,
      source: classifySource(e.url),
    })),
  },
  unusedCss: {
    totalEntries: unusedCss.length,
    totalBytes: unusedCss.reduce((a, e) => a + e.totalBytes, 0),
    totalUnusedBytes: unusedCss.reduce((a, e) => a + e.unusedBytes, 0),
    topOffenders: unusedCss.slice(0, 10).map((e) => ({
      url: e.url,
      unusedBytes: e.unusedBytes,
      unusedPercent: Math.round(e.unusedPercent * 10) / 10,
      source: classifySource(e.url),
    })),
  },
  frameChart: {
    load: { totalFrames: loadFrames.totalFrames, droppedFrames: loadFrames.droppedFrames, avgDtMs: Math.round(loadFrames.avgDt * 100) / 100, maxDtMs: Math.round(loadFrames.maxDt * 100) / 100 },
    scroll: scrollFrames ? { totalFrames: scrollFrames.totalFrames, droppedFrames: scrollFrames.droppedFrames, avgDtMs: Math.round(scrollFrames.avgDt * 100) / 100, maxDtMs: Math.round(scrollFrames.maxDt * 100) / 100 } : null,
    click: clickFrames ? { totalFrames: clickFrames.totalFrames, droppedFrames: clickFrames.droppedFrames, avgDtMs: Math.round(clickFrames.avgDt * 100) / 100, maxDtMs: Math.round(clickFrames.maxDt * 100) / 100 } : null,
    clickTarget: clickResult,
    droppedThresholdMs: 25, // >25ms frame interval = dropped
  },
  layersAndAnimations: {
    willChangeMatches: willChangeInfo.filter((m) => m.type === 'will-change'),
    translate3dMatches: willChangeInfo.filter((m) => m.type === 'translate3d'),
    compositedIndicators: compositedCount,
    rootLayerId: layerInfo.rootLayerId,
    rootLayerTree: layerTree,
  },
};

function classifySource(url) {
  if (!url) return 'inline';
  if (url.includes('apnews.com')) return 'first-party';
  if (url.includes('googleapis.com') || url.includes('gstatic.com') || url.includes('googletagmanager')) return 'google';
  if (url.includes('googlesyndication') || url.includes('doubleclick') || url.includes('pubmatic') || url.includes('rubicon') || url.includes('adnxs')) return 'ad-bidder';
  if (url.includes('cookielaw.org') || url.includes('onetrust')) return 'consent';
  if (url.includes('viafoura') || url.includes('webcontentassessor') || url.includes('parsely') || url.includes('chartbeat')) return 'analytics';
  if (url.includes('permutive')) return 'audience-platform';
  if (url.includes('dianomi') || url.includes('kameleoon') || url.includes('html-load') || url.includes('pub.network')) return 'ad-network';
  if (url.includes('cloudflare') || url.includes('fonts.googleapis') || url.includes('cdn.cookielaw') || url.includes('riverdrop')) return 'cdn';
  return 'third-party';
}

await fs.writeFile(OUTPUT, JSON.stringify(result, null, 2));

// ---------- 9. Print summary ----------
console.log('=== Critical CSS ===');
console.log('Inline <style> blocks:', inlineStyles.length);
console.log('Total inline CSS bytes:', result.criticalCss.totalInlineBytes);
console.log('Above-the-fold inline rules:', inlineStyles.filter((s) => s.hasAboveFoldRules).length);
console.log();
console.log('=== Unused JS (coverage) ===');
console.log('Total entries:', result.unusedJs.totalEntries);
console.log('Total bytes:', fmtKb(result.unusedJs.totalBytes));
console.log('Unused bytes:', fmtKb(result.unusedJs.totalUnusedBytes));
console.log('Unused %:', Math.round((result.unusedJs.totalUnusedBytes / result.unusedJs.totalBytes) * 1000) / 10 + '%');
console.log('Top 10 by unused bytes:');
result.unusedJs.topOffenders.forEach((e) => console.log('  ' + fmtKb(e.unusedBytes).padStart(8) + ' (' + e.unusedPercent + '%)  ' + e.source.padEnd(15) + '  ' + e.url.slice(0, 90)));
console.log();
console.log('=== Unused CSS (coverage) ===');
console.log('Total entries:', result.unusedCss.totalEntries);
console.log('Total bytes:', fmtKb(result.unusedCss.totalBytes));
console.log('Unused bytes:', fmtKb(result.unusedCss.totalUnusedBytes));
console.log('Unused %:', Math.round((result.unusedCss.totalUnusedBytes / result.unusedCss.totalBytes) * 1000) / 10 + '%');
console.log('Top 10 by unused bytes:');
result.unusedCss.topOffenders.forEach((e) => console.log('  ' + fmtKb(e.unusedBytes).padStart(8) + ' (' + e.unusedPercent + '%)  ' + e.source.padEnd(15) + '  ' + (e.url.startsWith('#') ? '(inline selector)' : e.url.slice(0, 90))));
console.log();
console.log('=== Frame chart (dropped = >25ms frame interval) ===');
console.log('Load  :', JSON.stringify(result.frameChart.load));
console.log('Scroll:', JSON.stringify(result.frameChart.scroll));
console.log('Click :', JSON.stringify(result.frameChart.click));
console.log('Click target:', clickResult);
console.log();
console.log('=== Layers & animations ===');
console.log('will-change selectors:', result.layersAndAnimations.willChangeMatches.length);
console.log('translate3d / transform3d selectors:', result.layersAndAnimations.translate3dMatches.length);
console.log('Composited indicators:', result.layersAndAnimations.compositedIndicators);
console.log('Root layer id:', result.layersAndAnimations.rootLayerId);
console.log();
console.log('Top will-change / translate3d matches:');
result.layersAndAnimations.willChangeMatches.slice(0, 5).forEach((m) => console.log('  will-change: ' + m.willChange + '  on ' + m.selector));
result.layersAndAnimations.translate3dMatches.slice(0, 5).forEach((m) => console.log('  ' + m.transform + '  on ' + m.selector));
console.log();
console.log('Full data: ' + OUTPUT);

function fmtKb(bytes) { return (bytes / 1024).toFixed(1) + 'KB'; }