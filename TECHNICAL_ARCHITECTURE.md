# Big Mike Coaching Lab — Technical Architecture Document

## Context
This document is a developer-facing technical overview of the IFBB Pro Big Mike Ely coaching app at ifbbprobigmikeely.com. It explains how every external system is wired together, how data flows, and flags known issues. The app is a single-file SPA (`index.html`, ~2,164 lines of HTML+CSS+JS) hosted on GitHub Pages.

---

## 1. Hosting & Routing

| Layer | Detail |
|-------|--------|
| **Host** | GitHub Pages (repo: `dkfitcoaching-lab/bigmike`) |
| **Domain** | `ifbbprobigmikeely.com` via CNAME file |
| **Routing** | None — single `index.html`, all navigation is in-memory via `go()`/`push()`/`pop()` functions that swap DOM content. No hash routing, no History API. |
| **CDN deps** | Google Fonts (Cinzel, Rajdhani, IBM Plex Mono), Supabase JS SDK v2, jsPDF v2.5.2, html2canvas v1.4.1 — all loaded from CDNs in `<head>` |

**How it works:** GitHub Pages serves `index.html` for all requests. The app renders different "screens" by writing innerHTML into the `#app` container. A navigation stack (`navStack[]`) tracks history so `pop()` can go back.

---

## 2. Data Persistence — localStorage (Primary) + Supabase (Cloud Backup)

### localStorage (offline-first, always available)

All data lives in `localStorage` under the `fm_` prefix via a utility object `LS`:

```
LS.get(key, default)  → JSON.parse(localStorage["fm_" + key])
LS.set(key, value)    → localStorage["fm_" + key] = JSON.stringify(value)
```

**Core collections:**
- `fm_clients[]` — client profiles (name, phone, type, rate, program, measurements, notes)
- `fm_sessions[]` — logged training sessions (exercises, ratings, notes)
- `fm_schedule[]` — future scheduled sessions (date, time, status)
- `fm_templates[]` — reusable exercise templates
- `fm_mealPlans[]` — nutrition plans (meals → foods with macros)

**Config keys:** `fm_pin`, `fm_theme`, `fm_defaultRate`, `fm_gymCut`, `fm_supa_url`, `fm_supa_key`, `fm_coach_phone`, etc.

**Session state:** `sessionStorage["fm_unlocked"]` — cleared on tab close, forces PIN re-entry.

**Limit:** ~5 MB. `LS.space()` reports usage. No auto-archiving — data accumulates indefinitely.

### Supabase Cloud Sync (secondary, opt-in)

Activated when the user enters a Supabase URL + anon key in Settings.

**Push flow (local → cloud):**
```
Any data change → save() → cloudSync() [1.5s debounce] → _doCloudSync()
  → For each table (clients, sessions, schedule, templates, meal_plans):
      sb.from(table).upsert(rows, {onConflict: "id"})
  → Each row wrapped as: {id, data: <full object as JSONB>, updated_at: now}
```

**Pull flow (cloud → local):**
```
App boot / comes online → cloudPull(callback)
  → For each table: sb.from(table).select("data")
  → Merge logic: if cloud item ID not in local → add it
                  if cloud item newer by created_at → overwrite local
  → Then save() + callback (typically render())
```

**Database schema** (`supabase/migrations/001_create_tables.sql`):
- 5 tables, all identical structure: `id TEXT PK, data JSONB, updated_at TIMESTAMPTZ`
- RLS enabled but policies are `USING (true)` — wide open (single-user app behind PIN)
- Indexes on `sessions→data→clientId`, `schedule→data→date`, `meal_plans→data→clientId`

**Known issue:** Merge uses `created_at` comparison only. No vector clocks or CRDT — concurrent edits from two devices will last-write-win.

---

## 3. SMS Reminder System

### Architecture
```
index.html (client-side timer)
    → Supabase Edge Function (/functions/send-sms)
        → Twilio REST API
            → SMS delivered
```

### How it works step-by-step

1. **Checker loop:** `startSMSChecker()` runs `checkAndSendReminders()` immediately, then every 60 seconds via `setInterval`.

2. **Matching logic** (`checkAndSendReminders`):
   - Gets today's date as ISO string
   - Filters `schedule[]` for items where:
     - `date === today`
     - `status` is not "complete" or "cancelled"
     - `time` exists
     - Not already sent (checked against `localStorage["fm_sms_sent_<DATE>"]`)
   - Calculates minutes until session: `(sessionTimeMs - nowMs) / 60000`
   - Sends if `0 < minutesUntil <= reminderLeadMinutes` (default: 30 min)

3. **Phone formatting:** 10-digit numbers get "+1" prefix (US assumption). Already-formatted international numbers pass through.

4. **Message construction:**
   - To coach: `"Reminder: [ClientName] — [Type] at [Time] today. $[Rate]"`
   - To client (optional): separate notification if `sms_client_reminders` enabled

5. **Sending:** `sendSMS(to, message)` calls `sb.functions.invoke("send-sms", {body: {to, message}})` — this hits the Supabase Edge Function.

6. **Dedup:** After sending, stores `{sessionId: true}` in `localStorage["fm_sms_sent_<DATE>"]` to prevent re-sending.

7. **Cleanup:** `showLockScreen()` clears the interval to prevent background SMS when app is locked.

### Edge Function (`supabase/functions/send-sms/index.ts`)

