// Mock-auth render of the CLIENT PORTAL interior for visual assessment (Wave 5).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const CLIENT = {
  id: "vas_client", name: "Marcus Vega", phone: "5551234567", email: "m@test.local",
  clientType: "active", services: ["Training","Nutrition","Full Package"], rate: 150, created: Date.now(),
  program: { name: "Off-Season Mass — Phase 2", days: [
    { name: "Push", exercises:[{name:"Incline Barbell Press",sets:"4",reps:"8-10"},{name:"Standing Military Press",sets:"3",reps:"10-12"},{name:"Weighted Dip",sets:"3",reps:"12"}], cardio:"15 min LISS" },
    { name: "Pull", exercises:[{name:"Deadlift",sets:"4",reps:"5"},{name:"Weighted Pull-up",sets:"4",reps:"AMRAP"},{name:"Barbell Row",sets:"3",reps:"10"}], cardio:"" },
    { name: "Legs", exercises:[{name:"Back Squat",sets:"5",reps:"5"},{name:"RDL",sets:"3",reps:"8-10"},{name:"Leg Press",sets:"3",reps:"15"}], cardio:"20 min stepper" },
  ]},
  anabolics:[{name:"Testosterone Cypionate / Test C",dose:"500mg",freq:"weekly",route:"IM"},{name:"Nandrolone Decanoate / Deca",dose:"300mg",freq:"weekly",route:"IM"}],
  peptides:[{name:"BPC-157",dose:"500mcg",freq:"daily"},{name:"CJC-1295 / Ipamorelin",dose:"300mcg",freq:"nightly"}],
  fatloss:[{name:"Semaglutide / Ozempic / Wegovy",dose:"0.5mg",freq:"weekly",route:"SubQ"}],
  supplements:[{name:"Whey Isolate",dose:"40g",timing:"Post-workout"},{name:"Creatine Monohydrate",dose:"5g",timing:"Daily"},{name:"Magnesium Glycinate",dose:"400mg",timing:"Pre-bed"}],
  organsupport:[{name:"NAC",dose:"1200mg",timing:"AM"},{name:"TUDCA",dose:"500mg",timing:"AM"}],
  water:{ goal:180, logs:{} }, cardio:[{type:"Incline Treadmill",duration:"30 min",mode:"LISS"}],
  weightLog:[{date:"2026-05-01",lbs:212},{date:"2026-05-10",lbs:214},{date:"2026-05-20",lbs:215}],
  checkins:[], pinHash:"x", twoFactorEnabled:false,
};
const TABS = ["overview","training","supps","water","myprogress"];

(async () => {
  const b = await chromium.launch({ args:["--no-sandbox"] });
  for (const vp of [{tag:"m390",w:390,h:844,dpr:2},{tag:"d1440",w:1440,h:900,dpr:1}]) {
    const ctx = await b.newContext({ viewport:{width:vp.w,height:vp.h}, deviceScaleFactor:vp.dpr });
    const page = await ctx.newPage();
    const errs=[]; page.on("pageerror",e=>errs.push(e.message));
    await page.addInitScript((c)=>{ try{localStorage.setItem('bm_portal_phone',c.phone);localStorage.setItem('bm_portal_login_ts',String(Date.now()));localStorage.setItem('bm_portal_theme','gold');}catch(e){} }, CLIENT);
    await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await page.goto("file:///home/user/Big-Mike/portal.html",{waitUntil:"load",timeout:30000});
    await page.waitForTimeout(600);
    const inj = await page.evaluate((c)=>{ try{ window._clientData=c; window._portalMessages=[]; if(typeof renderProgram==='function'){renderProgram();} if(typeof showSection==='function'){showSection('program');} return (typeof renderProgram==='function')?'ok':'no renderProgram'; }catch(e){return e.message;} }, CLIENT);
    await page.waitForTimeout(400);
    for (const t of TABS) {
      try { await page.evaluate((k)=>{ if(typeof switchTab==='function') switchTab(k); if(typeof showSection==='function') showSection('program'); }, t); await page.waitForTimeout(450);
        await page.screenshot({ path:`/tmp/portal-${vp.tag}-${t}.png` }); } catch(e){}
    }
    console.log(vp.tag, "inject:", inj, "| pageerrors:", errs.length ? errs[0] : "none");
    await ctx.close();
  }
  await b.close();
})();
