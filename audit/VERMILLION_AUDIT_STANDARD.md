# VERMILLION AUDIT STANDARD (VAS) v1
### A reusable, oracle-anchored, evidence-gated, falsification-driven audit system. The goal: the first audit that fixes and nails *everything* — and routes every remaining uncertainty to a human instead of guessing.

> Synthesis of: the v1 harness sweep (1,315 assertions / 0 fail) + the v2 confidence-gated plan, after a hostile panel review of both. Portable across projects — swap the §SUBJECT block.

---

## THE PANEL VERDICT (what was wrong with each, now fixed)
**v2's weaknesses (harshest read):** (1) **No oracle** — it scored "does it work" without first defining *what correct is*, so "works but wrong" slips through. (2) **Combinatorial blowup** — full matrix × every condition can't finish; needs risk-weighting. (3) **Subjective tiers** — confidence tiers needed objective entry criteria. (4) **No falsification** — a "pass" was accepted, not attacked. (5) **No regression lock** — fixes could silently re-break. (6) **Collusion risk** — same model auditing itself.
**v1's weaknesses:** (1) Quality-only scoring, no *confidence* of the verdict. (2) Static checks miss runtime/dead-code. (3) Chromium-only, no formal cross-engine residual. (4) Checklists, not enumerated coverage. (5) No automated a11y/perf budgets.
**The fusion keeps v1's concrete assertion harnesses + persona oracles + measurement-first, and v2's confidence gate + state-space + chaos — and adds the 3 things neither had: an Oracle layer, a Falsification mandate, and a self-perpetuating Regression gate.**

---

## THE 8 PILLARS
1. **ORACLE FIRST.** Before judging anything, write what *correct* means: (a) **persona contracts** — for each user, the exact job they must complete without flinching; (b) **invariants** — properties that must always hold; (c) **per-surface spec** — expected behavior/states. You cannot detect "works but wrong" without this. No oracle, no audit.
2. **EVIDENCE-GATED CONFIDENCE (0–100).** Verdicts are scored by *evidence strength*, not conviction. **T0 code-reading caps at 60** (so reading code can never "pass"), T1 one runtime artifact ≤75, T2 ≥2 independent tools agree ≤88, T3 reproduced ≥3× + independent referee + ≥3 devices →100. Modifiers: non-reproducible −30, referee disagrees −20, engine/hardware-bound hard-cap 70.
3. **DUAL SCORE.** Every cell carries **Confidence** (are we sure?) and **Quality** (is it elite? 6 dims: visual craft, interaction feel, performance, accessibility, robustness, brand). Both must clear bar.
4. **FALSIFICATION MANDATE (Popper).** A PASS is provisional until an adversary *tries to break it* and fails. Every "works" is attacked: bad input, rapid-tap, offline, corrupt state, wrong device. A pass that was never attacked is PENDING, not ASSURED.
5. **RISK-WEIGHTED TOTAL COVERAGE.** 100% enumeration of *critical paths*; risk-weighted sampling elsewhere (severity × likelihood × blast-radius). A **Coverage Ledger** proves every (surface × state × theme × device × condition) cell was hit or queued. Completeness is proven, not assumed.
6. **INDEPENDENCE / ANTI-COLLUSION.** Auditor and **fresh-eyes referee** are separate passes with *different evidence*; the referee can only *lower* confidence, never rubber-stamp. Context-free ruthless audit at the end.
7. **SELF-PERPETUATING REGRESSION GATE.** The passing suite becomes the permanent pre-commit/CI guard. Every fix adds an assertion. Nothing that was fixed can silently regress. The audit doesn't end — it *installs itself*.
8. **PRECISE HUMAN RESIDUAL.** Anything <95 confidence, engine/hardware-bound, or brand-taste → a short, specific **Human Queue** with exactly what to check. The system's honesty is measured by how cleanly it admits what it can't prove.

---

## STATUS GATE (mechanical — zero judgment)
`C≥95 ∧ pass ∧ Q≥target → ASSURED` · `C≥95 ∧ fail → FIX-NOW` · `Q<target → ELEVATE` · `C<95 ∨ engine ∨ taste → 🧍 HUMAN QUEUE`. Targets: Q≥92 flagship surfaces, ≥88 elsewhere.

## EXECUTION MODEL (resumable, save-as-you-go)
One orchestrator, one command, **checkpoint after every segment**, **dashboard regenerated each checkpoint**, fully resumable. Wave-parallel specialist agents → fresh-eyes referee → fix `C≥95` only → re-run affected harness → commit → push. Stop/resume anytime without losing graded work.

## METHODOLOGY LAYERS
State-space enumeration · differential testing (DOM + pixel-diff across device/theme) · chaos/mutation (kill net, corrupt/quota-exceed storage, oversized/malformed input, denied perms, missing assets, mid-animation nav, clock-skew) · runtime telemetry (un-executed fn = dead code; duplicate signature = redundancy) · Core-Web-Vitals budgets (LCP/CLS/INP/TBT/FPS/memory) · golden-baseline visual regression · automated a11y (axe) + modern modes (reduced-motion, forced-colors, contrast, 200% zoom) · competitive benchmark · persona walkthrough · monkey/exploratory pass for unknown-unknowns.

## DEVICE × CONDITION MATRIX (update per era)
Phones (fold→max), tablets (both orientations), desktop 1366→4K/ultrawide. Conditions: dark/light, reduced-motion, forced-colors, high-contrast, 200% zoom, slow-3G, offline, installed-PWA-standalone, keyboard-only, screen-reader (→queue). Engines: emulate Chromium; **real Safari/WebKit + Firefox → Human Queue** with at-risk CSS pre-flagged (background-clip:text, -webkit-mask, backdrop-filter, :has(), aspect-ratio, svh/dvh).

## FIX PROTOCOL (every fix)
Commit format: **Root cause / Fix / Measurement (the number that proves it) / Parallel-instance (where else this root cause lives — fixed or why not).** Re-run the affected harness before push. Measurement-first: no claim without a number (px offset, ratio, contrast, timing).

## ARTIFACTS THE SYSTEM PRODUCES
`DASHBOARD.md` (C/Q/status/evidence per cell) · `LEDGER.md` (coverage proof) · `PUNCHLIST.md` (P0–P3 + fix/defer) · `HUMAN_QUEUE.md` (your list) · `baselines/` + diff gallery · per-segment evidence folders · the regression suite itself.

## THE BAR (closing standard)
Not "the tests pass." The bar is: **a hostile expert opens it, tries to break it, and can't** — and every gap the system couldn't *prove* closed is sitting in the Human Queue, named and specific. If any of that is shaky, it isn't done; it's pretending to be done.

---

## §SUBJECT (swap this block per project)
- **Surfaces:** _list every page/screen._
- **Personas & contracts:** _e.g., first-time visitor (3-sec decide), power operator (2-tap any action, never lost), paying client (feels premium, never a dead end)._
- **Invariants:** _no overflow any device · accessible name on every control · theme switch mutates 100% of tokens · zero console errors · loading/empty/error on every data view · every remote .then has .catch · every mutation rapid-tap-guarded · persistence covers every store · contrast ≥4.5/3 · no dead-box image fallback · ±2px centering · PWA installs + updates._
- **Inherited harnesses:** _list existing test scripts to fold in as the backbone._
- **Run:** `node audit/orchestrator.mjs` (full · `--wave N` · `--segment ID` · `--resume` · `--fresh`).
