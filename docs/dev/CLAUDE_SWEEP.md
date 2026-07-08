# CLAUDE_SWEEP.md

**Persistent technical standards and verification protocols for any session working on this codebase. Read this before touching code.**

This document supplements `CLAUDE.md` (the project-level instructions) with the standards established during the April 2026 Final Sweep. It is intentionally narrower and more operational.

---

## File map (the thing the hook templates get wrong)

| File | Role | Size |
|---|---|---:|
| `index.html` | **Marketing landing page** — NOT the coach app | ~325 lines |
| `about.html`, `services.html`, `results.html`, `platform.html`, `gallery.html`, `contact.html` | Marketing subpages | 150-300 lines each |
| `app.html` | **The coach SPA** — clients, sessions, schedule, programs, wizard, messages, settings | ~8,447 lines |
| `portal.html` | **The client SPA** — phone/PIN auth, programs, check-ins, messages | ~2,259 lines |
| `book.html` | Booking flow (public → Supabase schedule) | ~1,400 lines |
| `onboard.html` | New-client onboarding form | ~690 lines |
| `404.html` | Branded 404 | ~70 lines |
| `css/site.css` | Shared stylesheet for marketing + portal | ~2,100 lines |
| `js/site.js` | Shared JS (nav, reveal, gallery filter, CTA, contact form) | ~1,200 lines |
| `sw.js` + `portal-sw.js` | Service workers (coach + portal) |
| `scripts/` | Self-verification harness suite (see `scripts/README.md`) |
| `supabase/functions/` | Edge functions (find-client, verify-pin, submit-checkin, send-client-message, etc.) |

When a task says "index.html thoroughly" for coach SPA features, it means **app.html**. The hook templates are from a single-file SPA era; this project split marketing out of the app a few phases back.

## The harness suite (run before every commit that touches HTML/CSS/JS)

```sh
# JS parse
sed -n '/<script>/,/<\/script>/p' app.html | sed '1d;$d' > /tmp/app_js.js && node -c /tmp/app_js.js
sed -n '287,2257p' portal.html | sed '1d;$d' > /tmp/portal_js.js && node -c /tmp/portal_js.js
node -c js/site.js
node -c sw.js
node -c portal-sw.js

# Functional
NODE_PATH=/opt/node22/lib/node_modules node scripts/portal_render_harness.js   # 63 assertions
NODE_PATH=/opt/node22/lib/node_modules node scripts/coach_wizard_harness.js    # 21 assertions
NODE_PATH=/opt/node22/lib/node_modules node scripts/edge_harness.js            # 9 assertions

# Static
node scripts/handler_audit.js           # 990+ inline handler refs / 0 orphans
node scripts/lock_audit.js              # 11+ rapid-tap guards / 0 missing

# Visual
NODE_PATH=/opt/node22/lib/node_modules node scripts/visual_audit.js            # 7 pages × 5 viewports
```

**Expected: every check green.** Any regression is a ship blocker.

## The three-perspective framework

Before calling any change "done," mentally walk each of these:

1. **First-time visitor from Instagram (marketing + funnel surfaces).**
   Phone, 3 seconds, skeptical. Would they screenshot this to send to a friend? Would they book?
2. **Mike at 6 AM, 40 clients (coach app).**
   Two taps to any action. Obvious back button at every depth. Every save confirms. Every navigation preserves scroll. No moment of "wait, what happened?"
3. **Client paying $300/month (client portal).**
   Portal justifies the price. Feels like a premium product. Every section matches what Mike built. Nothing reads as a developer prototype.

If any perspective flinches, the change isn't done.

## Measurement-first standard

Every visual or layout fix must be backed by a measurement:

- **Text fit:** measured width / vpw ratio at 320/375/393/430/768/1440 via `getBoundingClientRect().width`.
- **Centering:** element center vs. viewport center must be within 2px (use `(rect.left + rect.right) / 2` vs. `window.innerWidth / 2`).
- **Overflow:** `rect.right <= window.innerWidth && rect.left >= 0` for every non-decorative element.
- **Contrast:** check foreground/background contrast ratio ≥ 4.5 for body text, ≥ 3 for large text.
- **Load timing:** `document.fonts.ready` + `img.complete && img.naturalWidth > 0` before screenshot.

