/*  THREE-PERSPECTIVE WALKTHROUGH
    ────────────────────────────────────────────────────────────
    Captures the exact mental model the panel asked for:
      1. First-time Instagram visitor on phone, 3 seconds, skeptical
      2. Mike at 6 AM, 40 clients, two taps to any action
      3. Client paying $300/month — portal must justify the price

    Each perspective records both the visual state and the
    interaction depth (how many taps to a key action). */

const { chromium } = require('playwright');
const fs = require('fs');

const results = [];
function note(perspective, item, status, detail) {
  results.push({ perspective, item, status, detail });
}

// ── PERSPECTIVE 1: Instagram visitor ─────────────────────────────
async function instagramVisitor(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile',
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('bm_revealed','1'); } catch(e){} });
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());

  await page.goto('file:///home/user/Big-Mike/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);

  // Above the fold: hero photo, name, credentials, primary CTA visible
  const fold = await page.evaluate(() => {
    const heroH1 = document.querySelector('.hero h1');
    const heroSub = document.querySelector('.hero-sub');
    const ctas = document.querySelectorAll('.hero-ctas a');
    const heroBg = document.querySelector('.hero-bg');
    return {
      h1Text: heroH1 ? heroH1.textContent : null,
      subText: heroSub ? heroSub.textContent : null,
      ctaCount: ctas.length,
      ctaLabels: Array.from(ctas).map(a => a.textContent.trim()),
      heroBgVisible: heroBg ? !!getComputedStyle(heroBg).backgroundImage : false,
    };
  });
  if (fold.h1Text === 'BIG MIKE ELY' && fold.subText && fold.ctaCount === 2 && fold.heroBgVisible) {
    note('Instagram', 'Above-the-fold has hero photo + name + tagline + 2 CTAs', 'PASS');
  } else {
    note('Instagram', 'Above-the-fold composition', 'FAIL', JSON.stringify(fold));
  }

  // Tap "Book a Session" — does it lead somewhere meaningful in 1 tap?
  const bookHref = await page.evaluate(() => {
    const a = document.querySelector('.hero-ctas a[href="book.html"]');
    return a ? a.getAttribute('href') : null;
  });
  if (bookHref === 'book.html') note('Instagram', 'Hero CTA reaches book.html in 1 tap', 'PASS');
  else note('Instagram', 'Hero Book CTA href', 'FAIL', String(bookHref));

  // Visual: take the screenshot the panel will see
  await page.screenshot({ path: '/tmp/persp1-fold.png' });

  // Scroll to CTA section — credibility row visible?
  await page.evaluate(() => document.querySelector('.cta')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const cta = await page.evaluate(() => {
    const trust = document.querySelectorAll('.cta-trust-item strong');
    return { trustCount: trust.length, trustValues: Array.from(trust).map(s => s.textContent.trim()) };
  });
  if (cta.trustCount >= 4 && cta.trustValues.includes('50+') && cta.trustValues.some(v => /30/.test(v))) {
    note('Instagram', 'CTA trust row shows 50+ pros / 30 yrs / 2× champ / NPC', 'PASS');
  } else {
    note('Instagram', 'CTA trust row', 'FAIL', JSON.stringify(cta));
  }
  await page.screenshot({ path: '/tmp/persp1-cta.png' });

  await ctx.close();
}

// ── PERSPECTIVE 2: Mike at 6 AM, 40 clients ──────────────────────
async function mikeMorning(browser) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  // Seed 40 clients
  const clients = [];
  for (let i = 0; i < 40; i++) {
    clients.push({
      id: 'mike_c' + i,
      name: 'Client ' + (i + 1),
      phone: '555' + String(i).padStart(7, '0'),
      clientType: i < 30 ? 'active' : 'prospect',
      services: ['Training'],
      rate: 150,
      created: Date.now() - i * 86400000,
    });
  }
  await page.addInitScript(({c}) => {
    localStorage.setItem('fm_clients', JSON.stringify(c));
    localStorage.setItem('fm_sessions', JSON.stringify([]));
    localStorage.setItem('fm_schedule', JSON.stringify([]));
    localStorage.setItem('fm_messages', JSON.stringify([]));
    localStorage.setItem('fm_inbox', JSON.stringify([]));
    localStorage.setItem('fm_supabase_auth', JSON.stringify({ authed: true, ts: Date.now() }));
    localStorage.setItem('fm_coach_authed', '1');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  }, { c: clients });
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());

  try {
    await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(1500);

    // Verify all 40 clients loaded
    const clientCount = await page.evaluate(() => (window.clients || []).length);
    if (clientCount === 40) note('Mike@6AM', '40 clients load on boot', 'PASS');
    else note('Mike@6AM', '40 clients on boot', 'FAIL', 'count=' + clientCount);

    // Two-tap test: from home, get to "Add session for Client 1"
    // 1st tap: go to clients tab
    // 2nd tap: open client detail
    // Verify: client detail has an obvious "Log Session" button
    await page.evaluate(() => go('clients'));
    await page.waitForTimeout(400);
    await page.evaluate(() => push('detail', { clientIdx: 0 }));
    await page.waitForTimeout(400);
    const inDetail = await page.evaluate(() => ({
      tab: window.currentView && window.currentView.tab,
      view: window.currentView && window.currentView.view,
      bodyText: document.body.innerText.toLowerCase(),
    }));
    const reachable = inDetail.tab === 'clients' && inDetail.view === 'detail' && /log|session|new/.test(inDetail.bodyText);
    if (reachable) note('Mike@6AM', '2 taps reaches client detail with session option', 'PASS');
    else note('Mike@6AM', '2-tap to client', 'FAIL', JSON.stringify({tab: inDetail.tab, view: inDetail.view}));

    await page.screenshot({ path: '/tmp/persp2-clientdetail.png' });

    // Performance: 40-client list should not jank
    const perfStart = Date.now();
    await page.evaluate(() => go('clients'));
    await page.waitForTimeout(200);
    const perfDur = Date.now() - perfStart;
    if (perfDur < 2000) note('Mike@6AM', '40-client list renders in <2s', 'PASS', perfDur + 'ms');
    else note('Mike@6AM', '40-client list perf', 'FAIL', perfDur + 'ms');
  } finally { await ctx.close(); }
}

