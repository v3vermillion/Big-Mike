/*  COACH WIZARD → CLIENT RECORD HARNESS
    ─────────────────────────────────────────────────────────────
    Proves that when Mike runs the program wizard and clicks
    "Send to Client", _wizMergeToClient writes every section to
    the client record so the portal will pick it up.

    Method:
    1. Load app.html with a seeded test client
    2. Construct a synthetic _wizardData with every section type
    3. Call _wizMergeToClient(_wizardData) directly
    4. Read the client record back from clients[] and assert every
       expected field is populated                                */

const { chromium } = require('playwright');

const TEST_CLIENT_ID = 'wizclient_001';
const SEED_CLIENT = {
  id: TEST_CLIENT_ID,
  name: 'Wizard Target',
  phone: '5559998888',
  clientType: 'active',
  services: ['Training'],
  rate: 150,
  created: Date.now(),
};

// Synthetic wizard output — the shape _wizMergeToClient expects
const WIZ_DATA = {
  id: 'wiz_program_001',
  clientId: TEST_CLIENT_ID,
  clientName: 'Wizard Target',
  name: 'Phase 2 Off-Season',
  phase: 'Off Season',
  duration: '12 weeks',
  status: 'sent',
  dateSent: new Date().toISOString(),
  sections: ['training','nutrition','anabolics','peptides','fatloss','supplements','organsupport','water','protocol'],
  training: {
    days: [
      { name: 'Push', exercises: [{ name: 'Bench', sets: '4', reps: '8' }], cardio: '' },
      { name: 'Pull', exercises: [{ name: 'Row', sets: '4', reps: '8' }], cardio: '' },
    ]
  },
  nutrition: {
    meals: [
      { name: 'Meal 1', time: '7am', foods: [{ name: 'Oats', qty: '80', unit: 'g' }] },
      { name: 'Meal 2', time: '10am', foods: [{ name: 'Chicken', qty: '200', unit: 'g' }] },
    ],
    targets: { cal: 3200, p: 250, c: 350, f: 90 }
  },
  anabolics: { items: [{ name: 'Test E', dose: '500mg', freq: 'weekly', route: 'IM' }] },
  peptides:  { items: [{ name: 'BPC-157', dose: '500mcg', freq: 'daily' }] },
  fatloss:   { items: [{ name: 'Semaglutide', dose: '1mg', freq: 'weekly' }] },
  supplements: { items: [{ name: 'Whey', dose: '40g', timing: 'PWO' }] },
  organsupport: { items: [{ name: 'NAC', dose: '1200mg', timing: 'AM' }] },
  water: { goal: 180 },
  cardio: [{ type: 'Treadmill', duration: '30min', mode: 'LISS' }],
  protocolNotes: 'Focus on form and sleep quality.',
};

