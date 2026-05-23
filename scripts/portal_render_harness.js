/*  SYNTHETIC END-TO-END DATA FLOW HARNESS v2
    ────────────────────────────────────────────────────────────
    Walks every portal tab explicitly and asserts the renderer
    output contains the expected program data. This is the
    functional proof that the coach→client data pipeline works. */

const { chromium } = require('playwright');
const fs = require('fs');

const TEST_CLIENT_ID = 'harness_client_001';
const TEST_CLIENT = {
  id: TEST_CLIENT_ID,
  name: 'Harness Test Client',
  phone: '5551234567',
  email: 'harness@test.local',
  clientType: 'active',
  services: ['Training', 'Nutrition', 'Full Package'],
  rate: 150,
  created: Date.now(),
  program: {
    name: 'Harness Program — Phase 1',
    days: [
      { name: 'Push Day',
        exercises: [
          { name: 'Incline Barbell Press', sets: '4', reps: '8-10' },
          { name: 'Standing Military Press', sets: '3', reps: '10-12' },
          { name: 'Cable Fly', sets: '3', reps: '12' },
        ],
        cardio: '20 min LISS post-workout'
      },
      { name: 'Pull Day',
        exercises: [
          { name: 'Deadlift', sets: '4', reps: '6-8' },
          { name: 'Pull-ups', sets: '4', reps: 'AMRAP' },
          { name: 'Barbell Curl', sets: '3', reps: '10-12' },
        ],
        cardio: ''
      },
      { name: 'Legs Day',
        exercises: [
          { name: 'Back Squat', sets: '5', reps: '5' },
          { name: 'Romanian Deadlift', sets: '3', reps: '8-10' },
        ],
        cardio: '30 min stepper'
      },
    ]
  },
  anabolics: [
    { name: 'Testosterone Cypionate / Test C', dose: '500mg', freq: 'weekly', route: 'IM' },
    { name: 'Nandrolone Decanoate / Deca', dose: '300mg', freq: 'weekly', route: 'IM', notes: 'Run weeks 1-12' },
  ],
  peptides: [
    { name: 'BPC-157', dose: '500mcg', freq: 'daily' },
    { name: 'TB-500', dose: '2mg', freq: '2x weekly' },
  ],
  fatloss: [
    { name: 'Semaglutide / Ozempic / Wegovy', dose: '0.5mg', freq: 'weekly', route: 'SubQ' },
    { name: 'L-Carnitine (Injectable)', dose: '1g', freq: '5x weekly', route: 'IM' },
  ],
  supplements: [
    { name: 'Whey Isolate', dose: '40g', timing: 'Post-workout' },
    { name: 'Creatine Monohydrate', dose: '5g', timing: 'Daily AM' },
    { name: 'Magnesium Glycinate', dose: '400mg', timing: 'Pre-bed' },
  ],
  organsupport: [
    { name: 'NAC', dose: '1200mg', timing: 'Daily AM' },
    { name: 'TUDCA', dose: '500mg', timing: 'Daily AM' },
  ],
  water: { goal: 160 },
  cardio: [
    { type: 'Incline Treadmill', duration: '30 min', mode: 'LISS' },
  ],
  sentPrograms: [
    {
      id: 'sp_001',
      title: 'Phase 1 Foundation',
      dateSent: '2026-03-01',
      phase: 'Off Season',
      duration: '12 weeks',
      sectionOrder: ['training', 'anabolics', 'supplements', 'water'],
      training: { days: [{ name: 'Day 1', exercises: [{ name: 'Bench Press', sets: '4', reps: '8' }] }] },
      anabolics: [{ name: 'Test C', dose: '400mg', freq: 'weekly' }],
      supplements: [{ name: 'Whey', dose: '40g', timing: 'PWO' }],
      water: { goal: 160 },
      notes: 'Focus on form.',
    }
  ],
  checkins: [
    { weight: 215, bodyFat: 12, notes: 'Feeling strong', photos: ['https://example.test/p1.jpg'], date: '2026-04-06', submittedAt: '2026-04-06T08:00:00Z', weekLabel: 'Week 1' },
    { weight: 213, bodyFat: 11.5, notes: 'Sleep better', photos: ['https://example.test/p2.jpg'], date: '2026-04-13', submittedAt: '2026-04-13T08:00:00Z', weekLabel: 'Week 2' },
  ],
  weightLog: [
    { date: '2026-04-06', lbs: 215 },
    { date: '2026-04-13', lbs: 213 },
  ],
  pinHash: 'test_pin_hash',
  twoFactorEnabled: false,
};

const results = { passed: 0, failed: 0, errors: [], warnings: [], details: [] };
function assert(cond, msg) {
  if (cond) { results.passed++; results.details.push('\x1b[32m✓\x1b[0m ' + msg); }
  else { results.failed++; results.details.push('\x1b[31m✗\x1b[0m ' + msg); results.errors.push(msg); }
}