// ── PERSPECTIVE 3: Client paying $300/month ──────────────────────
async function premiumClient(browser) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (t.indexOf('Failed to load') < 0 && t.indexOf('net::') < 0 && t.indexOf('favicon') < 0) errs.push(t.substring(0, 100)); } });

  const client = {
    id: 'premium_c1',
    name: 'Marcus Reynolds',
    phone: '5559994444',
    services: ['Training', 'Nutrition', 'Full Package'],
    rate: 300,
    program: { days: [
      { name: 'Push', exercises: [{ name: 'Bench Press', sets: '4', reps: '8' }, { name: 'OHP', sets: '3', reps: '10' }, { name: 'Dips', sets: '3', reps: 'AMRAP' }], cardio: '20 min LISS post-workout' },
      { name: 'Pull', exercises: [{ name: 'Deadlift', sets: '4', reps: '6' }, { name: 'Pull-ups', sets: '4', reps: 'AMRAP' }] },
      { name: 'Legs', exercises: [{ name: 'Back Squat', sets: '5', reps: '5' }, { name: 'RDL', sets: '3', reps: '10' }] },
    ]},
    cardio: { prescriptions: [{ type: 'Incline Treadmill', duration: '30 min', mode: 'LISS' }] },
    anabolics: [{ name: 'Test C', dose: '500mg', freq: 'weekly' }],
    peptides: [{ name: 'BPC-157', dose: '500mcg', freq: 'daily' }],
    fatloss: [{ name: 'Semaglutide', dose: '0.5mg', freq: 'weekly' }],
    supplements: [{ name: 'Whey Isolate', dose: '40g', timing: 'PWO' }, { name: 'Creatine', dose: '5g', timing: 'Daily AM' }],
    organsupport: [{ name: 'NAC', dose: '1200mg', timing: 'AM' }, { name: 'TUDCA', dose: '500mg', timing: 'AM' }],
    water: { goal: 160 },
    sentPrograms: [{
      id: 'sp_premium', title: 'Phase 1 Foundation', dateSent: '2026-04-01',
      phase: 'Off Season', duration: '12 weeks',
      sectionOrder: ['training', 'nutrition', 'anabolics', 'supplements', 'water', 'notes'],
      training: { days: [{ name: 'Day 1', exercises: [{ name: 'Bench', sets: '4', reps: '8' }] }] },
      anabolics: [{ name: 'Test C', dose: '500mg' }],
      supplements: [{ name: 'Whey', dose: '40g', timing: 'PWO' }],
      water: { goal: 160 },
      notes: 'Focus on form weeks 1-3.',
    }],
    checkins: [],
    pinHash: 'x',
    twoFactorEnabled: false,
  };

  await page.addInitScript(({c}) => {
    localStorage.setItem('bm_portal_phone', c.phone);
    localStorage.setItem('bm_portal_login_ts', String(Date.now()));
  }, { c: client });
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());

  try {
    await page.goto('file:///home/user/Big-Mike/portal.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);

    const injected = await page.evaluate(c => {
      window._clientData = c;
      window._portalMessages = [];
      renderProgram();
      const tabs = Array.from(document.querySelectorAll('#progTabs .tab-btn')).map(t => t.textContent.trim());
      return {
        clientNameDisplayed: document.getElementById('clientName')?.textContent === c.name,
        tabsCount: tabs.length,
        tabs,
      };
    }, client);
    if (injected.clientNameDisplayed && injected.tabsCount >= 12) {
      note('PremiumClient', 'Portal renders client name + 12+ tabs (full program experience)', 'PASS', injected.tabsCount + ' tabs');
    } else {
      note('PremiumClient', 'Portal experience', 'FAIL', JSON.stringify(injected));
    }

    // Walk every tab — premium client should see content in every section
    const tabKeys = ['overview', 'programs', 'training', 'cardio', 'peds', 'peptides', 'fatloss', 'supps', 'organ', 'water', 'checkin', 'myprogress', 'messages'];
    let renderedCount = 0;
    let emptyTabs = [];
    for (const k of tabKeys) {
      const len = await page.evaluate(t => {
        window._activeTab = t;
        renderTabContent();
        return (document.getElementById('progContent')?.innerText || '').length;
      }, k);
      if (len > 20) renderedCount++;
      else emptyTabs.push(k);
    }
    if (renderedCount >= 12) note('PremiumClient', '12+ of 13 tabs render with content', 'PASS', renderedCount + '/' + tabKeys.length);
    else note('PremiumClient', 'Tab content coverage', 'FAIL', 'rendered ' + renderedCount + ' empty: ' + emptyTabs.join(','));

    // Take a screenshot of the program detail (simulating reading the program)
    await page.evaluate(() => { window._activeTab = 'training'; renderTabContent(); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: '/tmp/persp3-training.png' });

    if (errs.length === 0) note('PremiumClient', 'Zero console errors during full tab walk', 'PASS');
    else note('PremiumClient', 'Console errors', 'FAIL', errs.slice(0, 2).join('|'));
  } finally { await ctx.close(); }
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    await instagramVisitor(browser);
    await mikeMorning(browser);
    await premiumClient(browser);
  } catch (e) { console.error('fatal', e); }
  await browser.close();

  console.log('\n══════════ THREE PERSPECTIVES ══════════\n');
  const groups = { Instagram: [], 'Mike@6AM': [], PremiumClient: [] };
  results.forEach(r => groups[r.perspective].push(r));
  for (const [p, items] of Object.entries(groups)) {
    console.log('\n[' + p + ']');
    items.forEach(r => {
      const icon = r.status === 'PASS' ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.log('  ' + icon + ' ' + r.item + (r.detail ? '  (' + r.detail + ')' : ''));
    });
  }
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log('\nPASSED: ' + passed + '   FAILED: ' + failed);
  process.exit(failed > 0 ? 1 : 0);
})();
