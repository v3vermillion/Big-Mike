# Master Logic Audit — Big Mike Ely Coaching Platform

**Branch:** `claude/master-logic-audit-QtqH0`
**Audit date:** 2026-04-13
**Scope:** `app.html` (coach SPA, 8308 lines), `portal.html` (client portal, 2249 lines), `book.html` (booking flow, 1370 lines), `onboard.html` (intake form, 686 lines)

---

## Methodology

1. Extracted every `<script>` block from each HTML file into standalone JS bundles and ran `node -c` syntax validation. **All four bundles parse cleanly.**
2. Parsed every inline event handler (`onclick`, `onchange`, `oninput`, `onsubmit`, `onkeypress`, `onkeydown`, `onblur`, etc.) and cross-referenced every function name called against the union of `function X(`, `var X = function`, and `window.X =` definitions.
3. Hand-verified state/persistence/sync patterns: `save()`, `cloudSync()`, `cloudPull()`, `markDeleted()`, `deleteClient()`, `importData()`.
4. Hand-verified render chain priority: `renderNutrition` → `_editProgram` → `_editMealPlan` → `_editWorkout`.
5. Hand-verified navigation lock, PDF pagination, modal stacking, and iOS focusout scroll reset.

---

## Summary

| Severity | Count | Status |
| --- | --- | --- |
| P0 — Data loss / crash | **0** | — |
| P1 — User-visible bug | **1** | Offline messaging persistence gap |
| P2 — Edge case / robustness | **4** | Resource leaks, overflow, edge cleanup |
| P3 — Minor / cosmetic | **3** | Style nits |
| **Verified-safe** | **10** | No action required |

**Headline result:** Zero undefined function references across 158 + 24 + 10 + 3 inline handlers. Zero dead function bodies across 728 + 118 + 53 + 17 definitions. All four inline JS bundles parse cleanly. Render chain, navigation lock, PIN lockout, portal/coach storage separation, and iOS focusout scroll reset are all correctly implemented.

---

## P1 — HIGH: `_messages` not persisted to localStorage

**File:** `app.html:383`
**Impact:** Offline messaging fragility; transient UI emptiness on cold start.

```js
var _messages=[];   // line 383 — declared, never read from LS
```

`_messages` is the sole store for all coach ↔ client direct messages (it backs `renderMessageHub()`, the inbox badge at line 682, client-detail threads at line 1104, and blast sends at line 1195). It is **only** populated by `cloudPull()` at line 448:

```js
sb.from("messages").select("id,data")...
  .then(function(r4){if(!r4.error&&r4.data){_messages=r4.data.map(function(r){return r.data;});} ...});
```

It is **never** written to `localStorage`. The main `save()` function at line 387 persists `clients, sessions, schedule, templates, mealPlans, programs, workouts, blockedTimes, inbox` — no `messages`.

**Consequences:**
1. **Cold start blank**: on every page reload, `_messages` starts as `[]`. Until `cloudPull()` completes (async), the message hub, client threads, and inbox badge all show empty. On a slow connection this is several seconds of stale-empty UI.
2. **Offline send = silent loss**: `sendMessage` (line ~1128), `sendBlastMessage` (line 1195), and client-detail quick-send (line 1345) all push to `_messages` first, then upsert to Supabase. On upsert error, the local copy is reverted (line 1197: `_messages=_messages.filter(...)`) and a toast fires. If the whole Supabase client is unavailable (`!sb`), the send is blocked early, so this is defensive — but any message that was shown in the UI and then filtered out on error leaves no trace.
3. **Supabase is the only source of truth**: inconsistent with every other store in the app, which all round-trip through `LS.set` → `cloudSync()`.

**Recommended fix:** Treat `_messages` like `_inbox`:
- Initialize from LS: `var _messages=LS.get("messages",[]);`
- Add `LS.set("messages",_messages)` to the `save()` block at line 387.
- Merge instead of replace in `cloudPull` (line 448): walk cloud rows, keyed by `id`, and insert only new ones, matching the pattern used at line 435–439 for other tables.

---

## P2 — MEDIUM findings

### P2-1 — PDF pagination allows oversize single-element pages

**File:** `app.html:7558` (`_splitContentIntoPages`)

```js
for(var i=0;i<children.length;i++){
  var ch=children[i].offsetHeight+16;
  if(currentH+ch>maxH&&currentHTML){pages.push(currentHTML);currentHTML="";currentH=0;}
  currentHTML+=children[i].outerHTML;currentH+=ch;
}
```