Commit messages cite the measurement.

## Architectural invariants (don't break these)

1. **Render chain priority in `renderNutrition()`:** `_editProgram → _editMealPlan → _editWorkout` — the wizard must check `_editWorkout` and `_editMealPlan` BEFORE rendering sections, or the sub-editors silently don't display.
2. **`save()` persists EVERY store** that appears in any render function. Missing one = data loss on reload.
3. **`_wizMergeToClient()` is the single point where a sent program propagates to the client record.** Any new section type must be added here, at `app.html` around line 4104.
4. **Portal tab dispatch (`renderTabContent`) must handle every possible `_activeTab` value.** Missing one = blank progContent.
5. **Every `.then()` on a Supabase call needs a terminating `.catch()`.** Unhandled rejection in setInterval = console noise on every poll. Unhandled rejection mid-login = stuck button.
6. **Every user-triggered mutation has a rapid-tap guard.** Lock variable, modal confirmation, or provable idempotence. No exceptions.
7. **LS keys use prefixes:** `fm_` for coach, `bm_portal_` / `bm_` for client/marketing. Never collide.
8. **Cache version bumps** happen in every file that references `?v=vNN` when CSS or JS structure changes.

## Common rake patterns (things I keep stepping on)

- **Letter-spacing + flex centering** produces a box wider than the visible glyphs. Visible center ≠ flex center. Fix: `padding-left: letter-spacing` to offset, OR use explicit `position:absolute; left:50%; translateX(-50%)`.
- **CSS `column-count` masonry + lazy-loaded images** = rebalance on every image settle = apparent "disappearing" photos. Fix: CSS Grid with fixed `aspect-ratio` cells.
- **`scrollIntoView({block:'center'})` in Playwright** doesn't always scroll on pages with fixed navs. Use `window.scrollTo(0, rect.top + window.scrollY - offset)` instead.
- **Playwright `route` + external image** → image aborts → div renders as empty black. Allow `img.youtube.com` explicitly when testing video thumbs.
- **Multiple `<meta property="og:image">` tags** let scrapers pick the worst one. One og:image per page, 1200×630, no secondary portrait.
- **Pseudo-element `::before`** with text content breaks accessible-name calculation. If a label needs to be a real accessible element, use a `<span>` not `::before`.

## Three-perspective commit message format

When shipping a fix, the commit message includes:

```
<one-line summary>

Root cause: <why the bug existed>
Fix: <what changed and why it solves the root cause>
Measurement: <the number or check that proves the fix>
Parallel check: <the other places I looked for the same root cause
                 and whether I found/fixed more instances>
```

## Running Playwright against files

Default sandbox blocks external URLs. For file-local tests:
```js
await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
```
For tests that need fonts or YouTube thumbs:
```js
await page.route('**/*', r => {
  const u = r.request().url();
  if (u.startsWith('file://') || u.indexOf('fonts.') >= 0 || u.indexOf('img.youtube.com') >= 0) return r.continue();
  return r.abort();
});
```
Always `localStorage.setItem('bm_revealed','1')` in `addInitScript` to skip the brand reveal overlay during tests.

## What I DO NOT have access to

- The live deployed site at `ifbbprobigmikeely.com` (no browser, no network to the domain)
- Real iPhone rendering (headless Chromium is close but not identical to iOS Safari)
- Real Supabase data (the harnesses stub everything)
- Push notification delivery (requires real device + permission)
- Twilio SMS delivery (edge function contract read-only)

When the panel sends a real-device screenshot, that is the only way to verify hardware-specific bugs. Take it seriously.

## Branch hygiene

- Work on the branch the task prompt specifies. Never assume `main`.
- Commit per logical section. Never batch unrelated fixes.
- Push after every commit. The panel watches the branch live.
- Never force-push unless explicitly authorized.
- Never merge to `main` unless explicitly authorized.
