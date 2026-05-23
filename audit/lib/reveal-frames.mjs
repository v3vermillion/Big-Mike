// Capture the brand-reveal (loading) animation every 0.2s for visual audit.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const W = parseInt(process.argv[2]||"390",10), H = parseInt(process.argv[3]||"844",10);
const FRAMES = parseInt(process.argv[4]||"40",10);
const DIR = "/tmp/reveal";

(async () => {
  mkdirSync(DIR, { recursive: true });
  const b = await chromium.launch({ args:["--no-sandbox"] });
  // fresh context — do NOT set bm_revealed, so the reveal plays
  const ctx = await b.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:1 });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8099/index.html", { waitUntil:"domcontentloaded", timeout:20000 });
  const t0 = Date.now();
  for (let i=0;i<FRAMES;i++){
    const target = i*200;
    const wait = target - (Date.now()-t0);
    if (wait>0) await p.waitForTimeout(wait);
    const ms = String(Date.now()-t0).padStart(4,"0");
    await p.screenshot({ path:`${DIR}/f${String(i).padStart(2,"0")}-${ms}ms.png` });
  }
  console.log("captured", FRAMES, "frames @"+W+"x"+H, "->", DIR);
  await b.close();
})();
