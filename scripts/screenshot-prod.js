const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'https://soulspacehealth.org';
const OUT  = path.join(__dirname, '..', 'prod-screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: '01-age-gate',           url: '/age-gate' },
  { name: '02-welcome-start',      url: '/start' },
  { name: '03-signin',             url: '/auth/signin' },
  { name: '04-crisis',             url: '/crisis' },
  { name: '05-pricing',            url: '/pricing' },
  { name: '06-home-landing',       url: '/' },
  { name: '07-session-entry',      url: '/session' },
  { name: '08-session-emotions',   url: '/session/emotions' },
  { name: '09-session-intensity',  url: '/session/intensity' },
  { name: '10-session-context',    url: '/session/context' },
  { name: '11-session-breathe',    url: '/session/breathe' },
  { name: '12-session-loading',    url: '/session/loading' },
];

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  for (const { name, url } of PAGES) {
    const page = await browser.newPage();
    // Desktop viewport
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 }); // iPhone 14 Pro

    try {
      await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 20000 });
      await new Promise(r => setTimeout(r, 800)); // let animations settle
      const dest = path.join(OUT, `${name}.png`);
      await page.screenshot({ path: dest, fullPage: true });
      console.log(`✓ ${name}`);
    } catch (e) {
      console.log(`✗ ${name} — ${e.message}`);
    }
    await page.close();
  }

  await browser.close();
  console.log('\nAll screenshots saved to prod-screenshots/');
}

run().catch(console.error);
