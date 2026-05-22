# Big Mike Ely Coaching Lab - Development Instructions

## CRITICAL: Read This First
This is a birthday gift coaching platform app for IFBB Pro Big Mike Ely. It is deeply personal to the developer. **Quality must be absolute perfection** - zero bugs, zero errors when Mike opens and uses it.

## Architecture
- **Single-file vanilla JS SPA**: `/home/user/bigmike/index.html` (~3700 lines)
- No framework - pure functions returning HTML strings, swapped via innerHTML
- localStorage for persistence with optional Supabase cloud sync
- Navigation: `go(tab)`, `push(view, data)`, `pop()` with navStack
- PWA with manifest.json, service worker, canvas-generated theme icons
- Branch: `claude/refactor-programs-builder-TgMWi`

## Key Data Structures
- `clients` - array of client objects (stored in localStorage as `fm_clients`)
- `sessions` - session logs with exercises, sets, rates
- `schedule` - scheduled sessions with reminders
- `mealPlans` - meal plans with foods referencing FOOD_DB by index
- `_programs` - program builder data (sections, client assignment)
- `_workouts` - workout templates with exercises and cardio
- Client fields: `anabolics[]`, `peptides[]`, `fatloss[]`, `supplements[]`, `water{}`, `program{}`

## Themes
- Default: Crimson (`LS.get("theme","crimson")`)
- CSS variables switch via `body.theme-crimson` class
- `var(--goldGrad)` and `var(--acc)` are theme-aware
- Dynamic canvas icons generated for PWA home screen

## Birthday System
- `_bdayExpiry=1773936000000` - hard deadline ~March 19, 2026 16:00 UTC
- Gift wrap + popup auto-disappears after this timestamp
- DO NOT modify the birthday message text - it's finalized

## Program Builder
- Programs have sections: training, nutrition, anabolics, peptides, fatloss, supplements, water, protocol
- Each section delegates to a renderer function
- CRITICAL PATTERN: `renderProgramBuilder()` must check `_editWorkout` and `_editMealPlan` BEFORE rendering sections, otherwise sub-editors won't display
- Auto-populates sections based on client's services when assigned
- PDF builder reads checkboxes into local vars BEFORE calling closeModal()

## Known Patterns & Gotchas
1. **Render priority**: `renderNutrition()` → checks `_editProgram` → `_editWorkout` → `_editMealPlan` in order. The program builder also checks `_editWorkout` and `_editMealPlan` first.
2. **Modal scroll**: showModal handles all scrolling. Do NOT add `max-height` + `overflow-y:auto` to content inside modals - it breaks iOS.
3. **Theme colors**: Never hardcode `#1a1408` or `#1a1000` - use `var(--bg)` for text on gradient backgrounds.
4. **Function naming**: Workout builder uses `pickWkExCustom()` (not `pickExerciseCustom` which is for client program days).
5. **Cloud sync**: `save()` persists all data stores including programs/workouts. `savePrograms()` and `saveWorkouts()` are for local-only saves.
6. **iOS keyboard**: focusout listener resets scroll position after keyboard dismiss.
7. **All picker modals** (exercises, anabolics, peptides, supplements, foods) should allow custom entry with fully customizable dose/timing/frequency fields - not just preset options.

## Databases (in-code constants)
- `FOOD_DB[]` - foods with macros, `ck` flag (1=cooked, 0=dry/raw), categories P/C/F/V
- `ANABOLICS_DB[]` - categories: Anabolic Steroids, AI, SERMs, Prolactin Support, Peptides, SARMs, Ancillaries, Fat Loss/GLPs
- `SUPP_DB[]` - supplement categories with preset doses/timings
- `CARDIO_DB[]` - cardio types with modes
- `EXERCISE_DB{}` - exercise groups with exercises

## PENDING WORK (if continuing)
### High Priority
1. **Fat Loss / GLP section**: Add as new program section type "fatloss" with:
   - GLPs: Semaglutide, Tirzepatide, Retatrutide, Liraglutide
   - Fat burners: Injectable L-Carnitine, Clenbuterol, T3/T4, DNP, Yohimbine HCL, Alpha-Yohimbine
   - Full CRUD like peptides section (client.fatloss array)
   - Include in PDF builder, export/import, deleteClient cleanup