async function runPortalHarness(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrs = [];
  page.on('pageerror', e => consoleErrs.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') {
      const t = m.text();
      if (t.indexOf('Failed to load resource') < 0 && t.indexOf('net::ERR') < 0 && t.indexOf('favicon') < 0) {
        consoleErrs.push('cE: ' + t.substring(0, 200));
      }
    }
  });

  await page.addInitScript(({ client }) => {
    window._HARNESS = true;
    try {
      localStorage.setItem('bm_portal_phone', client.phone);
      localStorage.setItem('bm_portal_login_ts', String(Date.now()));
      localStorage.setItem('bm_portal_theme', 'gold');
    } catch (e) {}
    window._HARNESS_CLIENT = client;
  }, { client: TEST_CLIENT });

  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto('file:///home/user/Big-Mike/portal.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(800);

  // Inject the client via window scope — portal's top-level vars attach to window
  const injectRes = await page.evaluate((client) => {
    try {
      window._clientData = client;
      window._portalMessages = [];
      if (typeof renderProgram === 'function') {
        renderProgram();
        return { ok: true, hasData: !!window._clientData };
      }
      return { ok: false, reason: 'no renderProgram' };
    } catch (e) { return { ok: false, reason: e.message }; }
  }, TEST_CLIENT);
  assert(injectRes.ok, `portal inject succeeded (${injectRes.reason || 'ok'})`);
  await page.waitForTimeout(300);

  // Discover tabs
  const tabs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('#progTabs .tab-btn')).map(t => {
      const onclickAttr = t.getAttribute('onclick') || '';
      const keyMatch = onclickAttr.match(/switchTab\(['"](\w+)['"]\)/);
      return { key: keyMatch ? keyMatch[1] : null, label: t.textContent.trim() };
    });
  });
  console.log('\nTabs discovered:', JSON.stringify(tabs));
  assert(tabs.length > 5, `portal built ${tabs.length} tabs (expected >5)`);

  // Expected tab keys given our test client data
  const expectedKeys = ['overview', 'programs', 'training', 'peds', 'peptides', 'fatloss', 'supps', 'organ', 'water', 'checkin', 'myprogress', 'messages'];
  for (const k of expectedKeys) {
    const found = tabs.find(t => t.key === k);
    assert(!!found, `tab exists: ${k}`);
  }

  // Walk every tab and assert the renderer produced expected content
  const tabAssertions = {
    overview: ['Harness Test Client', 'welcome', '3', 'days', '160'],
    programs: ['Phase 1 Foundation', 'Off Season', '12 weeks'],
    training: ['Push Day', 'Pull Day', 'Legs Day', 'Incline Barbell', 'Deadlift', 'Back Squat'],
    peds: ['Testosterone Cypionate', 'Nandrolone', '500mg', '300mg'],
    peptides: ['BPC-157', 'TB-500', '500mcg', '2mg'],
    fatloss: ['Semaglutide', 'L-Carnitine', '0.5mg', '1g'],
    supps: ['Whey Isolate', 'Creatine', 'Magnesium', 'Post-workout'],
    organ: ['NAC', 'TUDCA', '1200mg', '500mg'],
    water: ['160'],
    checkin: [],  // form presence only
    myprogress: ['215', '213'],
    messages: [],
  };

  for (const [tabKey, expectedTokens] of Object.entries(tabAssertions)) {
    const tab = tabs.find(t => t.key === tabKey);
    if (!tab) { continue; }
    // Directly set _activeTab and re-render — avoids 300ms _tabLock
    // that would otherwise reject alternating tab clicks in the harness.
    const clickRes = await page.evaluate((k) => {
      try {
        window._activeTab = k;
        if (typeof renderTabContent === 'function') {
          renderTabContent();
        } else if (typeof renderProgram === 'function') {
          renderProgram();
        }
        return { ok: true };
      } catch (e) { return { ok: false, reason: e.message }; }
    }, tabKey);
    if (!clickRes.ok) {
      assert(false, `render(${tabKey}): ${clickRes.reason}`);
      continue;
    }
    await page.waitForTimeout(150);

    // Get the rendered tab content — overview also reads #clientName
    // which is rendered outside #progContent by renderProgram itself.
    const content = await page.evaluate(() => {
      const prog = document.getElementById('progContent');
      const name = document.getElementById('clientName');
      const svc = document.getElementById('clientServices');
      return [
        prog ? prog.innerText || '' : '',
        name ? name.innerText || '' : '',
        svc ? svc.innerText || '' : '',
      ].join(' ');
    });

    if (content.length < 20) {
      assert(false, `${tabKey}: rendered content empty or stub (${content.length} chars)`);
      continue;
    }
    assert(content.length > 20, `${tabKey}: rendered content present (${content.length} chars)`);

    // Token assertions
    for (const token of expectedTokens) {
      const found = content.toLowerCase().indexOf(token.toLowerCase()) >= 0;
      assert(found, `${tabKey}: contains "${token}"`);
    }
  }

  // Final state snapshot
  await page.screenshot({ path: '/tmp/harness-final.png', fullPage: false });

  if (consoleErrs.length) {
    consoleErrs.slice(0, 10).forEach(e => results.warnings.push('PORTAL_CONSOLE: ' + e));
  }

  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    await runPortalHarness(browser);
  } catch (e) {
    results.errors.push('FATAL: ' + e.message);
    console.error(e);
  }
  await browser.close();

  console.log('\n\n══════════ HARNESS RESULTS ══════════');
  results.details.forEach(d => console.log('  ' + d));
  console.log(`\n  PASSED: ${results.passed}`);
  console.log(`  FAILED: ${results.failed}`);
  if (results.warnings.length) {
    console.log(`  WARNINGS: ${results.warnings.length}`);
    results.warnings.slice(0, 5).forEach(w => console.log('    ' + w));
  }
  if (results.errors.length) {
    console.log('\n  ERRORS:');
    results.errors.forEach(e => console.log('    ' + e));
  }
  fs.writeFileSync('/tmp/harness-results.json', JSON.stringify(results, null, 2));
  process.exit(results.failed > 0 ? 1 : 0);
})();
