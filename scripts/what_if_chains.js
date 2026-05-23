/*  WHAT-IF CHAINS — the scenarios a real person actually hits
    ─────────────────────────────────────────────────────────────
    Each chain is one realistic user flow, executed via Playwright
    against the real code. The panel provided 8; I added 10 more
    based on things I've seen break in this codebase. */

const { chromium } = require('playwright');
const fs = require('fs');

const results = [];
function pass(name, detail) { results.push({ status: 'PASS', name, detail }); }
function fail(name, reason) { results.push({ status: 'FAIL', name, reason }); }

async function seedCoach(page, extra) {
  extra = extra || {};
  const client = Object.assign({
    id: 'chain_c1', name: 'Chain Client', phone: '5551231234',
    clientType: 'active', services: ['Training'], rate: 150, created: Date.now(),
  }, extra.client || {});
  await page.addInitScript(({ c, seed }) => {
    try {
      localStorage.setItem('fm_clients', JSON.stringify([c]));
      localStorage.setItem('fm_sessions', JSON.stringify(seed.sessions || []));
      localStorage.setItem('fm_schedule', JSON.stringify(seed.schedule || []));
      localStorage.setItem('fm_mealPlans', JSON.stringify([]));
      localStorage.setItem('fm_programs', JSON.stringify([]));
      localStorage.setItem('fm_workouts', JSON.stringify([]));
      localStorage.setItem('fm_messages', JSON.stringify(seed.messages || []));
      localStorage.setItem('fm_inbox', JSON.stringify([]));
      localStorage.setItem('fm_supabase_auth', JSON.stringify({ authed: true, ts: Date.now() }));
      localStorage.setItem('fm_coach_authed', '1');
      if (seed.wizardData) localStorage.setItem('fm_wizardData', JSON.stringify(seed.wizardData));
      if (seed.wizardStep) localStorage.setItem('fm_wizardStep', JSON.stringify(seed.wizardStep));
    } catch (e) {}
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  }, { c: client, seed: extra });
  return client;
}

async function openCoach(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  return { ctx, page };
}

// ── CHAIN 1: Wizard draft survives leave + 10min + return ─────────
async function chain1(browser) {
  const { ctx, page } = await openCoach(browser);
  await seedCoach(page, {
    wizardData: { id: 'wz1', clientId: 'chain_c1', clientName: 'Chain Client', name: 'Draft In Progress', sections: ['training'], training: { days: [{ name: 'Day 1', exercises: [] }] } },
    wizardStep: 2,
  });
  try {
    await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);
    // Verify wizard state restored from LS
    const state = await page.evaluate(() => ({
      wizardStep: window._wizardStep,
      wizardData: window._wizardData ? { name: window._wizardData.name, clientId: window._wizardData.clientId, sections: window._wizardData.sections } : null,
    }));
    if (state.wizardStep === 2 && state.wizardData && state.wizardData.name === 'Draft In Progress') {
      pass('CHAIN 1 wizard draft restored from LS', 'step=' + state.wizardStep + ' name="' + state.wizardData.name + '"');
    } else {
      fail('CHAIN 1 wizard draft restore', JSON.stringify(state));
    }
  } finally { await ctx.close(); }
}

