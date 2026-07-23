// build-capture.mjs
// Inspect AP News homepage build outputs: JS / CSS bundles, image formats,
// 3rd-party loading strategy, source-map exposure, and unused-JS / unused-CSS
// via puppeteer's coverage API (matches Lighthouse methodology).
//
// Run:  node scripts/build-capture.mjs
// Output: stdout summary + writes /tmp/build-capture.json with full data.

import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

const PROFILE = '/tmp/chromium-apnews-profile';
const HOME = 'https://apnews.com/';
const OUTPUT = '/tmp/build-capture.json';

// ---------- 1. Launch browser and start coverage ----------
const browser = await puppeteer.launch({
  executablePath: '/usr/lib/chromium/chromium',
  headless: 'new',
  userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 800 },
});

const page = await browser.newPage();

// Start coverage BEFORE navigation. resetOnNavigation:false lets us collect
// across the full page load in one shot. The coverage API returns ranges of
// code that actually executed; we compute unused = total - executed.
await Promise.all([
  page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: true }),
  page.coverage.startCSSCoverage({ resetOnNavigation: false }),
]);

const responses = [];
page.on('response', async (resp) => {
  try {
    const req = resp.request();
    const headers = resp.headers();
    responses.push({
      url: resp.url(),
      type: req.resourceType(),
      status: resp.status(),
      contentLength: parseInt(headers['content-length'] || '0', 10),
      contentEncoding: headers['content-encoding'] || '',
      cacheControl: headers['cache-control'] || '',
      contentType: headers['content-type'] || '',
      sourcemapHeader: headers['sourcemap'] || headers['x-sourcemap'] || '',
      linkHeader: headers['link'] || '',
      hasSourceMapSuffix: resp.url().endsWith('.map'),
    });
  } catch {}
});

await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: 90000 });
await sleep(8000);

// ---------- 2. DOM inspection ----------
const srcsetData = await page.evaluate(() =>
  Array.from(document.querySelectorAll('img')).slice(0, 30).map((i) => ({
    src: i.src.slice(0, 120),
    hasSrcset: !!i.srcset,
    hasSizes: !!i.sizes,
    loading: i.loading || 'eager',
    fetchpriority: i.getAttribute('fetchpriority') || '',
    width: i.width,
    height: i.height,
  }))
);

const scriptTags = await page.evaluate(() =>
  Array.from(document.scripts).map((s) => ({
    src: s.src || '(inline)',
    async: s.async,
    defer: s.defer,
    inlineLen: s.src ? 0 : s.textContent.length,
    pos: s.src ? 'external' : document.head.contains(s) ? 'head' : 'body',
  }))
);

const resourceHints = await page.evaluate(() => {
  const hints = [];
  document
    .querySelectorAll('link[rel="preload"], link[rel="preconnect"], link[rel="dns-prefetch"]')
    .forEach((l) => hints.push({ rel: l.rel, href: l.href, as: l.as }));
  return hints;
});

// ---------- 3. Source-map check (first-party main bundle) ----------
const mainJsUrl = scriptTags
  .filter((s) => s.src.startsWith('https://assets.apnews.com/'))
  .map((s) => s.src)
  .find(() => true);

let sourceMapCheck = { url: mainJsUrl, mapReachable: null, hasSourceMapUrlComment: null };
if (mainJsUrl) {
  const mapUrl = mainJsUrl + '.map';
  try {
    const head = execSync(`curl -s -o /dev/null -w "%{http_code}" -I "${mapUrl}"`, { encoding: 'utf8' });
    sourceMapCheck.mapReachable = head.trim();
  } catch {
    sourceMapCheck.mapReachable = 'error';
  }
  try {
    const tail = execSync(`curl -s "${mainJsUrl}" | tail -c 500`, { encoding: 'utf8' });
    sourceMapCheck.hasSourceMapUrlComment = /sourceMappingURL\s*=/.test(tail);
  } catch {
    sourceMapCheck.hasSourceMapUrlComment = 'error';
  }
}

// ---------- 4. Collect coverage (unused JS / CSS) ----------
const [jsCoverage, cssCoverage] = await Promise.all([
  page.coverage.stopJSCoverage(),
  page.coverage.stopCSSCoverage(),
]);

