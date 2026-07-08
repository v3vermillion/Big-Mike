# Big Mike Ely Coaching Platform — Master Execution Plan
## Agency-Level Overhaul — Zero Bugs, 100/100 Quality

**Created:** 2026-04-11
**Status:** IN PROGRESS
**Branch:** claude/coaching-portal-audit-oclfA

---

## Overview

Complete overhaul of the Big Mike Ely coaching platform to agency-level quality. Every button works, every view is premium, every device is tested, zero bugs.

### Files
- `app.html` — Coach's private portal (4 tabs: Home, Clients, Schedule, Programs)
- `portal.html` — Client's private portal (login with phone + PIN)
- `index.html` — Public landing page / website
- `book.html` — Client booking page
- `onboard.html` — New client intake questionnaire
- `sw.js` — Service worker (push notifications, caching)

---

## PHASE 1: Core Safety + Login Fix
**Scope: Small | Risk: Low | Dependencies: None**

### 1A. Fix iOS Login Screen Jitter
- **File:** app.html, line ~487-491
- The `focusout` handler resets scroll position after iOS keyboard dismiss
- On the auth/lock screen (position:fixed), this causes visible jitter
- **Fix:** Guard the handler — skip when auth or lock screen is visible
- **Test:** iOS Safari, tap in/out of email field on auth screen — no jitter

### 1B. Backup Data Layer
- Verify `exportData()` captures all stores before major changes

---

## PHASE 2: Session Log Removal + Earnings Rewire
**Scope: Large | Risk: HIGH | Dependencies: Phase 1**

### Design Decision (confirmed by user):
- Mike tracks revenue but NOT individual exercises/workouts
- Clients NEVER see prices — cash is handled in person
- Each client has a default session rate (set once, auto-applies)
- Mike can override price per individual session
- When a session completes on the Schedule, that rate feeds into monthly earnings
- Home screen shows: total earned, 20% gym cut (configurable), take-home
- Month resets on the 1st
- NO separate payment system — just tracking what he earned

### 2A. Rewire Earnings to Schedule Data
- `renderHome()` earnings: change `sessions.filter()` → `schedule.filter(s => s.status==="complete")`
- `renderEarningsChart()`: same change
- `renderSettings()` stats: same change
- Client detail per-client earnings: same change
- Weekly overview: same change
- `getGymCut()`: no change needed (reads from Settings)

### 2B. Remove Session Log Tab
- Remove from `TABS[]` array (5 entries → 4)
- Update `go()` — remove unsaved session warning
- Update `render()` — remove sessions renderer
- Update `completeScheduled()` — mark complete directly instead of opening session logger
- Update client detail "LOG SESSION" button — create completed schedule entry
- Remove unpaid sessions alert (or convert to schedule-based)
- DO NOT delete old functions — just make unreachable

### 2C. Verify Earnings Chain
- Create schedule entries with rates → mark complete → verify Home shows correct numbers
- Test gym cut calculation, month-over-month, projected earnings
- Test with zero data, test per-client, test mixed months

---

## PHASE 3: Program Builder Consolidation
**Scope: Medium | Risk: Medium | Dependencies: None (parallel with Phase 2)**

