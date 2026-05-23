/*  baseline-shots.js
    ─────────────────────────────────────────────────────────────
    Take 375px + 1200px full-viewport screenshots of every
    marketing page. Block brand reveal, force reveal-animation
    visibility, no external requests. Writes to /tmp/vs/<page>-<w>.png. */

const { chromium } = require('playwright');
const fs = require('fs');

const PAGES = [
  'index', 'about', 'services', 'results', 'platform',
  'gallery', 'contact', 'book', 'onboard',
];
const WIDTHS = [375, 1200];
const HEIGHTS = { 375: 812, 1200: 900 };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const w of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: HEIGHTS[w] },
        deviceScaleFactor: w === 375 ? 3 : 2,
        isMobile: w === 375,
        hasTouch: w === 375,
      });
      for (const name of PAGES) {
        const page = await ctx.newPage();
        page.on('pageerror', e => console.warn(name, w, 'err:', e.message));
        await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
        await page.addInitScript(() => { try { localStorage.setItem('bm_revealed','1'); } catch(e){} });
        try {
          await page.goto('file:///home/user/Big-Mike/' + name + '.html', { waitUntil: 'load', timeout: 15000 });
        } catch (e) { console.warn(name, w, 'load err:', e.message); }
        await page.waitForTimeout(500);
        // Force-reveal all animated elements
        await page.evaluate(() => {
          document.getElementById('brandReveal')?.remove();
          document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale,.s-head,.reveal-lr').forEach(el => {
            el.style.opacity = '1'; el.style.transform = 'none'; el.style.filter = 'none';
          });
          document.querySelectorAll('.hero h1, .hero-sub, .hero-ctas').forEach(el => {
            el.style.cssText += 'opacity:1 !important;animation:none !important';
          });
          /* Force-load every lazy image so we see the real page, not an
             empty skeleton. */
          document.querySelectorAll('img[loading="lazy"]').forEach(img => {
            img.loading = 'eager';
            if (img.dataset.src) img.src = img.dataset.src;
          });
        });
        /* Scroll to the bottom so any intersection-observer grids mount, then back to top */
        await page.evaluate(async () => {
          const steps = Math.ceil(document.body.scrollHeight / window.innerHeight) + 1;
          for (let i = 0; i <= steps; i++) { window.scrollTo(0, i * window.innerHeight); await new Promise(r => setTimeout(r, 80)); }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(500);
        // Above-fold + full-page versions
        await page.screenshot({ path: `/tmp/vs/${name}-${w}-fold.png`, fullPage: false });
        await page.screenshot({ path: `/tmp/vs/${name}-${w}-full.png`, fullPage: true });
        console.log('shot', name, w);
        await page.close();
      }
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
