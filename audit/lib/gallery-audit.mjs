// Gallery visual audit: full grid (PC + mobile) + lightbox before/after.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ args:["--no-sandbox"] });
  for (const vp of [{tag:"d1440",w:1440,h:1000,dpr:1},{tag:"m390",w:390,h:844,dpr:2}]) {
    const ctx = await b.newContext({ viewport:{width:vp.w,height:vp.h}, deviceScaleFactor:vp.dpr });
    await ctx.addInitScript(()=>{try{localStorage.setItem('bm_revealed','1');}catch(e){}});
    const p = await ctx.newPage();
    await p.goto("http://localhost:8099/gallery.html",{waitUntil:"networkidle",timeout:30000});
    await p.evaluate(()=>{ document.getElementById('brandReveal')?.remove(); document.body.style.overflow='';
      document.querySelectorAll('.reveal,.s-head,.gal-item').forEach(e=>{e.style.opacity='1';e.style.transform='none';}); });
    // trigger lazy images
    await p.evaluate(async()=>{ await new Promise(r=>{let y=0;const t=setInterval(()=>{scrollTo(0,y);y+=700;if(y>document.body.scrollHeight){clearInterval(t);scrollTo(0,0);r();}},40);}); });
    await p.waitForTimeout(1200);
    await p.screenshot({ path:`/tmp/gal-${vp.tag}-grid.png`, fullPage:true });
    // lightbox before/after on the banner item (now first competition shot)
    if (vp.tag==="d1440") {
      await p.evaluate(()=>{ const items=[...document.querySelectorAll('.gal-item')]; const t=items.find(i=>i.querySelector('img')?.src.includes('romania-stage')); if(t) t.click(); });
      await p.waitForTimeout(700);
      await p.screenshot({ path:`/tmp/gal-lightbox.png` });
    }
    console.log("shot", vp.tag);
    await ctx.close();
  }
  await b.close();
})();