**No infinite loop risk** (plain indexed `for`). However, if any single child element exceeds `maxH` (default 920px) — e.g., a meal plan with 40+ food rows, a workout with an exhaustive exercise list, or a very long coach note — it will be emitted on a page that overflows `maxH`, causing the PDF renderer downstream to clip the bottom of the content when it paginates the actual page.

**Recommended fix:** When a single child exceeds `maxH`, split it in half recursively, or at minimum warn via `toast()` so the coach knows to reduce section density.

### P2-2 — `deleteClient` leaves `_inbox` entries intact

**File:** `app.html:2253`

`deleteClient` correctly purges the client from `clients`, `mealPlans`, `_programs`, `_workouts`, `reminders`, and `_messages`, and renames them out of `sessions`/`schedule` (preserving history intentionally — correct).

However `_inbox` is never filtered. If an inbox entry references the deleted client by `clientId`, it will remain in the inbox and the coach will see orphaned entries. Inbox entries may be scoped by phone rather than `clientId` (booking inquiries from non-clients), so a blind filter would be wrong; the correct fix is conditional:

```js
_inbox = _inbox.filter(function(x){ return !x.clientId || x.clientId !== id; });
```

### P2-3 — `_deletedIds` grows unbounded in localStorage

**File:** `app.html:384–385`

```js
var _deletedIds=LS.get("deletedIds",{});
function markDeleted(id){_deletedIds[id]=Date.now();LS.set("deletedIds",_deletedIds); ... }
```

Every deleted entity (client, session, schedule, template, meal plan, program, workout, inbox item) gets a permanent entry in `_deletedIds` with a timestamp, and the dict is never pruned. Over years of use, this dict will grow into the hundreds or thousands of entries in the `fm_deletedIds` localStorage key. Not urgent, but a slow leak.

**Recommended fix:** Garbage-collect entries older than, say, 90 days at app startup:
```js
var cutoff=Date.now()-90*864e5;
for(var k in _deletedIds) if(_deletedIds[k]<cutoff) delete _deletedIds[k];
```

### P2-4 — `cloudPull` mealPlans resolved by fallthrough, not by name

**File:** `app.html:432`

```js
var localItems = t.arr==="clients"?clients
  : t.arr==="sessions"?sessions
  : t.arr==="schedule"?schedule
  : t.arr==="templates"?templates
  : t.arr==="programs"?_programs
  : t.arr==="workouts"?_workouts
  : t.arr==="inbox"?_inbox
  : mealPlans;
```

The only table registered in the `tables` array on line 426 without an explicit branch here is `mealPlans`, so the fallback works **by coincidence**. If a future table is added to the `tables` array without updating this ternary chain, its cloud data will be merged into the `mealPlans` array and silently corrupt it. This is the kind of bug that's catastrophic when it lands. Replace with an explicit map:

```js
var map = { clients:clients, sessions:sessions, schedule:schedule, templates:templates,
            mealPlans:mealPlans, programs:_programs, workouts:_workouts, inbox:_inbox };
var localItems = map[t.arr];
if (!localItems) { remaining--; return; }
```

---

## P3 — LOW findings

### P3-1 — `_splitContentIntoPages` default `maxH` hardcoded at 920

**File:** `app.html:7560`

`maxH` is read from the call site or defaulted to `920`. PDF output height depends on the embedded CSS at render time. If the PDF template ever grows a thicker header/footer, this constant will silently cause clipping. Recommend computing `maxH` from the rendered page template instead.

### P3-2 — `navStack` in theory unbounded

**Files:** `app.html:455, 462` (`push`)

`push()` always appends to `navStack` without a depth cap. In realistic usage `_doGoTab` resets it to `[]` on every tab switch, so the stack stays small — but a deliberately pathological nav sequence inside a single tab would grow it without bound. Add a safety cap: `if(navStack.length>50) navStack.shift();`

### P3-3 — `_blastLock` release relies on `Promise.all(...).then` only (no `.catch`)

**File:** `app.html:1203`

```js
Promise.all(promises).then(function(){ _blastLock=false; ... });
```

