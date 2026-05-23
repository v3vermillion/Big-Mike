# SUBAGENT FRESH-EYES AUDIT — Findings & Disposition

A context-free subagent was spawned to review the entire production surface
with the same standards a hostile reviewer would apply. This document records
every finding it surfaced, what was done about it, and what remains as
infrastructure follow-up that requires deployer action (Supabase SQL editor,
edge function deploys, secret configuration).

## Disposition legend

- **FIXED** — code change committed, verified
- **MIGRATION** — SQL migration written, requires deployer to run
- **DEFERRED** — needs server-side refactor + edge function; tracked here
- **N/A** — re-investigation showed no actual issue

---

## P0 — Critical (10 findings)

### P0 #1 — `tryAutoLogin` token bypass — **FIXED**
**File**: `portal.html` lines 689–713 + 5 token write sites

The previous flow read `bm_portal_token` and `bm_portal_token_phone` from
localStorage and trusted them to identify the current client. The "token"
was generated client-side as `SHA256(phone+timestamp+'token')` and never
validated server-side. Any visitor with devtools could edit
`bm_portal_token_phone` to any client's phone number and become that client —
read PED protocols, messages, and impersonate them in chat.

**Fix**: Removed the auto-login bypass entirely. `tryAutoLogin` now only
prefills the phone input from `bm_portal_phone` (cosmetic UX) and shows
the login section. All 5 write sites that wrote `bm_portal_token` /
`bm_portal_token_phone` were stripped. The cleanup `removeItem` calls
remain on logout to scrub stale values from prior versions.

### P0 #2 — 2FA code generated client-side via `Math.random()` — **FIXED + MIGRATION**
**Files**: `portal.html` `start2FAVerify` + `sendForgotCode`,
`supabase/functions/request-2fa-code/index.ts` (new)

The portal generated 6-digit verification codes locally with
`Math.floor(100000+Math.random()*900000)`, stored them on the client record
via direct upsert, and shipped them to the client phone via SMS. The code
was visible in the closure scope and in the network upsert payload — anyone
with devtools open could read it before the SMS even left.

