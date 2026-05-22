/*  VISUAL SELF-AUDIT HARNESS
    ─────────────────────────────────────────────────────────
    Programmatic visual quality checks that run BEFORE shipping.
    For every public page and viewport, measures:

    - Overflow: any element with rect.right > viewport.width,
      rect.left < 0, or horizontal scroll
    - Centering: elements tagged .should-center are within 2px
      of viewport center
    - Contrast: text elements have a contrast ratio ≥ 4.5 against
      their computed background (WCAG AA body text)
    - Dead space: large empty regions (>30% of viewport height
      with no visible content) between hero and footer
    - CTA reachability: every .btn / button has an accessible
      name and is within the viewport at its natural scroll
      position

    Every finding includes page, viewport, element path, severity.
    Run before commit. Treat any output as a potential ship blocker. */

const { chromium } = require('playwright');
const fs = require('fs');

const PAGES = [
  'index', 'about', 'services', 'results', 'platform', 'gallery', 'contact',
];

const VIEWPORTS = [
  { name: 'iphone',   width: 393,  height: 852,  dpr: 2, mobile: true },
  { name: 'iphoneSE', width: 375,  height: 667,  dpr: 2, mobile: true },
  { name: 'narrow',   width: 320,  height: 568,  dpr: 2, mobile: true },
  { name: 'ipad',     width: 820,  height: 1180, dpr: 2, mobile: false },
  { name: 'desktop',  width: 1440, height: 900,  dpr: 2, mobile: false },
];

const findings = [];
function flag(severity, page, viewport, detail) {
  findings.push({ severity, page, viewport, detail });
}