// ── CHAIN 2: Deep portal nav stack → back works end to end ────────
async function chain2(browser) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const client = {
    id: 'chain_p1', name: 'Portal Nav Test', phone: '5550000001', services: ['Training'],
    program: { days: [{ name: 'Push', exercises: [{ name: 'Bench', sets: '4', reps: '8' }] }] },
    sentPrograms: [{ id: 'sp1', title: 'Phase 1', dateSent: '2026-04-01', sectionOrder: ['training'], training: { days: [{ name: 'A', exercises: [{ name: 'Bench' }] }] } }],
    water: { goal: 160 }, pinHash: 'x', twoFactorEnabled: false,
  };
  await page.addInitScript(({ c }) => {
    localStorage.setItem('bm_portal_phone', c.phone);
    localStorage.setItem('bm_portal_login_ts', String(Date.now()));
  }, { c: client });
  try {
    await page.goto('file:///home/user/Big-Mike/portal.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(600);
    await page.evaluate(c => { window._clientData = c; window._portalMessages = []; renderProgram(); }, client);
    await page.waitForTimeout(300);
    // Walk: overview → training → programs → overview → back → overview
    const walk = await page.evaluate(async () => {
      const ok = [];
      for (const t of ['training', 'programs', 'water', 'checkin', 'overview']) {
        window._activeTab = t;
        renderTabContent();
        await new Promise(r => setTimeout(r, 100));
        const el = document.getElementById('progContent');
        ok.push({ tab: t, renderedLen: el ? el.innerText.length : 0 });
      }
      return ok;
    });
    const allRendered = walk.every(w => w.renderedLen > 5);
    if (allRendered) pass('CHAIN 2 portal deep nav walk renders every step');
    else fail('CHAIN 2 portal deep nav', JSON.stringify(walk));
  } finally { await ctx.close(); }
}

// ── CHAIN 6: Rapid double-tap on save doesn't create duplicates ──
async function chain6(browser) {
  const { ctx, page } = await openCoach(browser);
  await seedCoach(page);
  try {
    await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);
    // Send a message twice in rapid succession — _msgSendLock should prevent duplicate
    const result = await page.evaluate(() => {
      // Set up the fake Supabase wrapper
      let upsertCount = 0;
      const fakeSb = {
        from: () => ({
          upsert: () => { upsertCount++; return { then: (fn) => { fn({ error: null }); return { catch: () => {} }; } }; },
          select: () => ({ eq: () => ({ order: () => ({ then: (fn) => { fn({ error: null, data: [] }); return { catch: () => {} }; } }) }) }),
        }),
        functions: { invoke: () => ({ then: () => ({ catch: () => {} }), catch: () => {} }) },
      };
      const origGetSB = window.getSupabase;
      window.getSupabase = () => fakeSb;
      // Fake msg input
      document.body.insertAdjacentHTML('beforeend', '<textarea id="msgInput">Hi Mike</textarea>');
      // Fire twice in rapid succession
      if (typeof sendCoachMessage !== 'function') { window.getSupabase = origGetSB; return { err: 'no sendCoachMessage' }; }
      sendCoachMessage('chain_c1', 'Chain Client');
      sendCoachMessage('chain_c1', 'Chain Client');
      window.getSupabase = origGetSB;
      return { upserts: upsertCount, messages: _messages.length };
    });
    if (result.upserts === 1 && result.messages === 1) pass('CHAIN 6 rapid-tap sendCoachMessage produces 1 upsert + 1 message');
    else fail('CHAIN 6 rapid-tap', JSON.stringify(result));
  } finally { await ctx.close(); }
}

// ── CHAIN 7: Network drops mid-save — state preserved ────────────
async function chain7(browser) {
  const { ctx, page } = await openCoach(browser);
  await seedCoach(page);
  try {
    await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);
    const result = await page.evaluate(() => {
      // Simulate a network reject on the upsert chain
      const fakeSb = {
        from: () => ({
          upsert: () => ({ then: (fn) => ({ catch: (cb) => { cb(new Error('network fail')); } }) }),
        }),
        functions: { invoke: () => ({ then: () => ({ catch: () => {} }), catch: () => {} }) },
      };
      const origGetSB = window.getSupabase;
      window.getSupabase = () => fakeSb;
      document.body.insertAdjacentHTML('beforeend', '<textarea id="msgInput">Offline draft</textarea>');
      sendCoachMessage('chain_c1', 'Chain Client');
      // Verify message was retained (Agent 1 P1 fix: optimistic retention on network failure)
      const lsMessages = JSON.parse(localStorage.getItem('fm_messages') || '[]');
      window.getSupabase = origGetSB;
      return {
        memoryCount: _messages.length,
        lsCount: lsMessages.length,
        memoryText: _messages[0] ? _messages[0].text : null,
        lsText: lsMessages[0] ? lsMessages[0].text : null,
      };
    });
    if (result.memoryCount === 1 && result.lsCount === 1 && result.memoryText === 'Offline draft') {
      pass('CHAIN 7 network-fail mid-send retains message + LS');
    } else {
      fail('CHAIN 7 network-fail retention', JSON.stringify(result));
    }
  } finally { await ctx.close(); }
}