2. **Supplement database expansion**: Add SUPP_DB constant with categories:
   - Protein & Aminos, Pre-Workout & Performance, Digestive & Gut Health
   - Vitamins & Minerals, Joint & Recovery, Sleep & Stress
   - Liver & Organ Support, Glucose & Metabolism, Hormonal & Vitality, Fiber & Greens
   - Create picker modal like peptide/anabolics pickers

3. **Food prep state indicators**: FOOD_DB has `ck` property. Display:
   - Proteins/carbs with ck:1 → "(cooked)" badge
   - Oats/cream of rice with ck:0 → "(dry)" badge
   - In meal plan display AND food picker

4. **Dosage customization**: All compound/supplement pickers must allow custom dose entry (free text input), not just preset dropdown options

5. **Alpha-Yohimbine**: Add alongside Yohimbine HCL in Fat Loss section with proper dosing (1mg, 2mg, 3mg)

### Medium Priority
- Notes fields on individual supplement entries and meal items
- Client filter reset (`_clientFilter`) on tab switch in `_doGoTab`
- Clean up remaining dead code: `renderWorkoutBuilder`, `_nutView`, `_guideSearch`

### Low Priority
- Remove duplicate items from ANABOLICS_DB "Ancillaries" that are now in "Fat Loss/GLPs"

## Naming Convention for Compounds
ALL compounds in ANABOLICS_DB, Fat Loss/GLPs, and Peptides MUST follow this format:
**"Pharmaceutical Name / Brand or Common Name"** (pharma first, common second)

Examples:
- `Oxandrolone / Anavar` (NOT "Anavar / Oxandrolone")
- `Testosterone Cypionate / Test C` (NOT "Test C / Testosterone Cypionate")
- `Trenbolone Acetate / Tren A`
- `Nandrolone Decanoate / Deca`
- `Methandrostenolone / Dianabol`
- `Anastrozole / Arimidex`
- `Semaglutide / Ozempic / Wegovy`
- `Tirzepatide / Mounjaro / Zepbound`

This applies to every single entry. If a compound has multiple brand names, include them all separated by `/`.

## Visual Testing with Playwright (CRITICAL — USE THIS)
You can **render the page and take screenshots** using Playwright. This is the single most important tool for quality — USE IT on every visual change instead of guessing.

```javascript
// Run with: NODE_PATH=/opt/node22/lib/node_modules node -e "..."
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  // Block external requests (fonts etc) to avoid timeouts
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.setViewportSize({ width: 1440, height: 900 }); // or 390x844 for mobile
  await page.goto('file:///home/user/bigmike/index.html', { waitUntil: 'load', timeout: 10000 });
  // Remove brand reveal and force visibility on animated elements
  await page.evaluate(() => {
    document.getElementById('brandReveal')?.remove();
    document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale,.s-head').forEach(el => {
      el.style.opacity='1'; el.style.transform='none'; el.style.filter='none';
    });
    document.querySelector('.hero h1').style.cssText+='opacity:1!important;animation:none!important';
    document.querySelector('.hero-sub').style.cssText+='opacity:1!important;animation:none!important';
    document.querySelector('.hero-ctas').style.cssText+='opacity:1!important;animation:none!important';
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/ss-section.png' });
  // Scroll to sections: await page.evaluate(() => document.getElementById('about')?.scrollIntoView());
  await browser.close();
})();
```

Key notes:
- **Block external requests** with `page.route()` — Google Fonts will timeout otherwise
- **Remove brand reveal** — it covers the page for 18 seconds
- **Force reveal visibility** — scroll-triggered animations start hidden
- **Use `Read` tool on the screenshot PNG** — Claude can see images
- Always screenshot at both **desktop (1440x900)** and **mobile (390x844)**
- Scroll to sections with `scrollIntoView()` then `waitForTimeout(400)` before screenshot

## Testing Checklist
After any changes, always:
1. Extract JS and validate: `sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > /tmp/bigmike_js.js && node -c /tmp/bigmike_js.js`
2. **Screenshot the changed sections** using Playwright (see above) and visually verify
3. Check all onclick handlers reference existing functions
4. Verify modals open and scroll properly (no nested overflow containers)
5. Verify render chain: renderNutrition → renderProgramBuilder → sub-editors
6. Commit and push
