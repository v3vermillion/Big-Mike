/*  FUNCTIONAL WALKTHROUGH — coach + portal critical paths
    Executes real user flows against app.html and portal.html and
    asserts the expected state after each step. Unlike the harness
    scripts (which verify data flow), this walks the product like
    Mike would on a Monday morning. */

const { chromium } = require('playwright');

const results = [];
function pass(name) { results.push({ status: 'PASS', name }); }
function fail(name, reason) { results.push({ status: 'FAIL', name, reason }); }

async function seedCoach(page) {
  const testClient = {
    id: 'walkthrough_client_001',
    name: 'Walkthrough Test Client',
    phone: '5551119999',
    email: 'walk@test.local',
    clientType: 'active',
    services: ['Training', 'Nutrition'],
    rate: 150,
    created: Date.now(),
  };
  await page.addInitScript(({client}) => {
    try {
      localStorage.setItem('fm_clients', JSON.stringify([client]));
      localStorage.setItem('fm_sessions', JSON.stringify([]));
      localStorage.setItem('fm_schedule', JSON.stringify([]));
      localStorage.setItem('fm_programs', JSON.stringify([]));
      localStorage.setItem('fm_workouts', JSON.stringify([]));
      localStorage.setItem('fm_mealPlans', JSON.stringify([]));
      localStorage.setItem('fm_messages', JSON.stringify([]));
      localStorage.setItem('fm_inbox', JSON.stringify([]));
      localStorage.setItem('fm_supabase_auth', JSON.stringify({ authed: true, ts: Date.now() }));
      localStorage.setItem('fm_coach_authed', '1');
    } catch (e) {}
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  }, { client: testClient });
  return testClient;
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  // ─────────────────────────────────────────────────────────────
  // FLOW 1: Coach boots app, navigates tabs, no dead ends
  // ─────────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (t.indexOf('Failed to load') < 0 && t.indexOf('net::') < 0 && t.indexOf('favicon') < 0) errs.push(t.substring(0, 120)); } });
    await seedCoach(page);
    await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    try {
      await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(1200);

      // Check app booted
      const booted = await page.evaluate(() => {
        return {
          hasMain: !!document.querySelector('#tabs, .tab-row, .view, body'),
          clients: (window.clients || []).length,
          currentTab: (window.currentView && window.currentView.tab) || null,
        };
      });
      if (booted.clients === 1 && booted.currentTab) pass('FLOW1.1 coach app boots with seeded client');
      else fail('FLOW1.1 coach app boots with seeded client', JSON.stringify(booted));

      // Navigate to each main tab — wait > 300ms per call so _navLock releases between go()
      const tabs = ['home', 'clients', 'sessions', 'schedule', 'nutrition', 'settings', 'inbox'];
      for (const tab of tabs) {
        try {
          await page.evaluate(t => go(t), tab);
          await page.waitForTimeout(400);
          const state = await page.evaluate(() => ({
            tab: (window.currentView && window.currentView.tab) || null,
            errors: window._lastError || null,
          }));
          if (state.tab === tab) pass('FLOW1.2 go("' + tab + '") lands on correct tab');
          else fail('FLOW1.2 go("' + tab + '")', 'currentView.tab=' + state.tab);
        } catch (e) {
          fail('FLOW1.2 go("' + tab + '")', e.message);
        }
      }

      if (errs.length) fail('FLOW1.3 coach tab sweep zero console errors', errs.slice(0, 2).join(' | '));
      else pass('FLOW1.3 coach tab sweep zero console errors');
    } finally {
      await ctx.close();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FLOW 2: Wizard merge writes every field to the client record
  // ─────────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await seedCoach(page);
    await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    try {
      await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(800);

      const wizResult = await page.evaluate(() => {
        const wiz = {
          id: 'wiz_walkthrough',
          clientId: 'walkthrough_client_001',
          clientName: 'Walkthrough Test Client',
          name: 'Phase 1 Test Program',
          phase: 'Off Season',
          duration: '12 weeks',
          status: 'sent',
          dateSent: new Date().toISOString(),
          sections: ['training', 'cardio', 'anabolics', 'peptides', 'fatloss', 'supplements', 'organsupport', 'water'],
          training: { days: [{ name: 'Day 1', exercises: [{ name: 'Bench Press', sets: '4', reps: '8' }] }] },
          cardio: { prescriptions: [{ type: 'Treadmill', duration: '30 min', mode: 'LISS' }], notes: 'Post-workout only' },
          anabolics: { items: [{ name: 'Test C', dose: '500mg', freq: 'weekly' }] },
          peptides: { items: [{ name: 'BPC-157', dose: '500mcg', freq: 'daily' }] },
          fatloss: { items: [{ name: 'Semaglutide', dose: '0.5mg', freq: 'weekly' }] },
          supplements: { items: [{ name: 'Whey', dose: '40g', timing: 'PWO' }] },
          organsupport: { items: [{ name: 'NAC', dose: '1200mg', timing: 'AM' }] },
          water: { goal: 160 },
          protocolNotes: 'Test protocol notes',
        };
        if (typeof _wizMergeToClient !== 'function') return { ok: false, err: 'no _wizMergeToClient' };
        _wizMergeToClient(wiz);
        const c = clients.find(x => x.id === wiz.clientId);
        return {
          ok: true,
          hasProgram: !!c.program,
          hasCardio: !!c.cardio,
          hasAnabolics: Array.isArray(c.anabolics) && c.anabolics.length === 1,
          hasPeptides: Array.isArray(c.peptides) && c.peptides.length === 1,
          hasFatloss: Array.isArray(c.fatloss) && c.fatloss.length === 1,
          hasSupplements: Array.isArray(c.supplements) && c.supplements.length === 1,
          hasOrgansupport: Array.isArray(c.organsupport) && c.organsupport.length === 1,
          waterGoal: c.water && c.water.goal,
          sentProgramsCount: c.sentPrograms ? c.sentPrograms.length : 0,
        };
      });

      if (wizResult.ok && wizResult.hasProgram && wizResult.hasCardio && wizResult.hasAnabolics &&
          wizResult.hasPeptides && wizResult.hasFatloss && wizResult.hasSupplements &&
          wizResult.hasOrgansupport && wizResult.waterGoal === 160 && wizResult.sentProgramsCount === 1) {
        pass('FLOW2 wizard merge writes all 8 sections + cardio + water + sentPrograms');
      } else {
        fail('FLOW2 wizard merge', JSON.stringify(wizResult));
      }
    } finally {
      await ctx.close();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FLOW 3: Portal renders every section tab for a populated client
  // ─────────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (t.indexOf('Failed to load') < 0 && t.indexOf('net::') < 0 && t.indexOf('favicon') < 0) errs.push(t.substring(0, 120)); } });

    const fullClient = {
      id: 'portal_walk_001',
      name: 'Portal Test',
      phone: '5552223333',
      services: ['Training'],
      program: { days: [{ name: 'Push', exercises: [{ name: 'Bench', sets: '4', reps: '8' }] }] },
      cardio: { prescriptions: [{ type: 'Stepper', duration: '20 min', mode: 'Moderate' }] },
      anabolics: [{ name: 'Test C', dose: '500mg', freq: 'weekly' }],
      peptides: [{ name: 'BPC-157', dose: '500mcg', freq: 'daily' }],
      fatloss: [{ name: 'Semaglutide', dose: '0.5mg', freq: 'weekly' }],
      supplements: [{ name: 'Whey', dose: '40g', timing: 'PWO' }],
      organsupport: [{ name: 'NAC', dose: '1200mg', timing: 'AM' }],
      water: { goal: 160 },
      sentPrograms: [{
        id: 'sp_1', title: 'Phase 1', dateSent: '2026-04-01', phase: 'Off Season', duration: '12w',
        sectionOrder: ['training', 'anabolics'],
        training: { days: [{ name: 'Day 1', exercises: [{ name: 'Bench', sets: '4', reps: '8' }] }] },
        anabolics: [{ name: 'Test C', dose: '500mg' }],
      }],
      checkins: [{ weight: 215, bodyFat: 12, notes: 'Strong', photos: ['file:///fake.jpg'], date: '2026-04-06' }],
      pinHash: 'x', twoFactorEnabled: false,
    };

    await page.addInitScript(({ c }) => {
      try {
        localStorage.setItem('bm_portal_phone', c.phone);
        localStorage.setItem('bm_portal_login_ts', String(Date.now()));
      } catch (e) {}
      window._HARNESS_CLIENT = c;
    }, { c: fullClient });
    await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    try {
      await page.goto('file:///home/user/Big-Mike/portal.html', { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(600);

      const injectOk = await page.evaluate((c) => {
        try {
          window._clientData = c;
          window._portalMessages = [];
          if (typeof renderProgram !== 'function') return { ok: false, reason: 'no renderProgram' };
          renderProgram();
          return { ok: true };
        } catch (e) { return { ok: false, reason: e.message }; }
      }, fullClient);
      if (injectOk.ok) pass('FLOW3.1 portal accepts client injection');
      else fail('FLOW3.1 portal injection', injectOk.reason);

      const tabKeys = ['overview', 'programs', 'training', 'cardio', 'peds', 'peptides', 'fatloss', 'supps', 'organ', 'water', 'checkin', 'myprogress', 'messages'];
      for (const k of tabKeys) {
        const r = await page.evaluate((tk) => {
          try {
            window._activeTab = tk;
            if (typeof renderTabContent === 'function') renderTabContent();
            else return { ok: false, reason: 'no renderTabContent' };
            const el = document.getElementById('progContent');
            const text = el ? (el.innerText || '') : '';
            return { ok: true, len: text.length };
          } catch (e) { return { ok: false, reason: e.message }; }
        }, k);
        if (r.ok && r.len > 10) pass('FLOW3.2 tab "' + k + '" renders (' + r.len + ' chars)');
        else fail('FLOW3.2 tab "' + k + '"', r.reason || ('empty ' + r.len + ' chars'));
      }

      if (errs.length === 0) pass('FLOW3.3 portal tab sweep zero console errors');
      else fail('FLOW3.3 portal console errors', errs.slice(0, 2).join(' | '));
    } finally {
      await ctx.close();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FLOW 4: Public site — every public page loads cleanly
  // ─────────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('bm_revealed','1'); } catch(e){} });
    await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    const pages = ['index', 'about', 'services', 'results', 'platform', 'gallery', 'contact', 'book', 'onboard', '404'];
    for (const name of pages) {
      const errs = [];
      page.removeAllListeners('pageerror');
      page.removeAllListeners('console');
      page.on('pageerror', e => errs.push(e.message));
      page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (t.indexOf('Failed to load') < 0 && t.indexOf('net::') < 0 && t.indexOf('favicon') < 0) errs.push(t.substring(0, 120)); } });
      try {
        await page.goto(`file:///home/user/Big-Mike/${name}.html`, { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(400);
        const rendered = await page.evaluate(() => document.body.innerHTML.length);
        if (rendered > 1000 && errs.length === 0) pass('FLOW4 ' + name + '.html loads clean');
        else fail('FLOW4 ' + name + '.html', (errs[0] || 'empty') + ' (' + rendered + ' chars)');
      } catch (e) { fail('FLOW4 ' + name + '.html', e.message); }
    }
    await ctx.close();
  }

  await browser.close();

  console.log('\n══════════ FUNCTIONAL WALKTHROUGH ══════════\n');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  results.forEach(r => {
    if (r.status === 'PASS') console.log('\x1b[32m✓\x1b[0m ' + r.name);
    else console.log('\x1b[31m✗\x1b[0m ' + r.name + '  →  ' + (r.reason || ''));
  });
  console.log('\nPASSED: ' + passed);
  console.log('FAILED: ' + failed);
  process.exit(failed > 0 ? 1 : 0);
})();
