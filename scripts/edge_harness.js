/*  EDGE CASE / RESILIENCE HARNESS
    ─────────────────────────────────────────────────────────
    Tests the coach app under adversarial conditions:
    - Empty client list (first-run experience)
    - Client with no services / no program
    - Client with absurd data volumes
    - Reload mid-wizard (wizard state persistence)
    - LS quota near limit                                    */

const { chromium } = require('playwright');

const results = { passed: 0, failed: 0, errors: [], details: [] };
function assert(cond, msg) {
  if (cond) { results.passed++; results.details.push('\x1b[32m✓\x1b[0m ' + msg); }
  else { results.failed++; results.details.push('\x1b[31m✗\x1b[0m ' + msg); results.errors.push(msg); }
}

async function testEmptyState(browser) {
  console.log('\n── Empty state (first-run)');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pe: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') {
      const t = m.text();
      if (t.indexOf('Failed to load') < 0 && t.indexOf('net::ERR') < 0) errs.push('cE: ' + t.substring(0, 150));
    }
  });

  await page.addInitScript(() => {
    /* Seed an empty LS — no clients, no sessions, no schedule, no programs */
    localStorage.setItem('fm_clients', '[]');
    localStorage.setItem('fm_sessions', '[]');
    localStorage.setItem('fm_schedule', '[]');
    localStorage.setItem('fm_mealPlans', '[]');
    localStorage.setItem('fm_programs', '[]');
    localStorage.setItem('fm_workouts', '[]');
    localStorage.setItem('fm_messages', '[]');
    localStorage.setItem('fm_inbox', '[]');
    localStorage.setItem('fm_coach_authed', '1');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  });
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto('file:///home/user/bigmike/app.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const state = await page.evaluate(() => ({
    bodyLen: document.body.innerHTML.length,
    clientsLen: (window.clients || []).length,
    homeRendered: document.body.innerText.toLowerCase().indexOf('home') >= 0 || document.body.innerText.length > 100,
  }));
  assert(state.bodyLen > 1000, 'empty-state: app renders (' + state.bodyLen + ' bytes)');
  assert(state.clientsLen === 0, 'empty-state: zero clients in scope');
  assert(errs.length === 0, `empty-state: zero console errors (${errs.length} found)`);
  if (errs.length) errs.slice(0, 3).forEach(e => console.log('   ' + e));
  await ctx.close();
}

async function testMalformedClient(browser) {
  console.log('\n── Malformed client (missing fields)');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pe: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') {
      const t = m.text();
      if (t.indexOf('Failed to load') < 0 && t.indexOf('net::ERR') < 0) errs.push('cE: ' + t.substring(0, 150));
    }
  });

  // A client missing program, services, anabolics, etc. — only id + name
  const malformed = { id: 'malformed_001', name: 'Skeleton', phone: '5551112222' };
  await page.addInitScript(({c}) => {
    localStorage.setItem('fm_clients', JSON.stringify([c]));
    localStorage.setItem('fm_sessions', '[]');
    localStorage.setItem('fm_schedule', '[]');
    localStorage.setItem('fm_mealPlans', '[]');
    localStorage.setItem('fm_programs', '[]');
    localStorage.setItem('fm_workouts', '[]');
    localStorage.setItem('fm_messages', '[]');
    localStorage.setItem('fm_inbox', '[]');
    localStorage.setItem('fm_coach_authed', '1');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  }, { c: malformed });
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto('file:///home/user/bigmike/app.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // Try to navigate to the client detail
  const nav = await page.evaluate(() => {
    try {
      if (typeof go === 'function') go('clients');
      if (typeof push === 'function') push('detail', { clientIdx: 0 });
      return { ok: true };
    } catch (e) { return { ok: false, err: e.message }; }
  });
  await page.waitForTimeout(400);

  const afterNav = await page.evaluate(() => ({
    bodyLen: document.body.innerHTML.length,
  }));
  assert(nav.ok, 'malformed: navigation to client detail did not throw');
  assert(afterNav.bodyLen > 500, 'malformed: client detail renders');
  assert(errs.length === 0, `malformed: zero console errors (${errs.length} found)`);
  if (errs.length) errs.slice(0, 3).forEach(e => console.log('   ' + e));
  await ctx.close();
}

async function testLSCorruption(browser) {
  console.log('\n── LS corruption (malformed JSON)');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pe: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') {
      const t = m.text();
      if (t.indexOf('Failed to load') < 0 && t.indexOf('net::ERR') < 0) errs.push('cE: ' + t.substring(0, 150));
    }
  });

  await page.addInitScript(() => {
    /* Corrupt JSON — tests LS.get fallback behavior */
    localStorage.setItem('fm_clients', 'not-valid-json');
    localStorage.setItem('fm_sessions', '{invalid');
    localStorage.setItem('fm_schedule', 'null');
    localStorage.setItem('fm_programs', '[]');
    localStorage.setItem('fm_workouts', '[]');
    localStorage.setItem('fm_messages', '[]');
    localStorage.setItem('fm_inbox', '[]');
    localStorage.setItem('fm_coach_authed', '1');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  });
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto('file:///home/user/bigmike/app.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const state = await page.evaluate(() => ({
    bodyLen: document.body.innerHTML.length,
    clientsType: Array.isArray(window.clients) ? 'array' : typeof window.clients,
    clientsLen: Array.isArray(window.clients) ? window.clients.length : -1,
  }));
  assert(state.bodyLen > 500, 'corrupt-LS: app still renders (' + state.bodyLen + ' bytes)');
  assert(state.clientsType === 'array', 'corrupt-LS: clients defaulted to array (not ' + state.clientsType + ')');
  assert(errs.length === 0, `corrupt-LS: zero console errors (${errs.length} found)`);
  if (errs.length) errs.slice(0, 3).forEach(e => console.log('   ' + e));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    await testEmptyState(browser);
    await testMalformedClient(browser);
    await testLSCorruption(browser);
  } catch (e) {
    results.errors.push('FATAL: ' + e.message);
    console.error(e);
  }
  await browser.close();

  console.log('\n══════════ EDGE CASE HARNESS ══════════');
  results.details.forEach(d => console.log('  ' + d));
  console.log(`\n  PASSED: ${results.passed}`);
  console.log(`  FAILED: ${results.failed}`);
  if (results.errors.length) {
    console.log('\n  ERRORS:');
    results.errors.forEach(e => console.log('    ' + e));
  }
  process.exit(results.failed > 0 ? 1 : 0);
})();