```
POST request with JSON body: {to, message}
  → Validates both fields present
  → Reads from Deno env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
  → POST to https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
      Auth: Basic base64(SID:Token)
      Body: To={to}&From={TwilioNumber}&Body={message}
  → Returns {success, sid, status} or error
  → CORS headers for browser access
```

### What's needed to activate SMS
1. Supabase project with URL + anon key → entered in app Settings
2. Deploy the Edge Function: `supabase functions deploy send-sms`
3. Set Twilio secrets on Supabase: `supabase secrets set TWILIO_ACCOUNT_SID=xxx TWILIO_AUTH_TOKEN=xxx TWILIO_PHONE_NUMBER=xxx`
4. Enter coach phone number in app Settings
5. Toggle "SMS Reminders" on

### Known issues
- No retry on Edge Function failure — SMS silently fails
- No confirmation UI that SMS was actually delivered
- Phone formatting is US-only (10-digit → +1)
- No rate limiting on Twilio calls (60s check interval is the only throttle)

---

## 4. PDF Generation System

### Libraries
- **jsPDF v2.5.2** — creates the PDF document
- **html2canvas v1.4.1** — renders HTML elements to canvas images

### Pipeline (`_renderPDFToFile`)

```
1. Create hidden div (position:fixed, left:-9999px) in DOM
2. Build HTML "pages" array:
   - Page 0: Cover page (branded, client name, doc type, date)
   - Pages 1+: Content pages (meals/exercises/etc with header + footer)
3. For each page:
   - Inject HTML into hidden div
   - html2canvas(div, {scale:2, format:'jpeg', quality:0.95, useCORS:true})
   - Canvas → image data URL
   - jsPDF.addImage() onto letter-size portrait page
4. pdf.save("filename.pdf") → triggers browser download
5. Remove hidden div from DOM
```

### Three PDF types

| Function | Content | Filename |
|----------|---------|----------|
| `generateMealPlanPDF(mpId)` | Meal names, foods, macros per meal, totals vs targets | `[Client]_Meal_Plan.pdf` |
| `generateProgramPDF(idx)` | Training days, exercises, sets/reps/weight/tempo | `[Client]_Training_Program.pdf` |
| `generateFullPrepPDF(idx)` | Combined: program + all meal plans + comp info | `[Client]_Full_Prep.pdf` |

### Branding
- Cover page: "M" logo, "BIG MIKE ELY", "IFBB PRO COACHING LAB"
- Accent color: gold (`#D4A830`) or crimson (`#D03030`) based on theme setting
- Footer on every content page with lab name + generated date

### Known issues
- Requires internet (CDN libraries). If jsPDF/html2canvas fail to load → error toast
- All rendering is client-side — no server-side PDF generation
- Very long content may have pagination edge cases

---

## 5. PIN Security

| Aspect | Implementation |
|--------|---------------|
| Storage | `localStorage["fm_pin"]` — **plain text** |
| Default | `"1234"` |
| Validation | Direct string comparison |
| Session | `sessionStorage["fm_unlocked"] = "true"` — cleared on tab close |
| Rate limiting | **None** |

The PIN protects the UI only. All data in localStorage is accessible via browser dev tools regardless of PIN state. This is adequate for a single-user mobile PWA where the primary threat model is casual physical access, not a determined attacker.

---

## 6. PWA Status

The app has a `manifest.json` and mobile-web-app-capable meta tags, but **no service worker**. This means:
- It CAN be installed to home screen (browser will prompt)
- It will NOT work fully offline (CDN resources won't load without internet)
- localStorage data persists, so previously-loaded data is available
- The app detects online/offline via `window.addEventListener` and shows toasts

---

## 7. Food Database & Dietary Detection

### FOOD_DB
~50+ items, each with: `name, cal, protein, carbs, fat, unit, servingSize, category (P/C/F/V), tags`

Tags: `gf` (gluten-free), `df` (dairy-free), `lc` (low-carb), `hp` (high-protein), `kf` (keto-friendly), `lf` (low-fat)

### Smart filtering
`detectDietaryRestrictions(clientId)` scans a client's `medical + injuries + notes + goals` fields for keywords (e.g., "celiac" → `gf`, "lactose" → `df`, "keto" → `kf`).

`getFilteredFoodDB(clientId)` returns only foods whose tags include ALL detected restrictions. Shows a "FILTERED" badge in the meal plan UI.

**Note:** The filtering is AND-logic (strict intersection). A client tagged `gf + df` only sees foods that are BOTH gluten-free AND dairy-free.

---

## Summary of External Dependencies

```
┌──────────────────────────────┐
│       GitHub Pages           │
│   (serves index.html)        │
│   ifbbprobigmikeely.com      │
└──────────┬───────────────────┘
           │
    ┌──────▼──────────────────────────────────────┐
    │            index.html (browser)              │
    │                                              │
    │  localStorage ←→ Supabase DB (JSONB cloud)   │
    │                                              │
    │  SMS timer → Supabase Edge Fn → Twilio API   │
    │                                              │
    │  PDF: html2canvas → jsPDF → browser download │
    │                                              │
    │  CDN: Google Fonts, Supabase SDK,            │
    │       jsPDF, html2canvas                     │
    └──────────────────────────────────────────────┘
```

All business logic runs client-side. The only server-side component is the Supabase Edge Function for SMS. Supabase DB is used purely as a JSON document store for cloud backup — not as a relational database.