Each individual promise has its own `.catch` on line 1200, so in practice none of them reject, and `Promise.all` never enters its catch path. This is correct **defense-in-depth-less-one**: if a future edit removes the per-promise `.catch`, the lock would stick permanently. Add `.catch(function(){ _blastLock=false; if(btn){btn.disabled=false;btn.textContent="SEND MESSAGE";} })` for future-proofing.

---

## Verified-safe (previously suspected, now confirmed clean)

The following patterns were audited and **cleared** — no action required:

1. **Zero broken inline handlers** — `app.html` references 158 distinct function names from `onclick`/`onchange`/etc.; all 158 are defined in the inline script bundle. Same for `portal.html` (24/24), `book.html` (10/10), `onboard.html` (3/3). (The only "missing" names flagged by naive scans — `reload` and `remove` — are method calls on `location` and DOM nodes, not standalone function references.)
2. **Zero dead function bodies** — every one of the 728 explicit function definitions in `app.html` is called somewhere (by inline handler, by another function, or via `setTimeout`/`addEventListener`). Same for `portal.html` (118/118).
3. **Render chain priority is correct** — `renderNutrition()` at line 5367: `_editProgram` is nullified first **intentionally** (CLAUDE.md Phase 3B: "Old program builder disabled — wizard is the only builder now"), and `_editMealPlan`/`_editWorkout` checks at lines 5371–5372 run independently against the sub-editors. No CLAUDE.md "CRITICAL PATTERN" violation.
4. **`_splitContentIntoPages` has no infinite loop risk** — standard `for(i=0;i<children.length;i++)` with `i++`; each iteration advances unconditionally. (The overflow concern is P2-1 above, not a hang.)
5. **iOS `focusout` scroll reset correctly guards auth/lock screens** — `app.html:488` explicitly checks for `#authScreen` and `#lockScreen` before firing the scroll reset, so the auth/lock screens no longer jitter on keyboard dismiss (EXECUTION_PLAN Phase 1A fix is in place).
6. **Navigation lock (`_navLock`) prevents rapid-tap bugs** — `go()`, `push()`, `pop()` all set `_navLock=true` with a 300ms timeout release; double-tap on any nav control is a no-op.
7. **PIN authentication is server-side rate limited** — `portal.html:462` calls `verify-pin` edge function, which returns `res.data.locked` + `lockedUntil`. Client-side `_pinAttempts` counter mirrors the server state from `res.data.attemptsRemaining`. Cannot be bypassed by reloading the page.
8. **Portal and coach apps use distinct localStorage prefixes** — `app.html` uses `fm_*` (via `LS`), `portal.html` uses `bm_portal_*`. No key collision even though both run on the same origin.
9. **Client deletion cleans up the main stores** — `mealPlans`, `_programs`, `_workouts`, `reminders`, `_messages` are all filtered, and corresponding Supabase rows are deleted via `markDeleted`. Sessions and schedule entries are renamed rather than removed (intentional — preserves financial history). The "anabolics/peptides/fatloss orphan" concern is a **false alarm**: those are nested arrays on the client object itself, so they vanish when `clients = clients.filter(...)` removes the parent.
10. **Birthday expiry kill-switch is absent** — `_bdayExpiry` / `1773936000000` exists only in `CLAUDE.md` documentation, not in any HTML file. The app will continue functioning normally past the March 19, 2026 deadline (today is 2026-04-13, 25 days past; app is unaffected).

---

## Recommended fix order

1. **P1** — Persist `_messages` to localStorage (1 line in `save()`, 1 line at declaration, merge-not-replace in `cloudPull`).
2. **P2-4** — Replace the `cloudPull` ternary chain with an explicit map. Prevents a future catastrophic bug.
3. **P2-2** — Add conditional `_inbox` cleanup in `deleteClient`.
4. **P2-1** — Warn or split oversized single elements in `_splitContentIntoPages`.
5. **P2-3** — Garbage-collect `_deletedIds` entries older than 90 days at startup.
6. **P3-1, P3-2, P3-3** — Optional hardening; ship when touching adjacent code.

---

## Files audited

| File | Lines | JS lines extracted | node -c | Inline handlers | Functions defined |
| --- | ---: | ---: | --- | ---: | ---: |
| `app.html` | 8308 | 7932 | pass | 158 | 728 |
| `portal.html` | 2249 | 1976 | pass | 24 | 118 |
| `book.html` | 1370 | 866 | pass | 10 | 53 |
| `onboard.html` | 686 | 279 | pass | 3 | 17 |