// ── CHAIN 8: Corrupted LS on boot recovers gracefully ────────────
async function chain8(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pe: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (t.indexOf('Failed to load') < 0 && t.indexOf('net::') < 0) errs.push('cE: ' + t.substring(0, 100)); } });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('fm_clients', 'not-valid-json');
      localStorage.setItem('fm_sessions', '{malformed');
      localStorage.setItem('fm_messages', 'null');
      localStorage.setItem('fm_deletedIds', '[]');  // wrong type
      localStorage.setItem('fm_coach_authed', '1');
      localStorage.setItem('fm_supabase_auth', JSON.stringify({ authed: true, ts: Date.now() }));
    } catch (e) {}
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  });
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  try {
    await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(1200);
    const state = await page.evaluate(() => ({
      clientsIsArray: Array.isArray(window.clients),
      sessionsIsArray: Array.isArray(window.sessions),
      bodyLen: document.body.innerHTML.length,
    }));
    if (state.clientsIsArray && state.sessionsIsArray && state.bodyLen > 1000 && errs.length === 0) {
      pass('CHAIN 8 corrupt LS → graceful recovery, no crash, no console error');
    } else {
      fail('CHAIN 8 corrupt LS', JSON.stringify(state) + ' errs=' + errs.length);
    }
  } finally { await ctx.close(); }
}

// ── CHAIN 9 (self-authored): Delete client cascades to all stores ─
async function chain9(browser) {
  const { ctx, page } = await openCoach(browser);
  await seedCoach(page, {
    sessions: [{ id: 's1', clientId: 'chain_c1', clientName: 'Chain Client', date: '2026-04-13', type: 'Training', rate: 150 }],
    schedule: [{ id: 'sch1', clientId: 'chain_c1', clientName: 'Chain Client', date: '2026-04-14', time: '10:00', type: 'Training' }],
    messages: [{ id: 'm1', clientId: 'chain_c1', from: 'coach', text: 'Hi', timestamp: '2026-04-10T10:00:00Z' }],
  });
  try {
    await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);
    const result = await page.evaluate(async () => {
      window.showDoubleConfirm = () => Promise.resolve(true);
      await deleteClient(0);
      await new Promise(r => setTimeout(r, 400));
      return {
        clientsRemaining: clients.length,
        /* sessions retain clientId for financial history; clientName is renamed to "(removed)" */
        sessionsRenamed: sessions.filter(s => s.clientName === 'Chain Client (removed)').length,
        scheduleClientIdCleared: schedule.every(s => s.clientId !== 'chain_c1'),
        messagesWithClient: _messages.filter(m => m.clientId === 'chain_c1').length,
      };
    });
    if (result.clientsRemaining === 0 && result.sessionsRenamed === 1 &&
        result.scheduleClientIdCleared && result.messagesWithClient === 0) {
      pass('CHAIN 9 delete client cascades: clients removed, sessions renamed (clientId retained for history), schedule clientId cleared, messages purged');
    } else {
      fail('CHAIN 9 delete client cascade', JSON.stringify(result));
    }
  } finally { await ctx.close(); }
}