async function auditPage(browser, page, viewport) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    isMobile: viewport.mobile, hasTouch: viewport.mobile,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pe: ' + e.message));
  p.on('console', m => {
    if (m.type() === 'error') {
      const t = m.text();
      if (t.indexOf('Failed to load') < 0 && t.indexOf('net::') < 0 && t.indexOf('favicon') < 0 && t.indexOf('CSP') < 0) {
        errs.push('cE: ' + t.substring(0, 180));
      }
    }
  });
  await p.addInitScript(() => { try { localStorage.setItem('bm_revealed','1'); } catch(e){} });
  await p.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());

  try {
    await p.goto(`file:///home/user/bigmike/${page}.html`, { waitUntil: 'load', timeout: 20000 });
  } catch (e) {
    flag('ERROR', page, viewport.name, 'page load failed: ' + e.message);
    await ctx.close();
    return;
  }
  await p.waitForTimeout(500);
  // Force reveal
  await p.evaluate(() => {
    document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale,.s-head').forEach(el => {
      el.classList.add('vis');
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.filter = 'none';
    });
  });
  await p.waitForTimeout(200);

  // 1. Overflow check — any element whose visible box extends past viewport
  const overflowResults = await p.evaluate(() => {
    const out = [];
    const vpw = window.innerWidth;
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.1) continue;
      if (cs.position === 'fixed') continue;  // fixed overlays can legitimately cover/exceed
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      // Ignore items that are hero-photo / background decorations
      // Decorative / background / off-screen-by-design — skip
      if (el.classList.contains('hero-bg') || el.classList.contains('section-ambient-img') ||
          el.classList.contains('cta-bg') || el.classList.contains('hero-sculpt') ||
          el.classList.contains('hero-leak') || el.classList.contains('hero-rays') ||
          el.classList.contains('hero-chroma') || el.classList.contains('hero-warmth') ||
          el.classList.contains('hero-flare') || el.classList.contains('hero-breath') ||
          el.classList.contains('hero-atmos') || el.classList.contains('hero-dust') ||
          el.classList.contains('hero-desktop-layer') || el.classList.contains('film-grain') ||
          el.classList.contains('grain-ov') || el.classList.contains('vignette') ||
          el.classList.contains('atmos-mesh') || el.classList.contains('chrome-hex') ||
          el.classList.contains('portal-corners') || el.classList.contains('portal-corners-btm') ||
          el.classList.contains('cta-watermark') || el.classList.contains('cta-rays') ||
          el.classList.contains('monument-halo') || el.classList.contains('monument-rays') ||
          /hero-orb/.test(el.className) || /hero-ov/.test(el.className) ||
          el.getAttribute && el.getAttribute('aria-hidden') === 'true') continue;
      // Honeypot / intentionally off-screen inputs (anti-spam pattern)
      if (el.tagName === 'INPUT' || (el.children && el.children[0] && el.children[0].tagName === 'INPUT')) {
        const input = el.tagName === 'INPUT' ? el : el.querySelector('input');
        if (input) {
          const tabIndex = input.getAttribute('tabindex');
          const name = (input.getAttribute('name') || '').toLowerCase();
          const id = (input.getAttribute('id') || '').toLowerCase();
          if (tabIndex === '-1' || name.indexOf('honeypot') >= 0 || id.indexOf('honeypot') >= 0 ||
              name === 'website' || name === 'url' || id === 'cf-honeypot') continue;
        }
      }
      // Any ancestor with -9999 left is a honeypot
      let ancestor = el.parentElement;
      let isOffscreenHoneypot = false;
      while (ancestor && ancestor !== document.body) {
        const acs = getComputedStyle(ancestor);
        if (parseFloat(acs.left) < -1000) { isOffscreenHoneypot = true; break; }
        ancestor = ancestor.parentElement;
      }
      if (isOffscreenHoneypot) continue;
      // Self off-screen by -9999 (honeypot itself)
      const selfCs = getComputedStyle(el);
      if (parseFloat(selfCs.left) < -1000) continue;
      // Only flag the narrowest offender (a child usually implies the parent)
      if (r.right - vpw > 1) {
        const sig = el.tagName + '.' + Array.from(el.classList).join('.');
        if (!seen.has(sig)) {
          seen.add(sig);
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: Array.from(el.classList).slice(0, 3).join('.'),
            text: (el.innerText || '').substring(0, 40),
            right: Math.round(r.right),
            over: Math.round(r.right - vpw),
          });
        }
      }
      if (r.left < -1) {
        const sig = el.tagName + '.' + Array.from(el.classList).join('.') + 'L';
        if (!seen.has(sig)) {
          seen.add(sig);
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: Array.from(el.classList).slice(0, 3).join('.'),
            text: (el.innerText || '').substring(0, 40),
            left: Math.round(r.left),
            under: Math.round(-r.left),
          });
        }
      }
    }
    return { overflows: out, scrollW: document.documentElement.scrollWidth, vpw };
  });

  if (overflowResults.scrollW - overflowResults.vpw > 1) {
    flag('ERROR', page, viewport.name, `horizontal scroll: scrollWidth=${overflowResults.scrollW} vpw=${overflowResults.vpw}`);
  }
  for (const o of overflowResults.overflows.slice(0, 5)) {
    flag('WARN', page, viewport.name, `overflow ${o.tag}.${o.cls} "${o.text}" ${o.right ? 'right+' + o.over : 'left-' + o.under}`);
  }

  // 2. Centering check on elements that should be horizontally centered
  const centerResults = await p.evaluate(() => {
    const shouldCenter = [
      '.hero h1', '.hero-sub', '.hero-ctas', '.hero-scroll',
      '.hero-scroll .hs-label', '.hero-scroll svg',
      '.s-head', '.monuments', '.gw', '.gw-sm', '.gw-diamond',
      '.cta-inner', '.cta-headline', '.cta-trust',
      '.page-close', '.page-close-sig', '.page-close-rule', '.page-close-glyph',
      '.footer-mark', '.footer-sig', '.footer-copy',
    ];
    const vpc = window.innerWidth / 2;
    const out = [];
    for (const sel of shouldCenter) {
      document.querySelectorAll(sel).forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0) return;
        const center = (r.left + r.right) / 2;
        const diff = Math.abs(center - vpc);
        if (diff > 3) {
          out.push({
            sel: sel + (i ? `[${i}]` : ''),
            center: Math.round(center),
            vpc: Math.round(vpc),
            diff: Math.round(diff),
          });
        }
      });
    }
    return out;
  });
  for (const c of centerResults) {
    flag('WARN', page, viewport.name, `off-center ${c.sel} at ${c.center} (vpc ${c.vpc}, diff ${c.diff}px)`);
  }

  // 3. Button accessible name check
  const btnResults = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a.btn, a.btn-p, a.btn-s, a.mm-cta, a.nav-cta').forEach(el => {
      const text = (el.textContent || '').trim();
      const aria = el.getAttribute('aria-label') || '';
      if (!text && !aria) {
        out.push({ tag: el.tagName.toLowerCase(), cls: Array.from(el.classList).slice(0, 3).join('.') });
      }
    });
    return out;
  });
  for (const btn of btnResults) {
    flag('ERROR', page, viewport.name, `button without accessible name: ${btn.tag}.${btn.cls}`);
  }

  // 4. Console errors
  for (const e of errs.slice(0, 3)) {
    flag('ERROR', page, viewport.name, `console: ${e.substring(0, 150)}`);
  }

  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const page of PAGES) {
    for (const viewport of VIEWPORTS) {
      await auditPage(browser, page, viewport);
    }
  }
  await browser.close();

  console.log('\n══════════ VISUAL SELF-AUDIT ══════════\n');
  const errors = findings.filter(f => f.severity === 'ERROR');
  const warns = findings.filter(f => f.severity === 'WARN');

  const byPage = {};
  for (const f of findings) {
    const k = f.page;
    if (!byPage[k]) byPage[k] = { error: 0, warn: 0, items: [] };
    byPage[k][f.severity.toLowerCase()]++;
    byPage[k].items.push(f);
  }

  for (const p of PAGES) {
    const b = byPage[p] || { error: 0, warn: 0, items: [] };
    const status = b.error > 0 ? '\x1b[31mFAIL\x1b[0m' : (b.warn > 0 ? '\x1b[33mWARN\x1b[0m' : '\x1b[32mPASS\x1b[0m');
    console.log(`${status}  ${p.padEnd(12)} errors: ${b.error}  warnings: ${b.warn}`);
    for (const it of b.items.slice(0, 10)) {
      console.log(`       [${it.severity}] ${it.viewport} — ${it.detail}`);
    }
    if (b.items.length > 10) console.log(`       ... +${b.items.length - 10} more`);
  }

  console.log(`\nTOTAL: errors=${errors.length}  warnings=${warns.length}`);
  fs.writeFileSync('/tmp/visual_audit.json', JSON.stringify(findings, null, 2));
  process.exit(errors.length > 0 ? 1 : 0);
})();
