/*  portal-shots.js
    ─────────────────────────────────────────────────────────────
    Coach (app.html) + Client (portal.html) visual audit.
    Boots with seeded clients so the portal actually has content
    to render, then walks through each major tab and snapshots
    at 375 + 1200. */

const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  const seedClients = [];
  for (let i = 0; i < 12; i++) {
    seedClients.push({
      id: 'shot_c' + i,
      name: ['Marcus Reynolds','Sarah Chen','Alex Morrison','Jordan Pierce','Emma Walsh','Tyler Brooks','Nina Patel','Chris Landry','Ava Rhodes','Kai Brennan','Sophie Tran','Leo Chambers'][i],
      phone: '555' + String(1000 + i * 11).padStart(7,'0'),
      rate: 180 + i * 20,
      clientType: i < 9 ? 'active' : 'Prospect',
      services: ['Training', i % 2 ? 'Nutrition' : 'Posing'],
      created: Date.now() - i * 86400000 * 3,
      anabolics: [{ name: 'Testosterone Cypionate / Test C', dose: '500mg', freq: 'weekly' }],
      supplements: [{ name: 'Whey Isolate', dose: '40g', timing: 'PWO' }],
      water: { goal: 160 },
      program: { days: [{ name: 'Push', exercises: [{name:'Bench',sets:'4',reps:'8'}] }] },
    });
  }
  const seedSessions = [];
  for (let i = 0; i < 8; i++) {
    seedSessions.push({ id: 'sess_' + i, clientId: 'shot_c' + (i % 12), clientName: seedClients[i % 12].name, date: new Date(Date.now() - i * 86400000).toISOString().slice(0,10), type: 'Training', rate: '200', duration: 60, status: 'completed', exercises: [] });
  }
  const seedSchedule = [];
  for (let i = 0; i < 6; i++) {
    seedSchedule.push({ id:'sch_'+i, clientId: 'shot_c' + i, clientName: seedClients[i].name, date: new Date(Date.now() + i * 86400000).toISOString().slice(0,10), time: '09:00', type: 'Training', rate: '200', status: 'pending' });
  }

  const COACH_TABS = ['home','clients','schedule','nutrition','inbox','messages','settings'];
  const PORTAL_TABS = ['overview','training','nutrition','supps','water','peds','myprogress','checkin','messages'];

  for (const w of [375, 1200]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: w === 375 ? 812 : 900 },
      deviceScaleFactor: w === 375 ? 3 : 2,
      isMobile: w === 375,
      hasTouch: w === 375,
    });

    // COACH
    const coach = await ctx.newPage();
    coach.on('pageerror', e => console.warn('coach err', e.message));
    await coach.addInitScript(({c,s,sch}) => {
      localStorage.setItem('fm_clients', JSON.stringify(c));
      localStorage.setItem('fm_sessions', JSON.stringify(s));
      localStorage.setItem('fm_schedule', JSON.stringify(sch));
      localStorage.setItem('fm_unlocked','true');
      sessionStorage.setItem('fm_unlocked','true');
      localStorage.setItem('fm_coach_authed','1');
      localStorage.setItem('fm_supabase_auth', JSON.stringify({ authed: true, ts: Date.now() }));
      Object.defineProperty(navigator,'onLine',{value:false,configurable:true});
    }, { c: seedClients, s: seedSessions, sch: seedSchedule });
    await coach.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    try {
      await coach.goto('file:///home/user/Big-Mike/app.html', { waitUntil: 'load', timeout: 20000 });
    } catch(e) { console.warn('coach load', e.message); }
    await coach.waitForTimeout(1200);
    // Force app visible regardless of auth screen
    await coach.evaluate(() => {
      const auth = document.getElementById('authScreen'); if (auth) auth.remove();
      const lock = document.getElementById('lockScreen'); if (lock) lock.remove();
      const app = document.getElementById('app'); if (app) app.style.display = '';
      try { window.render && window.render(); } catch(e){}
    });
    for (const tab of COACH_TABS) {
      await coach.evaluate((t) => { try { go(t); } catch(e){} }, tab);
      await coach.waitForTimeout(350);
      await coach.screenshot({ path: `/tmp/vs/coach-${tab}-${w}.png` });
      console.log('coach', tab, w);
    }
    await coach.close();

    // CLIENT PORTAL
    const portal = await ctx.newPage();
    portal.on('pageerror', e => console.warn('portal err', e.message));
    const premium = {
      id: 'p_premium', name: 'Marcus Reynolds', phone: '5551000111',
      services: ['Training','Nutrition','Full Package'], rate: 300,
      program: { days: [
        { name: 'Push', exercises: [{ name:'Bench Press', sets:'4', reps:'8'},{ name:'OHP', sets:'3', reps:'10'}], cardio:'20 min LISS post' },
        { name: 'Pull', exercises: [{ name:'Deadlift', sets:'4', reps:'6'},{ name:'Pull-ups', sets:'4', reps:'AMRAP'}] },
      ]},
      cardio: { prescriptions: [{ type:'Incline Treadmill', duration:'30 min', mode:'LISS'}] },
      anabolics: [{ name:'Testosterone Cypionate / Test C', dose:'500mg', freq:'weekly'}],
      peptides: [{ name:'BPC-157', dose:'500mcg', freq:'daily'}],
      supplements: [{ name:'Whey Isolate', dose:'40g', timing:'PWO'},{ name:'Creatine', dose:'5g', timing:'AM'}],
      water: { goal: 160 },
      sentPrograms: [{ id:'sp1', title:'Phase 1 Foundation', dateSent:'2026-04-01', phase:'Off Season', duration:'12 weeks' }],
      checkins: [], pinHash:'x', twoFactorEnabled:false,
    };
    await portal.addInitScript(({c}) => {
      localStorage.setItem('bm_portal_phone', c.phone);
      localStorage.setItem('bm_portal_login_ts', String(Date.now()));
    }, { c: premium });
    await portal.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    try {
      await portal.goto('file:///home/user/Big-Mike/portal.html', { waitUntil: 'load', timeout: 15000 });
    } catch(e) { console.warn('portal load', e.message); }
    await portal.waitForTimeout(800);
    await portal.evaluate((c) => {
      window._clientData = c;
      window._portalMessages = [];
      try {
        const login = document.getElementById('loginSection'); if (login) login.style.display = 'none';
        const app = document.getElementById('appSection') || document.getElementById('progSection');
        if (app) app.style.display = '';
        window.renderProgram && window.renderProgram();
      } catch(e) {}
    }, premium);
    // Snapshot login first
    await portal.evaluate(() => { showSection && showSection('login'); });
    await portal.waitForTimeout(200);
    await portal.screenshot({ path: `/tmp/vs/portal-login-${w}.png` });
    console.log('portal login', w);
    // Then walk the tabs
    await portal.evaluate((c) => { window._clientData = c; renderProgram && renderProgram(); }, premium);
    await portal.waitForTimeout(300);
    for (const tab of PORTAL_TABS) {
      await portal.evaluate(t => { try { window._activeTab = t; renderTabContent && renderTabContent(); } catch(e){} }, tab);
      await portal.waitForTimeout(250);
      await portal.screenshot({ path: `/tmp/vs/portal-${tab}-${w}.png` });
      console.log('portal', tab, w);
    }
    await portal.close();

    await ctx.close();
  }
  await browser.close();
})();