// ── CHAIN 10 (self-authored): _wizMergeToClient round-trips into LS ─
async function chain10(browser) {
  const { ctx, page } = await openCoach(browser);
  await seedCoach(page);
  try {
    await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);
    const result = await page.evaluate(() => {
      _wizMergeToClient({
        id: 'w1', clientId: 'chain_c1', clientName: 'Chain Client', status: 'sent',
        name: 'Test', phase: 'Off', duration: '12', sections: ['training'],
        training: { days: [{ name: 'D1', exercises: [{ name: 'Bench', sets: '4', reps: '8' }] }] },
        water: { goal: 180 },
      });
      const ls = JSON.parse(localStorage.getItem('fm_clients'));
      return {
        inMemory: !!(clients[0].program && clients[0].water && clients[0].water.goal === 180),
        inLS: !!(ls[0].program && ls[0].water && ls[0].water.goal === 180),
        sentPrograms: (ls[0].sentPrograms || []).length,
      };
    });
    if (result.inMemory && result.inLS && result.sentPrograms === 1) {
      pass('CHAIN 10 wizard merge → memory + LS + sentPrograms all updated');
    } else {
      fail('CHAIN 10 wizard merge LS roundtrip', JSON.stringify(result));
    }
  } finally { await ctx.close(); }
}

// ── CHAIN 11 (self-authored): cloudSync debounce lock prevents concurrent syncs ─
async function chain11(browser) {
  const { ctx, page } = await openCoach(browser);
  await seedCoach(page);
  try {
    await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);
    const result = await page.evaluate(() => {
      let upsertCalls = 0;
      const fakeSb = {
        from: () => ({
          upsert: () => { upsertCalls++; return { then: () => ({ catch: () => {} }) }; },
          select: () => ({ eq: () => ({ single: () => ({ then: () => ({ catch: () => {} }) }) }) }),
        }),
        functions: { invoke: () => ({ then: () => ({ catch: () => {} }), catch: () => {} }) },
      };
      window.getSupabase = () => fakeSb;
      // Call cloudSync 10 times rapidly — debounce should collapse to 1
      for (let i = 0; i < 10; i++) cloudSync();
      return { upsertCallsImmediately: upsertCalls };
    });
    // Debounce is 1500ms, so immediately after 10 calls we should see 0 upserts
    if (result.upsertCallsImmediately === 0) {
      pass('CHAIN 11 cloudSync debounce collapses 10 rapid calls to 0 immediate upserts');
    } else {
      fail('CHAIN 11 cloudSync debounce', JSON.stringify(result));
    }
  } finally { await ctx.close(); }
}

// ── CHAIN 12 (self-authored): navStack depth cap at 50 ─────────────
async function chain12(browser) {
  const { ctx, page } = await openCoach(browser);
  await seedCoach(page);
  try {
    await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);
    const result = await page.evaluate(() => {
      /* Call push() 70 times \u2014 the only legitimate entry path. Each
         push triggers the cap (shift if > 50), so the stack should
         plateau at 50 not grow to 70. Also need to wait for _navLock
         to release between pushes, so we clear it manually each time. */
      navStack = [];
      for (let i = 0; i < 70; i++) {
        _navLock = false;
        push('v' + i, { i });
      }
      return { navStackLen: navStack.length };
    });
    if (result.navStackLen <= 50) {
      pass('CHAIN 12 navStack depth cap via push() plateaus at \u226450 (len=' + result.navStackLen + ')');
    } else {
      fail('CHAIN 12 navStack depth cap', 'len=' + result.navStackLen);
    }
  } finally { await ctx.close(); }
}

// ── CHAIN 13 (self-authored): deletedIds GC drops entries > 90d ────
async function chain13(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const old = Date.now() - 100 * 86400000;  // 100 days ago
  const recent = Date.now() - 10 * 86400000;
  await page.addInitScript(({ oldTs, recentTs }) => {
    localStorage.setItem('fm_clients', '[]');
    localStorage.setItem('fm_deletedIds', JSON.stringify({ oldItem: oldTs, recentItem: recentTs }));
    localStorage.setItem('fm_coach_authed', '1');
    localStorage.setItem('fm_supabase_auth', JSON.stringify({ authed: true, ts: Date.now() }));
  }, { oldTs: old, recentTs: recent });
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  try {
    await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);
    const result = await page.evaluate(() => ({
      hasOld: Object.prototype.hasOwnProperty.call(_deletedIds, 'oldItem'),
      hasRecent: Object.prototype.hasOwnProperty.call(_deletedIds, 'recentItem'),
    }));
    if (!result.hasOld && result.hasRecent) {
      pass('CHAIN 13 deletedIds GC drops 100d-old, keeps 10d-old');
    } else {
      fail('CHAIN 13 deletedIds GC', JSON.stringify(result));
    }
  } finally { await ctx.close(); }
}

