# Supabase + Twilio Setup Guide — Big Mike Ely Coaching Platform

Follow these steps IN ORDER. Each step depends on the one before it.

---

## PART 1 — SUPABASE DATABASE SETUP

**Step 1.** Go to https://supabase.com/dashboard and sign in. Open your project.

**Step 2.** Click "SQL Editor" in the left sidebar.

**Step 3.** Run each migration file in order:
- `supabase/migrations/001_create_tables.sql` — Creates 10 tables (clients, sessions, schedule, templates, meal_plans, programs, workouts, bookings, app_settings, app_state)
- `002_lock_down_rls.sql` — Security policies
- `003_messages.sql` — Messages table for client/coach chat
- `004_client_push.sql` — Client push notification subscriptions
- `005_inbox_rls.sql` — Inbox security policies

**Step 4.** Create the inbox table manually (if missing):
```sql
CREATE TABLE IF NOT EXISTS inbox (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE inbox ENABLE ROW LEVEL SECURITY;
```

**Step 5.** Create three Storage buckets (Storage > New bucket):
- `gallery` — Public bucket ON
- `checkin-photos` — Public bucket ON
- `message-attachments` — Public bucket ON

---

## PART 2 — COACH LOGIN (Supabase Auth)

**Step 6.** Go to Authentication > Users > Add user > Create new user.
Enter Mike's email and a strong password. **Save these credentials.**

**Step 7.** Go to Authentication > Settings:
- Site URL: `https://ifbbprobigmikeely.com`
- Redirect URLs: Add `https://ifbbprobigmikeely.com/app.html`

---

## PART 3 — VAPID KEYS (Push Notifications)

**Step 8.** On any computer with Node.js:
```bash
npm install -g web-push
web-push generate-vapid-keys
```
Save both the Public Key and Private Key.

**Step 9.** Store the public key in your database:
```sql
INSERT INTO app_settings (key, value)
VALUES ('vapid_public_key', '"YOUR_PUBLIC_KEY_HERE"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## PART 4 — TWILIO ACCOUNT

**Step 10.** Sign up at https://twilio.com

**Step 11.** From the Twilio Console, note:
- Account SID (starts with `AC`)
- Auth Token

**Step 12.** Buy a phone number with SMS capability. Note it in +1XXXXXXXXXX format.

---

## PART 5 — SET SECRETS

**Step 13.** Install and login to Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

**Step 14.** Set all secrets:
```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
supabase secrets set TWILIO_PHONE_NUMBER=+15551234567
supabase secrets set COACH_PHONE=+1MIKES_PHONE_NUMBER
supabase secrets set VAPID_PUBLIC_KEY=your_vapid_public_key
supabase secrets set VAPID_PRIVATE_KEY=your_vapid_private_key
supabase secrets set VAPID_SUBJECT=mailto:mike@bigmikeely.com
```

---

## PART 6 — DEPLOY EDGE FUNCTIONS

**Step 15.** Deploy all functions:
```bash
supabase functions deploy send-sms
supabase functions deploy send-push
supabase functions deploy send-client-push
supabase functions deploy send-client-message
supabase functions deploy find-client
supabase functions deploy verify-pin
supabase functions deploy reset-pin
supabase functions deploy confirm-booking
supabase functions deploy cancel-booking
supabase functions deploy auto-remind
supabase functions deploy daily-schedule
supabase functions deploy submit-onboarding
supabase functions deploy submit-checkin
supabase functions deploy square-booking
supabase functions deploy square-sync
```

---

## PART 7 — AUTO-REMIND CRON JOB

**Step 16.** Enable extensions: Database > Extensions > Enable `pg_cron` and `pg_net`

**Step 17.** Set up every-minute reminder check (runs every minute for precise 24-hour reminder timing):
```sql
SELECT cron.schedule(
  'auto-remind',
  '* * * * *',
  $$SELECT net.http_post(
    url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-remind',
    headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );$$
);
```

**Step 18 (Optional).** Daily morning schedule SMS at 6am ET:
```sql
SELECT cron.schedule(
  'daily-schedule-sms',
  '0 10 * * 1-6',
  $$SELECT net.http_post(
    url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-schedule',
    headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );$$
);
```

---

## PART 8 — CONFIGURE IN THE APP

**Step 19.** Open app.html, sign in with the email/password from Step 6.

**Step 20.** Go to Settings > SMS Configuration:
- Enter Mike's phone number
- Toggle "Send Coach Reminders" ON
- Tap "SAVE & CONNECT"

**Step 21.** Go to Settings > Push Notifications:
- Tap "ENABLE"
- Allow notifications when browser asks

---

## PART 9 — TESTING

| Test | What to do | Expected result |
|------|-----------|----------------|
| Database | Open app.html | Sync badge shows "Synced" |
| SMS | Settings > SMS > TEST SMS | Text arrives on Mike's phone |
| Push | Enable push in Settings | Notification appears on device |
| Client login | Open portal.html, enter client phone | PIN setup prompt appears |
| Booking | Open book.html, book a slot | SMS confirmation sent |
| Onboarding | Fill out onboard.html form | Prospect appears in Inbox |
| Check-in | Submit check-in in portal | Coach gets push notification |

---

## ALL TABLES

| Table | Purpose |
|-------|---------|
| clients | Client profiles and data |
| sessions | Legacy session logs (kept for data, no longer written to) |
| schedule | Booked sessions, earnings source |
| templates | Workout templates |
| meal_plans | Nutrition/meal plans |
| programs | Program builder data |
| workouts | Workout library |
| bookings | Client booking records |
| app_settings | Config key/value store |
| app_state | Auto-remind tracking |
| messages | Coach/client messaging |
| client_push_subs | Client push subscriptions |
| inbox | Lead/onboarding submissions |

## ALL SECRETS

| Secret | Source |
|--------|--------|
| TWILIO_ACCOUNT_SID | Twilio Console |
| TWILIO_AUTH_TOKEN | Twilio Console |
| TWILIO_PHONE_NUMBER | Twilio (bought number) |
| COACH_PHONE | Mike's real phone |
| VAPID_PUBLIC_KEY | web-push generate |
| VAPID_PRIVATE_KEY | web-push generate |
| VAPID_SUBJECT | mailto:mike@email.com |

## NOTE
The `reschedule-booking` edge function is called when Mike reschedules a session but the function file doesn't exist yet. It fails silently — the reschedule saves, just no SMS goes to the client. Can be added later.