### Design Decision (confirmed by user):
- ONE builder only — the Wizard (step-by-step flow)
- All databases (foods, exercises, anabolics, supplements, etc.) consolidated into the Wizard
- Zero duplicates across databases
- Each category has subcategories (alphabetized) and search bar
- Smart dietary restriction detection from client profile
- "Save as Reusable Program" (not "template" — Mike won't understand that word)
- Three end actions: Save PDF to files, Save reusable copy, Send to client
- Client name auto-removed from reusable copies
- Push notification to client on send

### 3A. Reroute Entry Points
- `startWizardForClient()` line ~2829: use `wizLoadProgram()` instead of `_editProgram`
- `doUseTemplate()` line ~2858: same
- Remove "PROGRAM" from client detail subtabs

### 3B. Make Old Builders Unreachable
- Comment out `if(_editProgram) return renderProgramBuilder()` in renderNutrition
- Leave all old functions in place (dead code, safe cleanup later)

### 3C. Database Consolidation
- Verify all foods, exercises, compounds from old builders exist in Wizard's databases
- Check for duplicates across FOOD_DB, EXERCISE_DB, ANABOLICS_DB, SUPP_DB, ORGAN_SUPPORT_DB
- Ensure search bars work with case-insensitive matching

---

## PHASE 4: Coach Tutorial System
**Scope: Medium | Risk: Low | Dependencies: Phase 2 (tab changes)**

- Update tutorial steps to match 4-tab layout
- Remove "Session Log" step
- Login-count auto-hide (show for first 3 logins, then stop)
- Skip button always available
- On/off toggle in Settings
- Premium animated overlays
- Make it the coolest, most helpful walkthrough ever

---

## PHASE 5: Settings Audit
**Scope: Small | Risk: Low | Dependencies: Phase 2**

### Coach Settings (app.html):
- Test every setting: Profile, Gym Cut %, Theme, SMS, Push, Security, Backup
- Remove any broken/non-functional settings
- Update stats to use schedule-based data

### Client Settings (portal.html):
- Test: Text Size, Theme, Push Notifications, Change PIN, 2FA
- Verify all persist correctly

---

## PHASE 6: Landing Page Overhaul
**Scope: Large | Risk: Medium | Dependencies: None (parallel)**

### 6A. Hero Text
- "BIG MIKE ELY" larger, positioned to cover midsection
- "TRAINER OF CHAMPIONS" as subtitle
- "Since 1996" separated — smaller, different placement

### 6B. Track Record Section
- Remove OR significantly upgrade the 4 stat cards
- Fix inaccurate numbers
- Agency-level visual quality

### 6C. Contact/Inquiry Reorganization
- Move "Start Here" to nav (not stacked under inquiry form)
- Keep "Message Mike" contact form in its section
- Clear distinction between inquiry (question) and onboarding (become a client)

### 6D. Gallery Overhaul
- Move off main scroll → nav-triggered overlay/page
- Premium layout, larger images, better spacing
- Keep lightbox system

### 6E. Menu/Navigation
- Logical order: Hero → About → Results → Services → Contact → CTA
- Gallery accessible from menu only
- Professional hierarchy and organization

### 6F. Loading Animations
- Perfect all scroll-reveal animations
- Verify brand reveal transitions cleanly
- Staggered entrance animations

---

## PHASE 7: Booking Page
**Scope: Large | Risk: Medium | Dependencies: Supabase**

- Make book.html functional (currently placeholder)
- Phone entry → session type → calendar → time slots → confirmation
- Creates schedule entry in coach's app
- SMS confirmation to client + notification to coach

---

## PHASE 8: Client Portal Premium Polish
**Scope: Large | Risk: Medium | Dependencies: Phases 2-3**

### 8A. Visual Polish
- Every button 44px+ touch targets
- Premium animations, typography, spacing
- Agency-level quality throughout

### 8B. Client Tutorial
- First-login premium walkthrough
- Steps: Welcome → View Program → Download PDF → Messages → Settings
- Skip button, auto-dismiss after completion

### 8C. PDF Download
- Premium branded PDF (matches coach's $5M quality)
- Actually saves to device files (not browser void)
- Confirmation with device-appropriate icon
- Works on iOS Safari, Android Chrome, desktop

### 8D. Add to Home Screen
- PWA manifest for portal
- Smart install prompt (Chrome/Android auto, iOS instructional overlay)
- Device-specific guidance
- Track installation status

### 8E. Security
- Verify PIN, 2FA, forgot PIN all work
- Session timeout for inactivity
- All accounts secure

### 8F. Login Screen Enhancement
- Add Mike's photo as background (subtle, darkened)
- Fix zoom in/out on scroll
- Position login card to cover midsection
- Premium visual treatment

---

## PHASE 9: Premium PDF System
**Scope: Large | Risk: Medium | Dependencies: Phase 3**

### THE $5M PDF:
- NOT a Google Doc or Excel sheet
- Premium branded document with:
  - Mike's logo and branding
  - Gold/crimson gradient accents matching app theme
  - Professional typography (Cinzel headings, Rajdhani body, IBM Plex Mono data)
  - Section dividers, tables, proper spacing
  - Cover page with client name, program title, date
  - Sections in the exact order Mike arranged them
- Must handle large programs (all sections filled)
- Must save to device files on ALL platforms
- Coach and client PDFs must look identical
- Max page safety limit with warning

---

## PHASE 10: Supabase + Twilio Wiring
**Scope: Medium | Risk: Medium | Dependencies: Production credentials**

### Already Built:
- send-sms, send-push, send-client-push, auto-remind, confirm-booking, cancel-booking edge functions

### Still Needed:
- VAPID key generation and storage
- Service worker push event handlers (sw.js)
- Real-time data sync (Supabase Realtime subscriptions)
- pg_cron for auto-remind (every minute)
- Zero-delay notification delivery

### Required Secrets:
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT
- COACH_PHONE

### Deployment Commands:
```bash
supabase functions deploy send-sms send-push send-client-push auto-remind confirm-booking cancel-booking
supabase secrets set TWILIO_ACCOUNT_SID=xxx TWILIO_AUTH_TOKEN=xxx TWILIO_PHONE_NUMBER=xxx
npx web-push generate-vapid-keys --json
```

---

## PHASE DEPENDENCY MAP

```
Phase 1 (Login Fix) ────────────┐
                                 ├──→ Phase 2 (Session Log + Earnings)
Phase 3 (Builder) ──────[parallel]       │
                                 │       ├──→ Phase 4 (Coach Tutorial)
Phase 6 (Landing) ──────[parallel]       ├──→ Phase 5 (Settings)
                                 │       ├──→ Phase 8 (Portal Polish)
Phase 7 (Booking) ──────[parallel]       ├──→ Phase 9 (PDF System)
                                 │       │
Phase 10 (Supabase) ────[parallel, needs credentials]
```

---

## QUALITY STANDARDS

- Every button clicked and tested on desktop (1440x900) and mobile (390x844)
- Every view screenshotted and visually verified
- Zero rapid-tap bugs (send locks, nav locks on all actions)
- Zero undefined function references
- JavaScript syntax validation passes on every file
- No broken scroll behavior on iOS
- No hardcoded colors where CSS variables should be used
- Premium visual quality throughout — agency poster example
- PDF actually saves to device files, confirmed on all platforms
- Push notifications deliver with zero delay
- All data persists correctly across sessions
- All client data secure and private
