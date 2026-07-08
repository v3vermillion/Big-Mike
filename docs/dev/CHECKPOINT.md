# Big Mike Coaching Lab — Implementation Checkpoint

## Session Date: 2026-03-16
## Branch: `claude/polish-coach-dashboard-auTJD`
## Plan File: `/root/.claude/plans/witty-bubbling-pixel.md`

---

## PROJECT OVERVIEW
Single-file SPA at `/home/user/bigmike/index.html` (~2500+ lines). Vanilla JS, localStorage + Supabase sync. Hosted on GitHub Pages at ifbbprobigmikeely.com. For IFBB Pro bodybuilder "Big Mike Ely" — birthday gift.

## WHAT WE'RE BUILDING
Transforming his coaching app into the most complete IFBB Pro coaching platform with:
1. Premium client cards (luxury aesthetic)
2. No hardcoded $70 rates (coach sets his own)
3. Remove "COACH" label from settings
4. Fix calendar scroll bug
5. MASSIVE: Rename "Nutrition" tab → "Programs" tab with 5 sub-tabs:
   - **Training** — Workout builder with exercise picker (150+ exercises, 9 muscle groups, searchable)
   - **Nutrition** — Existing meal plans (enhanced with food search, oz/grams toggle, expanded food DB)
   - **Anabolics** — NEW: Full PED protocol builder (steroids, AIs, SERMs, peptides, GH, SARMs, ancillaries)
   - **Supplements** — Existing (40+ supplements in 6 categories)
   - **Water** — Existing hydration tracker
6. PDF generation for ALL sections (individual or combined into one PDF)
7. Client-assignable protocols
8. Language audit (no condescending/amateur text)

## COMPLETED WAVES

### Wave 1: Quick Fixes ✅
- [x] Premium client profile cards (52x52 avatar with goldGrad shimmer, glow shadow, display font name, pill status badges, accent chevron, left accent border)
- [x] Removed "COACH" text from settings profile
- [x] Fixed calendar scroll bug (scrolls to top instead of center)
- [x] Removed "follow up?" from retention warning
- [x] Removed "growing your business" paragraph from empty clients state
- [x] Removed "Protect your data" from PIN Lock section
- [x] Removed ALL hardcoded $70 defaults (~16 locations): schedule form, home dashboard, session list, settings, client detail, SMS reminders, projected revenue — all now blank or 0 when no rate set

### Wave 2: Databases ✅ COMPLETE
- [x] ANABOLICS_DB — Comprehensive database with 8 categories:
  - Anabolic Steroids (25 compounds: Test C/E/P, Sustanon, Tren A/E/Hex, NPP, Deca, EQ, Primo injectable+oral, Masteron P/E, Anavar, Dbol, Anadrol, Winstrol, Halotestin, Proviron, Superdrol, Turinabol, DHB, MENT, Cheque Drops)
  - AI/Aromatase Inhibitors (Arimidex, Aromasin, Letrozole)
  - SERMs (Nolvadex, Raloxifene, Clomid, Enclomiphene)
  - Prolactin/Progesterone (Caber, P5P/B6, Prami)
  - Peptides (BPC-157, TB-500, CJC-1295 w/DAC & no DAC, Ipamorelin, GHRP-2, GHRP-6, Hexarelin, MK-677, HGH 2-20 IU, IGF-1 LR3, IGF-1 DES, Melanotan II, PT-141, Sermorelin, Tesamorelin, AOD-9604, GHK-Cu, Epithalon, Kisspeptin-10, Selank, Semax, HCG, HMG)
  - SARMs (Ostarine, LGD-4033, RAD-140, S-23, YK-11, Cardarine, SR-9009, S-4, AC-262)
  - Ancillaries & Health (TUDCA, NAC, Milk Thistle, Cialis, Viagra, Finasteride, Dutasteride, Minoxidil, Metformin, Berberine, T3, T4, Clenbuterol, Albuterol, Ephedrine, DNP, Insulin Humalog/R/Lantus, Modafinil, Raloxifene, Niacin, Citrus Bergamot, Ezetimibe, Telmisartan, Nebivolol)
  - Every item has: name (brand/generic), doses[], routes[], freqs[]
- [x] Expanded FOOD_DB — 32 new proteins: chicken thigh/drumstick/wings, turkey breast/leg, lamb (ground/rack/leg), duck breast, ribeye, tri-tip, top round, chuck roast, skirt steak, flat iron, ground pork, bacon, turkey bacon, Canadian bacon, chicken/turkey sausage, sardines, sea bass, halibut, swordfish, scallops, crab, lobster, oysters, elk, goat

## REMAINING WAVES

### Wave 3: Feature Build ⏳ PARTIALLY DONE
**DONE:**
- [x] Renamed Nutrition tab display label → "Programs" (key stays "nutrition")
- [x] Changed default _nutView to "training"
- [x] Added 5 sub-tabs: Training, Nutrition, Anabolics, Supplements, Water
- [x] Updated routing in renderNutrition() to call renderWorkoutBuilder(), renderAnabolics() etc.

