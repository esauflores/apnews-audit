// rendering-strategy.mjs
// Detect rendering strategy for each audited AP News page by inspecting:
//   - HTML size + content presence BEFORE any JS executes
//   - Response headers (cache-control, age, framework markers)
//   - Framework markers in HTML/JS (Next.js, Nuxt, Gatsby, etc.)
//
// Run:  node scripts/rendering-strategy.mjs
// Output: stdout summary + /tmp/rendering-strategy.json

import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs/promises';

const PROFILE = '/tmp/chromium-apnews-profile';
const TARGETS = [
  ['homepage',     'https://apnews.com/'],
  ['world-news',   'https://apnews.com/world-news'],
  ['article',      'https://apnews.com/article/openai-hugging-face-hacking-ai-model-708cb598bc1e33cef560e7196adb2afa'],
  ['photography',  'https://apnews.com/photography'],  // /photography/ 301-redirects here
  ['quizzes',      'https://apnews.com/hub/quizzes'],
  ['donate',       'https://apnews.com/donate'],
  ['search',       'https://apnews.com/search?q=world+cup'],
  ['newsletters',  'https://apnews.com/newsletters'],
];

const browser = await puppeteer.launch({
  executablePath: '/usr/lib/chromium/chromium',
  headless: 'new',
  userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 800 },
});

const FRAMEWORK_MARKERS = [
  { name: 'Next.js', html: [/_next\/static/, /__NEXT_DATA__/, /next-route-announcer/], js: [/next\.js/i] },
  { name: 'Nuxt', html: [/nuxt/i, /__NUXT__/], js: [/nuxt/i] },
  { name: 'Gatsby', html: [/gatsby/i, /___gatsby/], js: [/gatsby/i] },
  { name: 'Astro', html: [/astro/i, /data-astro-/], js: [/astro/i] },
  { name: 'Remix', html: [/remix/i, /__remix/], js: [/remix/i] },
  { name: 'SvelteKit', html: [/svelte/i, /__sveltekit/], js: [/svelte/i] },
  { name: 'VuePress', html: [/vuepress/i], js: [/vue/i] },
];

const analyzeHtml = (html) => {
  // Heuristic: SSR returns meaningful content in the initial HTML; CSR returns
  // a thin shell. We check the body for visible-text markers common to news pages.
  const textIndicators = [
    /\bbreaking\b/i, /\bnation\b/i, /\bworld\b/i, /\bpolitics\b/i, /\bbusiness\b/i,
    /\b(ap|associated press)\b/i, /\barticle\b/i, /\bstories\b/i, /\bnewsletter\b/i,
    /\bsign up\b/i, /\bdonate\b/i, /\bsubscribe\b/i,
  ];
  const matches = textIndicators.filter((re) => re.test(html)).length;
  // Check for framework data attribute or hydration markers
  const detectedFrameworks = FRAMEWORK_MARKERS.filter((f) => f.html.some((re) => re.test(html))).map((f) => f.name);
  return {
    htmlLength: html.length,
    textIndicatorMatches: matches,
    detectedFrameworks,
    // If the body has substantial content before any client JS runs, it's SSR/SSG
    looksLikeSSR: html.length > 50_000 && matches >= 3,
    looksLikeShell: html.length < 15_000,
  };
};

const fetchViaPuppeteer = async (page, url) => {
  // Intercept the response to capture headers + initial HTML (before JS runs)
  let headers = null;
  let initialHtml = null;
  page.removeAllListeners('response');
  page.on('response', async (resp) => {
    if (resp.url() === url && resp.request().resourceType() === 'document') {
      try {
        headers = resp.headers();
        initialHtml = await resp.text();
      } catch {}
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);

  return { headers, initialHtml };
};

const results = [];
for (const [name, url] of TARGETS) {
  const page = await browser.newPage();
  try {
    const { headers, initialHtml } = await fetchViaPuppeteer(page, url);
    let analysis = null;
    if (initialHtml) {
      analysis = analyzeHtml(initialHtml);
    } else if (headers && headers['content-type'] && headers['content-type'].includes('html')) {
      // Some pages serve HTML but our interceptor missed it; try fetching directly
      try {
        const directResp = await fetch(url, {
          headers: { 'Accept-Encoding': 'br, gzip' },
        });
        const buf = await directResp.arrayBuffer();
        const text = new TextDecoder('utf-8').decode(buf);
        analysis = analyzeHtml(text);
        // Augment headers from the direct fetch
        Object.assign(headers, {
          directFetchSize: buf.byteLength,
          directFetchUsed: true,
        });
      } catch (e) {
        analysis = null;
      }
    }
    results.push({
      name,
      url,
      headers: headers ? {
        status: headers.status,
        contentType: headers['content-type'] || '',
        cacheControl: headers['cache-control'] || '',
        age: headers['age'] || '0',
        server: headers['server'] || '',
        via: headers['via'] || '',
        xPoweredBy: headers['x-powered-by'] || '',
        xServedBy: headers['x-served-by'] || '',
        xCache: headers['x-cache'] || '',
        vary: headers['vary'] || '',
        contentEncoding: headers['content-encoding'] || '',
        // Framework markers in response headers
        xNextjs: headers['x-nextjs'] || headers['x-nextjs-cache'] || '',
        directFetchUsed: headers.directFetchUsed || false,
        directFetchSize: headers.directFetchSize || 0,
      } : null,
      analysis,
      initialHtmlPreview: initialHtml ? initialHtml.slice(0, 800) : null,
    });
  } catch (e) {
    results.push({ name, url, error: e.message });
  } finally {
    await page.close();
  }
}

await browser.close();

// ---------- Print summary ----------
await fs.writeFile('/tmp/rendering-strategy.json', JSON.stringify(results, null, 2));

console.log('=== Rendering strategy detection (8 audited pages) ===\n');
for (const r of results) {
  if (r.error) {
    console.log(`✗ ${r.name.padEnd(13)}  ERROR: ${r.error}`);
    continue;
  }
  const a = r.analysis;
  const h = r.headers;
  const classification = a.looksLikeShell ? 'CSR (client shell)'
    : a.looksLikeSSR ? 'SSR/SSG (server-rendered)'
    : 'partial SSR';
  console.log(`${r.name.padEnd(13)} ${classification}`);
  console.log(`                HTML size before JS: ${a.htmlLength.toLocaleString()} bytes`);
  console.log(`                text-indicator matches: ${a.textIndicatorMatches}`);
  console.log(`                framework markers:    ${a.detectedFrameworks.length ? a.detectedFrameworks.join(', ') : 'none detected'}`);
  console.log(`                cache-control:        ${h.cacheControl || '(none)'}`);
  console.log(`                age header:           ${h.age || '(none — fresh)'}`);
  console.log(`                content-encoding:     ${h.contentEncoding || '(none)'}`);
  console.log(`                server:               ${h.server || '(hidden)'}`);
  console.log(`                x-powered-by:         ${h.xPoweredBy || '(none)'}`);
  console.log(`                x-served-by:          ${h.xServedBy || '(none)'}`);
  console.log(`                x-cache:              ${h.xCache || '(none)'}`);
  console.log(`                vary:                 ${h.vary || '(none)'}`);
  if (h.xNextjs) console.log(`                x-nextjs:             ${h.xNextjs}`);
  console.log('');
}
console.log('Full data: /tmp/rendering-strategy.json');