const unusedFromCoverage = (entries) =>
  entries
    .map((entry) => {
      // Entry has `text` (the full source) and `ranges` (executed ranges).
      // For very large inline scripts, drop the source from output to keep JSON small.
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

await browser.close();

// ---------- 5. Format and write ----------
const scripts = responses.filter((r) => r.type === 'Script');
const styles = responses.filter((r) => r.type === 'Stylesheet');
const images = responses.filter((r) => r.type === 'Image');

const fmt = (bytes) => (bytes / 1024).toFixed(1) + 'KB';
const totalBytes = (arr) => arr.reduce((a, r) => a + (r.contentLength || 0), 0);

const result = {
  capturedAt: new Date().toISOString(),
  homepage: HOME,
  summary: {
    totalRequests: responses.length,
    scripts: scripts.length,
    stylesheets: styles.length,
    images: images.length,
    scriptsTotalBytes: totalBytes(scripts),
    cssTotalBytes: totalBytes(styles),
    imagesTotalBytes: totalBytes(images),
    unusedJsTotalBytes: unusedJs.reduce((a, e) => a + e.unusedBytes, 0),
    unusedCssTotalBytes: unusedCss.reduce((a, e) => a + e.unusedBytes, 0),
  },
  imageFormatBreakdown: (() => {
    const m = {};
    images.forEach((i) => {
      const ct = (i.contentType || '').split(';')[0] || 'unknown';
      m[ct] = (m[ct] || 0) + 1;
    });
    return m;
  })(),
  srcsetCoverage: {
    imgTagsWithSrcset: srcsetData.filter((i) => i.hasSrcset).length,
    imgTagsWithoutSrcset: srcsetData.filter((i) => !i.hasSrcset && !i.src.includes('.svg')).length,
    sample: srcsetData.slice(0, 5),
  },
  scriptLoadingStrategy: (() => {
    const t = { async: 0, defer: 0, sync: 0, inline: 0 };
    scriptTags.forEach((s) => {
      if (s.src === '(inline)') t.inline++;
      else if (s.defer) t.defer++;
      else if (s.async) t.async++;
      else t.sync++;
    });
    return t;
  })(),
  syncScripts: scriptTags.filter((s) => s.src !== '(inline)' && !s.async && !s.defer).map((s) => s.src),
  resourceHints,
  sourceMapCheck,
  topScriptsByBytes: scripts
    .map((r) => ({ url: r.url, bytes: r.contentLength }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 20),
  topImagesByBytes: images
    .map((r) => ({ url: r.url, bytes: r.contentLength, type: r.contentType.split(';')[0] }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 15),
  unusedJs: {
    totalEntries: unusedJs.length,
    totalUnusedBytes: unusedJs.reduce((a, e) => a + e.unusedBytes, 0),
    totalTransferBytes: unusedJs.reduce((a, e) => a + e.totalBytes, 0),
    topOffenders: unusedJs.slice(0, 10).map((e) => ({
      url: e.url,
      totalBytes: e.totalBytes,
      usedBytes: e.usedBytes,
      unusedBytes: e.unusedBytes,
      // unusedPercent is computed from raw bytes (a ratio 0-100); already in
      // percent units, do not multiply by 100 again when displaying.
      unusedPercent: Math.round(e.unusedPercent * 10) / 10,
    })),
  },
  unusedCss: {
    totalEntries: unusedCss.length,
    totalUnusedBytes: unusedCss.reduce((a, e) => a + e.unusedBytes, 0),
    totalTransferBytes: unusedCss.reduce((a, e) => a + e.totalBytes, 0),
    topOffenders: unusedCss.slice(0, 10).map((e) => ({
      url: e.url,
      totalBytes: e.totalBytes,
      usedBytes: e.usedBytes,
      unusedBytes: e.unusedBytes,
      unusedPercent: Math.round(e.unusedPercent * 10) / 10,
    })),
  },
};

await fs.writeFile(OUTPUT, JSON.stringify(result, null, 2));

// ---------- 6. Print summary ----------
const fmtPct = (p) => Math.round(p * 10) / 10 + '%';

console.log('=== Build capture summary ===');
console.log('Total requests:', result.summary.totalRequests);
console.log('  Scripts:', result.summary.scripts, fmt(result.summary.scriptsTotalBytes));
console.log('  Stylesheets:', result.summary.stylesheets, fmt(result.summary.cssTotalBytes));
console.log('  Images:', result.summary.images, fmt(result.summary.imagesTotalBytes));
console.log();
console.log('=== Coverage (puppeteer v8 coverage API) ===');
console.log('  Unused JS:  ', fmt(result.summary.unusedJsTotalBytes), ' across', result.unusedJs.totalEntries, 'scripts');
console.log('  Unused CSS: ', fmt(result.summary.unusedCssTotalBytes), ' across', result.unusedCss.totalEntries, 'stylesheets');
console.log();
console.log('=== Image formats ===');
Object.entries(result.imageFormatBreakdown)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log('  ' + k.padEnd(20) + v));
console.log();
console.log('=== srcset coverage (sample 30 imgs) ===');
console.log('  with srcset:', result.srcsetCoverage.imgTagsWithSrcset);
console.log('  without (non-SVG):', result.srcsetCoverage.imgTagsWithoutSrcset);
console.log();
console.log('=== Script loading strategy ===');
console.log(result.scriptLoadingStrategy);
console.log();
console.log('=== Sync (blocking) external scripts ===');
result.syncScripts.forEach((s) => console.log('  ' + s));
console.log();
console.log('=== Source-map check ===');
console.log(JSON.stringify(sourceMapCheck, null, 2));
console.log();
console.log('=== Top 10 scripts by bytes (transfer) ===');
result.topScriptsByBytes.slice(0, 10).forEach((s) => console.log('  ' + fmt(s.bytes).padStart(8) + '  ' + s.url.slice(0, 110)));
console.log();
console.log('=== Top 10 unused JS (by unused bytes, coverage-based) ===');
result.unusedJs.topOffenders.forEach((e) => {
  const total = fmt(e.totalBytes).padStart(8);
  const waste = fmt(e.unusedBytes).padStart(8);
  const pct = fmtPct(e.unusedPercent).padStart(6);
  console.log('  total=' + total + '  unused=' + waste + '  ' + pct + '  ' + e.url.slice(0, 100));
});
console.log();
console.log('=== Top 10 unused CSS (by unused bytes, coverage-based) ===');
result.unusedCss.topOffenders.forEach((e) => {
  const total = fmt(e.totalBytes).padStart(8);
  const waste = fmt(e.unusedBytes).padStart(8);
  const pct = fmtPct(e.unusedPercent).padStart(6);
  console.log('  total=' + total + '  unused=' + waste + '  ' + pct + '  ' + (e.url.startsWith('#') ? '(inline selector): ' + e.url.slice(0, 80) : e.url.slice(0, 100)));
});
console.log();
console.log('=== Top 10 images by bytes (transfer) ===');
result.topImagesByBytes.slice(0, 10).forEach((s) => console.log('  ' + fmt(s.bytes).padStart(8) + '  ' + s.type.padEnd(15) + '  ' + s.url.slice(0, 110)));
console.log();
console.log('Full data: ' + OUTPUT);
