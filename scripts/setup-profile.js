// setup-profile.js
// Pre-accept OneTrust consent on a persistent Chromium profile so that
// Lighthouse and screenshot runs don't hang on the cookie banner.
//
// Usage:  node scripts/setup-profile.js
// Produces: /tmp/chromium-apnews-profile/  (cookie jar + visited history)

import puppeteer from 'puppeteer-core';

const PROFILE = '/tmp/chromium-apnews-profile';

const browser = await puppeteer.launch({
  executablePath: '/usr/lib/chromium/chromium',
  headless: 'new',
  userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 800 },
});

const page = await browser.newPage();
await page.goto('https://apnews.com/', { waitUntil: 'networkidle2', timeout: 60000 });

try {
  await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 8000 });
  await page.click('#onetrust-accept-btn-handler');
  console.log('✓ OneTrust consent accepted');
} catch (e) {
  console.log('! accept button not found:', e.message);
}

await browser.close();
console.log(`✓ Profile ready at ${PROFILE}`);