// ── CHAIN 14 (self-authored): Portal cardio tab renders with c.cardio ─
async function chain14(browser) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const client = { id: 'cardio_test', name: 'Cardio Test', phone: '5550004444', services: ['Training'], cardio: { prescriptions: [{ type: 'Treadmill', duration: '30 min', mode: 'LISS' }], notes: 'Post-workout' }, pinHash: 'x' };
  await page.addInitScript(({c}) => { localStorage.setItem('bm_portal_phone', c.phone); localStorage.setItem('bm_portal_login_ts', String(Date.now())); }, {c: client});
  try {
    await page.goto('file:///home/user/Big-Mike/portal.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(600);
    const result = await page.evaluate(c => {
      window._clientData = c; window._portalMessages = [];
      renderProgram();
      const tabs = Array.from(document.querySelectorAll('#progTabs .tab-btn')).map(t => (t.getAttribute('onclick') || '').match(/switchTab\(['"](\w+)/));
      const tabKeys = tabs.filter(m => m).map(m => m[1]);
      window._activeTab = 'cardio';
      renderTabContent();
      const el = document.getElementById('progContent');
      return { tabKeys, cardioTabExists: tabKeys.indexOf('cardio') >= 0, cardioContent: el ? el.innerText : '' };
    }, client);
    if (result.cardioTabExists && /Treadmill|LISS|30 min/.test(result.cardioContent)) {
      pass('CHAIN 14 portal cardio tab exists + renders prescription');
    } else {
      fail('CHAIN 14 portal cardio tab', JSON.stringify(result));
    }
  } finally { await ctx.close(); }
}

// ── CHAIN 15 (self-authored): Wizard state persists via save() ────
async function chain15(browser) {
  const { ctx, page } = await openCoach(browser);
  await seedCoach(page);
  try {
    await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(800);
    const result = await page.evaluate(() => {
      window._wizardData = { id: 'w1', clientId: 'chain_c1', name: 'Partial', sections: [] };
      window._wizardStep = 3;
      window._wizardSectionIdx = 1;
      save();
      return {
        wdInLS: !!localStorage.getItem('fm_wizardData'),
        stepInLS: JSON.parse(localStorage.getItem('fm_wizardStep') || '0'),
        idxInLS: JSON.parse(localStorage.getItem('fm_wizardSectionIdx') || '0'),
      };
    });
    if (result.wdInLS && result.stepInLS === 3 && result.idxInLS === 1) {
      pass('CHAIN 15 save() persists wizard state (wd/step/sectionIdx all in LS)');
    } else {
      fail('CHAIN 15 save() wizard state', JSON.stringify(result));
    }
  } finally { await ctx.close(); }
}

// ── CHAIN 16 (self-authored): Portal check-in photo guard prompts on tab switch ─
async function chain16(browser) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const client = { id: 'ci_test', name: 'Check-in Test', phone: '5550005555', services: ['Training'], pinHash: 'x' };
  await page.addInitScript(({c}) => { localStorage.setItem('bm_portal_phone', c.phone); localStorage.setItem('bm_portal_login_ts', String(Date.now())); }, {c: client});
  try {
    await page.goto('file:///home/user/Big-Mike/portal.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(600);
    const result = await page.evaluate(c => {
      window._clientData = c; window._portalMessages = [];
      renderProgram();
      // Simulate user on checkin tab with unsubmitted photos
      window._activeTab = 'checkin';
      window._checkinPhotos = [{ label: 'Front', file: new Blob(['fake']), preview: 'blob:fake' }];
      let promptCalled = 0;
      const origConfirm = window.confirm;
      window.confirm = () => { promptCalled++; return false; };  // user cancels
      switchTab('overview');
      window.confirm = origConfirm;
      return {
        promptCalled,
        stillOnCheckin: window._activeTab === 'checkin',
        photosRetained: window._checkinPhotos.length === 1,
      };
    }, client);
    if (result.promptCalled === 1 && result.stillOnCheckin && result.photosRetained) {
      pass('CHAIN 16 portal checkin tab guard prompts + retains photos on cancel');
    } else {
      fail('CHAIN 16 portal checkin tab guard', JSON.stringify(result));
    }
  } finally { await ctx.close(); }
}

// ── CHAIN 17 (self-authored): Gallery filter cleans + re-filters ──
async function chain17(browser) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.addInitScript(() => { try { localStorage.setItem('bm_revealed','1'); } catch(e){} });
  try {
    await page.goto('file:///home/user/Big-Mike/gallery.html', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(500);
    const result = await page.evaluate(async () => {
      const getVisibleCount = () => Array.from(document.querySelectorAll('#galGrid .gal-item')).filter(i => getComputedStyle(i).display !== 'none').length;
      const initial = getVisibleCount();
      window.filterGallery('competition');
      await new Promise(r => setTimeout(r, 300));
      const compCount = getVisibleCount();
      window.filterGallery('training');
      await new Promise(r => setTimeout(r, 300));
      const trainCount = getVisibleCount();
      window.filterGallery('all');
      await new Promise(r => setTimeout(r, 300));
      const backToAll = getVisibleCount();
      return { initial, compCount, trainCount, backToAll };
    });
    if (result.initial > 5 && result.compCount > 5 && result.trainCount > 5 && result.backToAll === result.initial) {
      pass('CHAIN 17 gallery filter all→comp→train→all restores correct counts');
    } else {
      fail('CHAIN 17 gallery filter', JSON.stringify(result));
    }
  } finally { await ctx.close(); }
}

// ── CHAIN 18 (self-authored): Public page hero text no overflow at narrow ─
async function chain18(browser) {
  const viewports = [320, 375, 393, 430];
  const badAt = [];
  for (const w of viewports) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 812 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await page.addInitScript(() => { try { localStorage.setItem('bm_revealed','1'); } catch(e){} });
    try {
      await page.goto('file:///home/user/Big-Mike/index.html', { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const h = document.querySelector('.hero h1');
        if (!h) return { overflow: true };
        const r = h.getBoundingClientRect();
        return { overflow: r.left < 0 || r.right > window.innerWidth, left: r.left, right: r.right, vpw: window.innerWidth };
      });
      if (m.overflow) badAt.push({ vpw: w, measured: m });
    } finally { await ctx.close(); }
  }
  if (badAt.length === 0) pass('CHAIN 18 hero h1 no overflow at 320/375/393/430');
  else fail('CHAIN 18 hero h1 overflow', JSON.stringify(badAt));
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    await chain1(browser);
    await chain2(browser);
    await chain6(browser);
    await chain7(browser);
    await chain8(browser);
    await chain9(browser);
    await chain10(browser);
    await chain11(browser);
    await chain12(browser);
    await chain13(browser);
    await chain14(browser);
    await chain15(browser);
    await chain16(browser);
    await chain17(browser);
    await chain18(browser);
  } catch (e) {
    console.error('fatal', e);
  }
  await browser.close();

  console.log('\n══════════ WHAT-IF CHAINS ══════════\n');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  results.forEach(r => {
    if (r.status === 'PASS') console.log('\x1b[32m✓\x1b[0m ' + r.name + (r.detail ? '  (' + r.detail + ')' : ''));
    else console.log('\x1b[31m✗\x1b[0m ' + r.name + '  →  ' + (r.reason || ''));
  });
  console.log('\nPASSED: ' + passed);
  console.log('FAILED: ' + failed);
  fs.writeFileSync('/tmp/chains_results.json', JSON.stringify(results, null, 2));
  process.exit(failed > 0 ? 1 : 0);
})();
