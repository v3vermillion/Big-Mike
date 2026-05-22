# scripts/

Build-time helpers and self-verification harnesses that keep the
static site honest before every deploy.

## visual_audit.js

**Run:** `NODE_PATH=/opt/node22/lib/node_modules node scripts/visual_audit.js`

Opens every public HTML page (`index`, `about`, `services`, `results`,
`platform`, `gallery`, `contact`) in Playwright at five viewports
(iPhone 393, iPhone SE 375, narrow phone 320, iPad 820, desktop 1440)
and runs four automated quality checks on each combination:

1. **Overflow** — any element whose bounding box extends past the
   viewport edge. Excludes decorative background layers (`.hero-bg`,
   `.hero-orb*`, `.cta-watermark`, etc.), honeypot inputs positioned
   at `left:-9999`, and elements with `aria-hidden="true"`.

2. **Centering** — every element in the "should-center" list
   (`.hero h1`, `.hero-scroll`, `.s-head`, `.cta-inner`, `.page-close`,
   `.footer-mark`, etc.) must sit within 2px of viewport center.
   Catches flex/grid layout math bugs like the one where `::before`
   letter-spacing pushed the hero arrow 12px off-center on iPhone.

3. **Button accessibility** — every `<button>` / `a.btn` /
   `a.btn-p` / `a.btn-s` / `a.mm-cta` / `a.nav-cta` must have either
   visible text content or an `aria-label`. Catches icon-only buttons
   that ship without a screen-reader label.

4. **Console errors** — any pageerror or console.error that isn't
   a network/favicon/CSP noise is a ship blocker.

Exit code 1 on any ERROR finding, 0 otherwise. Treat WARN as a
discussion item. Run before every commit that touches CSS or HTML.

## share-card-template.html

Source for `img/platform-social-share.png`. 1200x630 landscape card
with Mike's stage photo on the left, metallic-gold `BIG MIKE ELY`
headline on the right, credentials row, and URL pill. Rendered via
Playwright at `deviceScaleFactor:2` to produce the retina PNG.

**Regenerate:**
```sh
NODE_PATH=/opt/node22/lib/node_modules node -e "
const {chromium} = require('playwright');
(async()=>{
  const b = await chromium.launch({args:['--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:1200,height:630},deviceScaleFactor:2});
  const p = await ctx.newPage();
  await p.goto('file://'+process.cwd()+'/scripts/share-card-template.html',{waitUntil:'networkidle',timeout:30000});
  await p.waitForTimeout(2500);
  await p.screenshot({path:'img/platform-social-share.png',type:'png'});
  await b.close();
})();
"
```

Edit the template to change the card design. The Google Fonts
`@import` inside the template loads Cinzel from the network; if
offline, the fallback chain resolves to Georgia (acceptable).

## Companion external harnesses (in `/tmp/` during dev)

These should be copied into `scripts/` when time permits. They cover
logic paths the visual audit cannot reach:

- `harness2.js` — portal render walk. Stubs a test client into the
  portal's `_clientData`, walks every tab via `switchTab`, asserts
  each renderer's output contains the expected program data. 63
  assertions across 12 tabs.

- `coach_wizard_harness.js` — coach-side program merge. Constructs
  a synthetic `_wizardData` with every section type, calls
  `_wizMergeToClient()` directly, reads the client record back from
  the `clients[]` array AND from localStorage, asserts every field
  was merged correctly. 21 assertions.

- `edge_harness.js` — adversarial boot conditions. Tests empty
  client list, malformed client (missing fields), corrupted
  localStorage JSON. Each scenario must boot the coach app with
  zero console errors. 9 assertions.

- `handler_audit.js` — scans every `on*=` attribute across 12 HTML
  files, extracts function-name references, cross-checks against
  function definitions in the script bundles. 990 handlers scanned
  in the current build; 0 orphans.

- `lock_audit2.js` — focused rapid-tap/double-submit guard check.
  11 critical mutation-side-effect functions checked for a lock
  variable, modal confirmation, or inner-helper inheritance. All
  11 currently guarded.

The full suite reports **128 functional + 35 visual = 163 assertions
per run**, all passing on the current build.