**STILL NEEDS TO BE DONE (agent was working on this):**
- [ ] Insert ALL the function bodies for: renderWorkoutBuilder, newWorkout, saveWorkouts, renderWorkoutEdit, wkSet, setWkEx, rmWkEx, moveWkEx, setWkCardio, rmWkCardio, duplicateWorkout, deleteWorkout, assignWorkoutToProgram, showExercisePicker, filterExPickerModal, pickExerciseForWorkout, pickExerciseCustom, showCardioPicker, pickCardioForWorkout, pickCardioCustom, generateWorkoutPDF
- [ ] Insert ALL anabolics UI functions: renderAnabolics, addAnabolic, rmAnabolic, setAnabolicNotes, showAnabolicPicker, filterAnaPicker, pickAnabolicItem, confirmAnabolic, pickAnaCustom, generateAnabolicsPDF
- [ ] Insert generateCompleteProgramPDF function
- [ ] Add `var _workouts=LS.get("workouts",[]),_editWorkout=null;` state variables
- [ ] Add food search to meal plan editor
- [ ] Add oz/grams toggle for food quantities
- [ ] Update generateFullPrepPDF to include anabolics section

**WHERE TO INSERT:** All new functions go after the existing renderWaterTracker/logH2O/setH2OGoal functions (around line 1920-1930 area), BEFORE the toggleSvcChip function. The full function code is in the plan file at /root/.claude/plans/witty-bubbling-pixel.md (though that plan file may not persist across sessions - the Wave 3 agent prompt above has ALL the complete code).

### Wave 4: PDF Generation
- [ ] `generateAnabolicsPDF(clientIdx)` — protocol table by category
- [ ] `generateCompleteProgramPDF(clientIdx)` — combined PDF with all sections
- [ ] Update `generateFullPrepPDF()` to include anabolics
- [ ] Coach notes textarea per section → included in PDF
- [ ] PDF must handle any combination of sections (training only, nutrition + peptides, everything, etc.)
- [ ] Proper font hierarchy and page breaks

### Wave 5: QA Audits (4 parallel)
- [ ] Backend code audit (syntax, undefined vars, XSS, memory leaks)
- [ ] Visual/UX audit (spacing, alignment, contrast, premium feel, both themes)
- [ ] Bug testing (every click, every back button, every form, every modal)
- [ ] Integration audit (full user flow, localStorage persistence, import/export)

### Wave 6: Final Remediation
- [ ] Fix all bugs found in Wave 5
- [ ] Re-verify all fixes
- [ ] Score 100/100 on all metrics

## KEY ARCHITECTURAL NOTES

### Theme System
- Gold (default): `--acc:#D4A830`, `--goldGrad:linear-gradient(135deg,#8B6914,#C49628,#E8C050,#C49628,#8B6914)`
- Crimson: `--acc:#D03030`, all `var(--acc)` vars auto-switch
- ALL new UI must use `var(--acc)` family variables, never hardcoded colors

### Data Storage Pattern
```js
// All data in localStorage with fm_ prefix
LS.get(key, default)  // read
LS.set(key, value)    // write
save()                // writes clients, sessions, schedule, templates, mealPlans to localStorage + triggers cloudSync
```

### Navigation Pattern
```js
go(tab)           // switch main tab
push(view, data)  // navigate to sub-view (stacked)
pop()             // go back
render()          // re-render current view
renderInPlace()   // re-render without scroll reset (for search)
```

### Modal Pattern
```js
showModal(title, htmlContent)  // opens modal overlay
closeModal()                    // closes it
showConfirm(title, msg)        // returns Promise<boolean>
showDoubleConfirm(title, msg)  // two-step confirm for destructive actions
showPrompt(title, msg, default) // returns Promise<string|null>
```

### Existing Databases
- `EXERCISE_DB` — object with muscle group keys → exercise name arrays (150+ exercises)
- `CARDIO_DB` — array of {name, modes[], hrZones}
- `FOOD_DB` — array of {n, cal, p, c, f, unit, per, ck, cat, tags}
- `SUPPLEMENT_DB` — array of {cat, items:[{name, doses[], timings[]}]}
- `ANABOLICS_DB` — array of {cat, items:[{name, doses[], routes[], freqs[]}]} (NEW)

### Client Data Structure (key fields for new features)
```js
client.program = {days:[], startDate, weeks, split}  // training program
client.supplements = [{name, dose, timing}]           // supplement protocol
client.anabolics = [{name, dose, freq, route, notes}] // anabolics protocol (NEW)
client.water = {goal, logs:{}}                         // hydration tracking
```

### PDF Pattern
```js
_renderPDFToFile(pages, filename, docType, pageLabel)
// pages[0] = {coverTitle, coverClient, coverSub} (cover page)
// pages[1+] = {content: htmlString} (content pages)
_splitContentIntoPages(html, maxHeight) // auto-paginate
_pdfCoverPage(accent, rgb, title, client, sub) // branded cover
_pdfContentPage(accent, rgb, content, docType, label) // content template
_pdfAccent() // returns current theme accent hex color
```

## FILES
- `/home/user/bigmike/index.html` — THE ENTIRE APP (single file)
- `/home/user/bigmike/CHECKPOINT.md` — THIS FILE
- `/root/.claude/plans/witty-bubbling-pixel.md` — Full implementation plan with all details