**Fix**: New edge function `request-2fa-code` generates the code with
`crypto.getRandomValues()` server-side, stores it on the client record via
the service role key, and sends the SMS via Twilio. The code is **never
returned** to the caller. The portal calls `sb.functions.invoke("request-2fa-code", ...)`
and waits for success. Verification still reads `resetCode` from the client
record, which is acceptable once the messages-RLS lockdown lands (P0 #3).

**Deployer action**: deploy the new edge function:
```bash
supabase functions deploy request-2fa-code
```

### P0 #3 — Anon SELECT on `messages` leaks every conversation — **DEFERRED + MIGRATION**
**Files**: `supabase/migrations/003_messages.sql`,
`supabase/migrations/007_subagent_p0_rls_hardening.sql`

Migration 003 grants `Anon read messages FOR SELECT TO anon USING (true)`.
Any visitor with the public anon key can dump every coach↔client
conversation in the database.

**Status**: Cannot fix purely with RLS — there is no JWT clientId claim
to bind on. Requires:
1. New edge function `read-messages` that takes a phone+pinHash and
   returns only that client's threads.
2. New edge function `post-message-from-client` that validates phone+pin
   then inserts on behalf of the client.
3. Portal refactor to call these instead of `sb.from("messages")` directly.
4. Drop `Anon read messages` and `Anon insert messages` policies.

Migration 007 includes the commented-out DROP statement and the rationale
so the deployer can flip it after the refactor lands.

### P0 #4 — `client_push_subs` allowed anon SELECT and UPDATE — **MIGRATION**
**File**: `supabase/migrations/004_client_push.sql`,
`supabase/migrations/007_subagent_p0_rls_hardening.sql`

The portal only needs INSERT to subscribe. Migration 004 mistakenly granted
SELECT and UPDATE to anon as well, allowing enumeration and tampering.

**Fix**: Migration 007 drops `Anon read subs` and `Anon update subs`.
The portal subscribe path uses INSERT (upsert keyed on phone) which is
preserved.

**Deployer action**: run migration 007.

### P0 #5 — `book.html` UPSERT incompatible with locked-down RLS — **DEFERRED**
**File**: `book.html` line 1280

The booking flow runs from an unauthenticated browser and calls
`sb.from("schedule").upsert(...)`. Migration 002 only allows `Anon insert
schedule`, not anon UPDATE — so the upsert will be rejected once the
locked-down RLS is enforced.

**Status**: Requires either (a) refactoring book.html to use INSERT instead
of UPSERT (collision returns 23505 → caller picks new slot), or (b)
moving the booking through a `create-booking` edge function that runs
under the service role.

Option (a) is the smaller change and is now compatible with the unique
slot index added in migration 006. The book.html caller already does a
final pre-insert availability check; a stricter INSERT will fail on
duplicate ID, and the new unique index will fail on duplicate (date,time).

Tracked as a follow-up because it touches the live booking funnel and
deserves its own QA sweep.

### P0 #6 — Double-booking race (no DB-level slot uniqueness) — **FIXED + MIGRATION**
**Files**: `supabase/migrations/006_schedule_unique_slot.sql`,
`book.html` line 1286 (23505 detection)

Two clients hitting "Book Tuesday 6 AM" in the same moment both pass the
in-memory `isSlotTaken` check before either writes, so both rows land.
The application catches the duplicate clientId+date+time guard but only
after the fact, leaving Mike with two clients fighting over the slot.

**Fix**: Migration 006 adds a partial unique index on
`(data->>'date', data->>'time')` filtered to rows where `clientId` is
non-null (so Mike's blocked-time entries can still stack on top of
existing rows). `book.html` now detects Postgres SQLSTATE 23505 from the
upsert and surfaces a "slot just got booked" toast that triggers a slot
refresh — the racing client is forced to pick again.

**Deployer action**: run migration 006.

### P0 #7 — `_verifyCoachUID` trust-on-first-use is forgeable — **FIXED**
**File**: `app.html` line 8531

The previous implementation wrote the first observed Supabase UID into
localStorage and used it as the "coach UID." A fresh device with no
existing `fm_coach_uid` would happily accept any signed-in account as
the coach.

**Fix**: Added a `BIG_MIKE_COACH_UID` constant at the top of
`_verifyCoachUID`. When set, the function compares against this hardcoded
allowlist value. When empty (development), it falls back to the TOFU
behavior with a loud `console.warn`.

**Deployer action**: paste Mike's actual Supabase UID into
`BIG_MIKE_COACH_UID` before shipping. Search for the
`/* TODO deployer: paste real UID here before ship */` marker in
`app.html`.

### P0 #8 — `isUnlocked()` short-circuits server auth on boot — **N/A**
**File**: `app.html` line 8576

Re-investigation: the boot path calls `checkSupabaseAuth` in **both**
branches (`if(!isUnlocked())` and `else`). Server auth is verified before
the app surface renders regardless of the local PIN unlock state. The
subagent's finding was based on an older snapshot where only the
non-unlocked branch checked auth — that bug was already fixed by an
earlier sweep commit.

### P0 #9 — `save()` quota guard skipped `cloudSync` (wrong direction) — **FIXED**
**File**: `app.html` line 442

The previous "fix" tried to avoid LS↔cloud drift by skipping `cloudSync`
when localStorage threw `QuotaExceededError`. This was backwards: in-memory
holds the full data set, the cloud is the source of truth, and stranding
mutations in memory only meant they were lost on reload.

**Fix**: Removed the `quotaExceeded` flag entirely. `cloudSync` is now
always called from `save()`, even after a quota failure. The user still
sees a "Storage full — export + clear now" toast so they know LS is
stale, but the cloud always holds the truth.

### P0 #10 — Unbounded anon INSERT on `inbox` — **MIGRATION (partial)**
**File**: `supabase/migrations/007_subagent_p0_rls_hardening.sql`

The contact form upserts into inbox with no DB-side throttle. The
application has a per-IP cooldown but a determined attacker can spam
the table.

**Status**: Migration 007 adds a created_at index to support a future
rate-limit trigger. A full fix needs either (a) a Postgres trigger
function counting rows from the same `data->>'phone'` in the last 60s,
or (b) routing the contact form through an edge function with rate
limiting. Both deferred to infra follow-up.

---

## Final disposition summary

| Priority | Total | Fixed | Migration | Deferred | N/A |
|---|---:|---:|---:|---:|---:|
| P0 | 10 | 5 | 4 | 2 | 1 |

(P0 #2 and #6 each count as both Fixed and Migration.)

## Required deployer actions before production cutover

1. Run migrations `006_schedule_unique_slot.sql` and
   `007_subagent_p0_rls_hardening.sql` in the Supabase SQL editor.
2. Deploy edge function `request-2fa-code`:
   `supabase functions deploy request-2fa-code`
3. Paste Mike's Supabase UID into `BIG_MIKE_COACH_UID` constant in
   `app.html` (search for the TODO marker).
4. Plan the deferred refactors (P0 #3, #5) before opening the portal
   to high-value clients.
