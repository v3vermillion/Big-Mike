// VAS baseline scan: overflow + console + axe a11y across pages × key viewports.
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");

const BASE = "http://localhost:8099/";
const PAGES = ["index","about","services","gallery","results","contact","book","platform","onboard"];
const VPS = [{tag:"m390",w:390,h:844,dpr:2,touch:true},{tag:"d1440",w:1440,h:900,dpr:1,touch:false}];
const prep = () => { try{localStorage.setItem("bm_revealed","1");}catch(e){}; };
const reveal = () => { document.getElementById("brandReveal")?.remove(); document.body.style.overflow="";
  document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale,.s-head,[data-reveal],.section,[style*="opacity"]').forEach(e=>{e.style.opacity="1";e.style.transform="none";e.style.filter="none";}); };
const overflow = () => {
  // Decorative full-bleed layers intentionally exceed the viewport (cover effect) — excluded (matches v1 visual_audit exclusions).
  const DECOR = /(^|\s)(hero-bg|hero-orb\d*|hero-leak|hero-rays|hero-chroma|cta-bg|cta-watermark|cta-rays|bg-ghost|bg-orb\d*|bg-photo|section-ambient-img|grain|vignette|atmos|film-grain)(\s|$)/;
  const vw=innerWidth, off=[]; for(const el of document.querySelectorAll("body *")){
  if(el.closest("[aria-hidden=true]"))continue;
  if(typeof el.className==="string"&&DECOR.test(el.className))continue;
  const r=el.getBoundingClientRect(); if(r.width===0||r.height===0)continue;
  const o=Math.round(r.right-vw); if(o>2){const s=el.tagName.toLowerCase()+(el.id?"#"+el.id:"")+(typeof el.className==="string"&&el.className?"."+el.className.trim().split(/\s+/).slice(0,2).join("."):""); off.push({s,o});}}
  const seen=new Set(),t=[]; off.sort((a,b)=>b.o-a.o); for(const x of off){if(seen.has(x.s))continue;seen.add(x.s);t.push(x);if(t.length>=4)break;} return t; };

(async()=>{
  mkdirSync("/home/user/Big-Mike/audit/reports/scan",{recursive:true});
  const b=await chromium.launch({args:["--no-sandbox"]});
  const out={};
  for(const vp of VPS){
    const ctx=await b.newContext({viewport:{width:vp.w,height:vp.h},deviceScaleFactor:vp.dpr,isMobile:vp.touch,hasTouch:vp.touch});
    await ctx.addInitScript(prep);
    for(const pg of PAGES){
      const errs=[]; const page=await ctx.newPage();
      page.on("console",m=>{if(m.type()==="error"){const t=m.text();if(!/favicon|net::ERR|Failed to load resource/i.test(t))errs.push(t.slice(0,120));}});
      page.on("pageerror",e=>errs.push("PAGEERR:"+e.message.slice(0,120)));
      let ov=[], ax=[];
      try{
        await page.goto(BASE+pg+".html",{waitUntil:"networkidle",timeout:25000});
        await page.evaluate(reveal); await page.waitForTimeout(300);
        ov=await page.evaluate(overflow);
        const r=await new AxeBuilder({page}).options({runOnly:["wcag2a","wcag2aa"]}).analyze();
        ax=r.violations.filter(v=>v.impact==="critical"||v.impact==="serious").map(v=>({id:v.id,impact:v.impact,n:v.nodes.length}));
      }catch(e){ errs.push("SCANERR:"+e.message.split("\n")[0]); }
      (out[pg]=out[pg]||{})[vp.tag]={overflow:ov,console:[...new Set(errs)],axe:ax};
      await page.close();
    }
    await ctx.close();
  }
  await b.close();
  writeFileSync("/home/user/Big-Mike/audit/reports/scan/baseline.json",JSON.stringify(out,null,2));
  // summary
  console.log("PAGE        VP     OVERFLOW  CONSOLE  AXE(crit/serious)");
  for(const pg of PAGES)for(const vp of VPS){const r=out[pg][vp.tag];
    console.log(pg.padEnd(11),vp.tag.padEnd(6),String(r.overflow.length).padEnd(9),String(r.console.length).padEnd(8),r.axe.map(a=>a.id+"("+a.n+")").join(",")||"-");}
  console.log("\nAXE detail:");
  const seen=new Set();
  for(const pg of PAGES)for(const vp of VPS)for(const a of out[pg][vp.tag].axe){const k=a.id;if(seen.has(k))continue;seen.add(k);console.log("  "+a.impact+" "+a.id);}
  console.log("\nCONSOLE detail:");
  const cseen=new Set();
  for(const pg of PAGES)for(const vp of VPS)for(const c of out[pg][vp.tag].console){if(cseen.has(c))continue;cseen.add(c);console.log("  "+pg+": "+c);}
  console.log("\nOVERFLOW detail:");
  for(const pg of PAGES)for(const vp of VPS){const o=out[pg][vp.tag].overflow;if(o.length)console.log("  "+pg+"@"+vp.tag+": "+o.map(x=>x.s+"(+"+x.o+")").join(", "));}
})();
