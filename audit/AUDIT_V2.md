# AUDIT v2 — "The Sweep That Can't Be Broken"
### The most rigorous audit this build will ever receive. Reusable, resumable, evidence-gated.

> **Status:** PLAN — awaiting approval. Nothing in the graded run executes until approved.
> **Predecessor:** the April v1 Final Sweep (1,315 assertions / 0 failures). v2 *inherits* that suite and extends it.
> **Why it exists:** this is a late-birthday gift for IFBB Pro Big Mike Ely — a top coach with no website, 100+ clients, 80-hr weeks, run on paper and memory. The bar is not "tests pass." The bar is: **open it, try to break it, and you can't.** Anything we can't make certain is handed to the user — never silently passed.

---

## 0. Prime directive
Every surface, path, state, and pixel ends in exactly one of two buckets:
1. **Assured** — verdict proven at **Confidence ≥ 95** with a stored artifact, **and** Quality ≥ its target.
2. **🧍 Human Queue** — anything below 95 confidence, anything engine/hardware-bound, anything that's a brand-taste call. Short, specific, handed to you.

There is no silent pass. Certainty is the deliverable; the Coverage Ledger is the proof.

---

## 1. What v1 already gave us (inherited, not rebuilt)
v2 runs these as its functional backbone (in `scripts/`):

| Asset | What it proves | v1 result |
|---|---|---|
| `visual_audit.js` | overflow / centering(±2px) / button a11y / console, 7 pages × 5 viewports | 35/35 |
| `portal_render_harness.js` | every client-portal tab renders expected data | 63/63 |
| `coach_wizard_harness.js` | `_wizMergeToClient()` writes every field to client + LS | 21/21 |
| `edge_harness.js` | adversarial boot (empty/malformed/corrupt-LS) → 0 console errors | 9/9 |
| `handler_audit.js` | every `on*=` ref resolves to a defined fn | 1112/0 orphans |
| `lock_audit.js` | every mutation has a rapid-tap guard | 11/0 |
| `functional_walkthrough.js` | public + coach + client end-to-end | 35/35 |
| `what_if_chains.js` | adversarial scenario chains | 15/15 |
| `security_audit.js` | XSS / auth / secrets / rate-limit / CSP | P0=0 |
| `three_perspective.js` | Instagram visitor / Mike-6am / client-$300 | 9/9 |

Inherited doctrine (kept verbatim as gates): the **three-perspective framework**, the **measurement-first standard** (text-fit ratio, ±2px centering, overflow, contrast ≥4.5/3, `document.fonts.ready`), the **8 architectural invariants**, the **rake-pattern list**, and the **commit format** (root cause / fix / measurement / parallel-check).

---

## 2. Heavy critique — gaps v1 left + gaps in my first v2 draft
**Gaps v1 itself could not reach (now first-class in v2):**
1. **Confidence scoring.** v1 scored *quality* (1–10) but never *how sure the auditor was*. → v2 adds the **Confidence engine + evidence tiers** so code-reading alone can never clear the gate.
2. **State-space completeness.** v1 used checklists, not an enumerated `screens × data × theme × device × condition` cross-product. → v2 **Coverage Ledger** proves every cell was hit or queued.
3. **Real cross-engine (Safari/WebKit, Firefox).** v1 noted it as "no access." → v2 adds **static engine-risk scanning** (`background-clip:text`, `-webkit-mask`, `backdrop-filter`, `:has()`, `aspect-ratio`, `svh/dvh`) + an explicit hardware queue.
4. **Theme-switcher *transfer*.** v1 scored coach as "intentionally crimson" and never audited the **public switcher → app.html** propagation or full-token coverage. → dedicated v2 segment (your mandate).
5. **Performance budgets.** v1 had load-timing, not Core Web Vitals budgets (LCP/CLS/INP/TBT/FPS/memory) per device tier. → v2 adds them as hard gates (Lighthouse).
6. **Telemetry-proven dead code.** v1's `handler_audit` is static. → v2 **runtime call-tracing**: a function never executed across the full exercise is flagged dead; duplicate execution/visual signatures = redundancy (your "nothing without a purpose").
7. **Automated a11y (axe-core) + modern modes.** v1 did manual contrast/targets. → v2 runs **axe-core** + `prefers-reduced-motion`, `prefers-contrast`, `forced-colors` (Windows high-contrast), 200% zoom, `prefers-reduced-transparency`.
8. **Pixel-diff visual regression.** v1 reviewed screenshots by eye. → v2 stores **golden baselines** and gates on `pixelmatch` deltas across themes/devices/states.
9. **PWA install/update across the matrix.** v1's manifest audit missed the subpath/install break we just fixed. → v2 verifies install + icon-fire + update propagation on every device tier.
10. **Carbon-fiber/gold fallback system, low-vision pass, old-school texture** — net-new design mandates v1 never had.
11. **Birthday/`_bdayExpiry` clock logic, localStorage-quota, denied-permissions, slow-3G/offline, clock-skew** — chaos cases beyond v1's corrupt-LS/network-fail.

