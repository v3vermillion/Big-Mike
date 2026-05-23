# AUDIT v2 — Run 1 Dashboard
_First graded VAS pass. Public marketing surfaces + the two PWAs (recovery mode)._

## Baseline (instrumented, evidence-backed)
9 public pages × {390 mobile, 1440 desktop}, reveal forced, decorative layers excluded:

| Metric | Result | Confidence |
|---|---|---|
| Horizontal overflow | **0** real (decorative full-bleed layers excluded) | T3 ✅ |
| Console / page errors | **0** | T3 ✅ |
| axe-core WCAG 2A/2AA critical+serious | **0** | T3 ✅ |

## Fixed this run (Assured, C≥95, verified)
| # | Fix | Evidence |
|---|---|---|
| 1 | **Carbon-fiber/gold image fallback** — failed images become a brushed carbon-fiber panel + gold monogram, never a dead box (marketing + client portal). | rendered 6/6 panels with images blocked (`/tmp/fallback.png`) — T3 |
| 2 | **Theme-leak fixed** — Results stat numbers now follow the crimson theme instead of staying gold. | crimson screenshot verified — T2 |
| 3 | **onboard color-contrast** — `--dm`/`--dmL` tokens + "* Required" note brightened; axe now CLEAN at 390 + 1440. | axe re-run CLEAN — T3 |
| 4 | **Distinct per-page backgrounds** — About → most-muscular-stage; Platform → gym-back-squats (were duplicates of Results/Services). | css diff — T2 |
| 5 | **Audit harness hardened** — `scan.mjs` now forces `.section` opacity (kills mid-animation false-positives) and excludes decorative layers (accurate overflow). | clean re-run — T3 |

## Inherited v1 suite
`handler_audit` ran but scanned 0 files — its hardcoded path list predates the marketing/app split → **queued** for path update. Other v1 harnesses (`portal_render`, `coach_wizard`, `edge`, `what_if`, `three_perspective`, `security`, `visual_audit`) to be re-pathed and re-run during the deeper waves.

## Coverage note
This run covered **Wave 1 (foundation) + the highest-confidence Wave 2/4/6 items**. Waves 3 (interaction fuzz/dead-code telemetry) and 5 (deep coach/portal walk) require the login-gated apps to be exercised with a temporary mock-auth (backend is in recovery mode) — that is the next run, on your go.

See `HUMAN_QUEUE.md` for everything routed to you.