const results = { passed: 0, failed: 0, errors: [], details: [] };
function assert(cond, msg) {
  if (cond) { results.passed++; results.details.push('\x1b[32m✓\x1b[0m ' + msg); }
  else { results.failed++; results.details.push('\x1b[31m✗\x1b[0m ' + msg); results.errors.push(msg); }
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pe: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') {
      const t = m.text();
      if (t.indexOf('Failed to load resource') < 0 && t.indexOf('net::ERR') < 0) errs.push('cE: ' + t.substring(0, 200));
    }
  });

  await page.addInitScript(({client}) => {
    try {
      localStorage.setItem('fm_clients', JSON.stringify([client]));
      localStorage.setItem('fm_supabase_auth', JSON.stringify({authed:true,ts:Date.now()}));
      localStorage.setItem('fm_coach_authed', '1');
    } catch(e) { console.error('seed:', e); }
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  }, { client: SEED_CLIENT });

  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Call _wizMergeToClient directly and read client back
  const result = await page.evaluate((wiz) => {
    try {
      if (typeof _wizMergeToClient !== 'function') return { ok: false, reason: 'no _wizMergeToClient' };
      if (typeof clients === 'undefined' || !clients.length) return { ok: false, reason: 'no clients in scope' };
      _wizMergeToClient(wiz);
      const c = clients.find(x => x.id === wiz.clientId);
      return {
        ok: true,
        client: c ? {
          hasProgram: !!c.program,
          programDays: c.program?.days?.length || 0,
          hasAnabolics: Array.isArray(c.anabolics) && c.anabolics.length,
          hasPeptides: Array.isArray(c.peptides) && c.peptides.length,
          hasFatloss: Array.isArray(c.fatloss) && c.fatloss.length,
          hasSupplements: Array.isArray(c.supplements) && c.supplements.length,
          hasOrgansupport: Array.isArray(c.organsupport) && c.organsupport.length,
          waterGoal: c.water?.goal,
          hasCardio: Array.isArray(c.cardio) && c.cardio.length,
          sentProgramsCount: c.sentPrograms?.length || 0,
          sentProgramTitle: c.sentPrograms?.[0]?.title,
          sentProgramSections: c.sentPrograms?.[0]?.sectionOrder,
          firstAnabolicName: c.anabolics?.[0]?.name,
          firstSupplementName: c.supplements?.[0]?.name,
        } : null,
        mealPlansCreated: (window.mealPlans || []).length,
        firstMealPlanName: (window.mealPlans || [])[0]?.name,
      };
    } catch (e) { return { ok: false, reason: e.message, stack: e.stack }; }
  }, WIZ_DATA);

  console.log('\nMerge result:', JSON.stringify(result, null, 2));

  assert(result.ok, `_wizMergeToClient executed (${result.reason || 'ok'})`);
  if (result.ok && result.client) {
    const c = result.client;
    assert(c.hasProgram === true, 'client.program populated');
    assert(c.programDays === 2, 'client.program.days length 2');
    assert(c.hasAnabolics, 'client.anabolics populated');
    assert(c.hasPeptides, 'client.peptides populated');
    assert(c.hasFatloss, 'client.fatloss populated');
    assert(c.hasSupplements, 'client.supplements populated');
    assert(c.hasOrgansupport, 'client.organsupport populated');
    assert(c.waterGoal === 180, 'client.water.goal = 180');
    assert(c.hasCardio, 'client.cardio populated');
    assert(c.sentProgramsCount === 1, 'client.sentPrograms has 1 entry');
    assert(c.sentProgramTitle === 'Phase 2 Off-Season', 'sentProgram title matches');
    assert(Array.isArray(c.sentProgramSections) && c.sentProgramSections.length === 9, 'sentProgram sectionOrder has 9 entries');
    assert(c.firstAnabolicName === 'Test E', 'first anabolic name preserved');
    assert(c.firstSupplementName === 'Whey', 'first supplement name preserved');
    assert(result.mealPlansCreated === 1, 'meal plan created from nutrition');
    assert(result.firstMealPlanName === 'Phase 2 Off-Season', 'meal plan name matches program');
  }

  // Verify persisted to LS
  const ls = await page.evaluate(() => {
    const arr = JSON.parse(localStorage.getItem('fm_clients') || '[]');
    const c = arr[0];
    return {
      hasProgram: !!c?.program,
      sentProgramsLen: c?.sentPrograms?.length,
      anabolicsLen: c?.anabolics?.length,
    };
  });
  assert(ls.hasProgram, 'LS persisted program field');
  assert(ls.sentProgramsLen === 1, 'LS persisted sentPrograms');
  assert(ls.anabolicsLen === 1, 'LS persisted anabolics');

  if (errs.length) {
    console.log('\nConsole errors:', errs);
  }
  assert(errs.length === 0, `zero console errors during merge (${errs.length} found)`);

  await browser.close();

  console.log('\n══════════ WIZARD MERGE HARNESS ══════════');
  results.details.forEach(d => console.log('  ' + d));
  console.log(`\n  PASSED: ${results.passed}`);
  console.log(`  FAILED: ${results.failed}`);
  if (results.errors.length) {
    console.log('\n  ERRORS:');
    results.errors.forEach(e => console.log('    ' + e));
  }
  process.exit(results.failed > 0 ? 1 : 0);
})();