**Gaps in my own first v2 draft (now fixed):**
- It was methodology-heavy and under-weighted v1's **concrete assertion harnesses** → v2 keeps them as the backbone.
- A literal "triad per micro-segment" was unaffordable → replaced with **wave-parallel agents + one dedicated fresh-eyes referee pass** (v1's Step-7 context-free auditor, formalized).
- It lacked the **measurement-first + parallel-instance** discipline → re-imported from v1.

---

## 3. The dual scoring system (your requested certainty engine)
Every finding carries **Confidence (C)** and the surface carries **Quality (Q)**.

**Confidence C (0–100)** — driven by *evidence*, not vibes:
| Tier | Evidence | C ceiling |
|---|---|---|
| T0 | code-inference only | **60** |
| T1 | one runtime artifact | 75 |
| T2 | ≥2 independent tools agree | 88 |
| T3 | reproduced ≥3× + fresh-eyes concurs + holds on ≥3 devices | **100** |
| Modifiers | non-reproducible −30 · auditor/referee disagree −20 · engine-unavailable **hard cap 70** |

**Quality Q (0–100)** — 6 weighted dimensions: visual craft · interaction feel · performance · accessibility · robustness · brand consistency. **Targets: Q≥92 public + client portal; Q≥88 elsewhere.** (Maps onto v1's 7-metric scale ×10.)

**Status gate (mechanical):**
- `C≥95 ∧ pass ∧ Q≥target` → **Assured ✅**
- `C≥95 ∧ fail` → **Fix-Now** (P0/P1 fixed in the run)
- `Q<target` → **Elevate** (push to the ceiling)
- `C<95 ∨ engine-residual ∨ brand-taste` → **🧍 Human Queue**

The T0 cap (60) structurally **forbids "looks fine to me" from ever reaching Assured** — the core AI-audit failure mode is designed out.

---

## 4. Execution architecture (reusable + resumable)
- **One orchestrator, one command, fully resumable.** `node audit/orchestrator.mjs` walks the segment registry, writes a **checkpoint after every segment** (`audit/reports/checkpoint.json`), and on restart skips completed segments. This is the "save-as-you-go, one long sweep."
- **Wave-parallel agents** per §6, then a **fresh-eyes referee** pass (context-free, ruthless) that re-derives verdicts and can only *lower* confidence — never rubber-stamp.
- **Evidence vault:** every verdict links a screenshot / log / axe report / trace in `audit/reports/<segment>/`.
- **Live dashboard:** `audit/reports/DASHBOARD.md` regenerated each checkpoint — every cell's C, Q, status, evidence link.
- **Fix policy (per your direction):** auto-fix only at `C≥95`; everything uncertain → Human Queue. Each fix commit uses v1's format (root cause / fix / measurement / parallel-check) and re-runs the affected harness before push.

---

## 5. Device & environment matrix (2026)
**Phones:** iPhone 17 Pro Max, 16, SE3; Pixel 9; Galaxy S25; Galaxy Z Fold (folded 280 + open 717); budget 360. **Tablets:** iPad Pro 13, iPad mini, Galaxy Tab — both orientations. **Desktop:** 1366, 1440, 1920, 2560 ultrawide, 3840 4K. **Conditions (cross-product):** portrait/landscape · OS dark/light · `prefers-reduced-motion` · `prefers-contrast` · `forced-colors` · 200% font-zoom · slow-3G + offline · **installed PWA standalone vs browser tab** · notch/safe-area · keyboard-only · VoiceOver/TalkBack (→ queue). **Engines:** Chromium (full emulation) here; **Safari/WebKit + Firefox → Human Queue** with the exact at-risk CSS pre-flagged.

---

## 6. Segment registry (most-granular split; each = a wave unit)
**WAVE 1 — Foundation & runtime** (per page): boot/brand-reveal sequence, FOUC & font-swap, LCP/CLS/INP, asset load order, lazy-image settle, console/pageerror sweep, link/anchor integrity, absolute-path/subpath safety.
**WAVE 2 — Surfaces** (one unit each, scored on the 7 metrics): hero · "Company He Keeps" grid + lightbox · nav + mobile menu (scroll/active/focus) · footer · index · about · services · gallery · results · contact · book · platform · onboard · 404.
**WAVE 3 — Interaction & logic:** rapid-tap/double-tap/spam + keyboard fuzzing on every control · navigation thrash & race conditions · **redundancy/dead-code purge (telemetry-proven)** · forms (validation, iOS keyboard, autofill, error/empty/loading/offline states).
**WAVE 4 — Systems:** **theme switcher (public→app.html, full-token, logic-traced)** · PWA install/update/offline across matrix · accessibility (axe + focus order + targets + modern modes) · **typography/readability** (low-vision legible *and* premium) · performance budgets · data integrity (LS round-trip, `save()` paths, export/import, cascade delete) · security (XSS/auth/secrets/rate-limit/CSP) · birthday-expiry clock logic.
**WAVE 5 — The two apps (largest budget):** coach app (auth/PIN, every tab/view/modal/picker, wizard merge, CRUD+persistence, PDF, push, settings) · **client portal — the highlight pass** (functions, ease-of-use, professionalism, aesthetics, font sizing/spacing) benchmarked to agency + Trainerize/TrueCoach and pushed past them.
**WAVE 6 — Brand & ceiling:** old-school background system · **carbon-fiber/checker-silver + gold fallback texture** for any non-rendering/blank/loading region · final per-surface polish to the Q ceiling.

---

## 7. Property / invariant assertions (tested across the whole matrix)
1. No element exceeds viewport width on any device (`rect.right ≤ vw ∧ rect.left ≥ 0`, non-decorative).
2. Every interactive element has an accessible name; every touch target ≥44px.
3. **Theme switch mutates 100% of themed tokens** — zero hardcoded gold/crimson survives a switch (public *and* app.html).
4. Zero console errors / unhandled rejections on any traversed path.
5. Every data-driven view has loading + empty + error states.
6. Every `.then()` on a remote call has a terminating `.catch()`.
7. Every mutation has a rapid-tap guard (lock / modal / provable idempotence).
8. `save()` persists every store referenced by any renderer (no data loss on reload).
9. Body text contrast ≥4.5:1, large ≥3:1 — at default *and* at theme-switch *and* over photo backgrounds.
10. No image failure renders a dead black box — the carbon-fiber/gold fallback engages.
11. Centering within ±2px for every "should-center" element (v1 list, extended).
12. PWA: installable + correct icon/name on every install-capable tier; updates reach saved apps.

---

## 8. Your specific mandates (each a tracked work item)
- **Theme switcher, rigorously logic-audited.** Trace the gold↔crimson switch end-to-end: persistence, **transfer into app.html**, coverage of every element/font/dynamically-rendered view/modal, `theme-color` meta, PWA icon, re-render after navigation. Invariant #3 is the gate; round-1 already found Results stat numbers stuck gold — we hunt that class to zero.
- **Carbon-fiber/checker-silver + gold fallback texture.** A reusable layer for (a) failed images, (b) empty/blank panels, (c) loading skeletons — subtle, premium, on-brand; nothing ever renders as a dead box (Invariant #10).
- **Old-school feel.** Lean backgrounds toward Mike's era — film-grain, brushed-metal/checker plate, engraved gold rules — quality untouched, vibe shifted.
- **Low-vision readability vs premium.** Establish min sizes/line-height/contrast; verify at 200% zoom + contrast modes; preserve Cinzel/luxury. Readability and luxury both, never one at the other's cost.
- **Client portal = the highlight.** Deepest budget. Benchmarked to top-agency + leading coaching apps; any surface below the ceiling on functions/ease/professionalism/aesthetics/typography/spacing gets pushed higher.
- **Redundancy removal (logical/functional/visual).** Telemetry-proven dead code + duplicate-signature detection; remove what serves no purpose.

---

## 9. Methodology layers (the "2050" rigor)
State-space enumeration · differential testing (DOM + pixel diff across device/theme) · chaos/mutation (kill net, corrupt/quota-exceed LS, oversized/malformed input, denied perms, missing images, mid-animation nav, clock-skew) · property/invariant assertions · runtime telemetry tracing · Core-Web-Vitals budgets · golden-baseline visual regression · axe-core a11y + modern modes · competitive benchmarking · three-perspective walkthrough · fresh-eyes referee.

## 10. Tooling
Playwright Chromium (device/DPR/touch/UA emulation, net throttle + offline) · axe-core · Lighthouse · pixelmatch + pngjs · custom runtime probes (call-trace, console/error, CLS/paint observers, memory) · interaction fuzzer (seeded) · low-vision emulation · `node -c` + HTML/JSON validators · the v1 `scripts/` suite. **Residual → you:** real Safari/Firefox hardware, live VoiceOver/TalkBack, final brand-taste calls.

## 11. Outputs
`audit/reports/DASHBOARD.md` (C/Q/status/evidence per cell) · `LEDGER.md` (coverage proof) · `PUNCHLIST.md` (P0–P3 + fix or defer) · `HUMAN_QUEUE.md` (your short, specific list) · `baselines/` + diff gallery · per-segment evidence folders.

## 12. Run protocol
```
node audit/orchestrator.mjs            # full resumable sweep
node audit/orchestrator.mjs --wave 5   # one wave
node audit/orchestrator.mjs --resume   # continue after interruption
```
Reusable forever: re-run before any future change; the dashboard tells you in one screen what's certain and what's yours.
