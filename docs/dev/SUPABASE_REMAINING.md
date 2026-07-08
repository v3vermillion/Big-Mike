# Supabase — Remaining Wiring Items

These are infrastructure items that need to be done in the Supabase dashboard when you're ready to connect everything. The code is already written — these are the backend pieces.

---

## ALREADY IN THE MAIN SETUP GUIDE (SUPABASE_TWILIO_SETUP.md)

Everything in that file is still accurate. Follow it in order. The items below are ADDITIONS on top of that guide.

---

## 1. Storage Bucket: message-attachments

**Where:** Supabase Dashboard > Storage > New Bucket

- Bucket name: `message-attachments`
- Public: ON
- This is for photo/video attachments in the coach-client messaging system
- Already added to Step 5 of the setup guide

---

## 2. Cron Job: auto-remind timing

**Changed from:** every 5 minutes (`*/5 * * * *`)
**Changed to:** every 1 minute (`* * * * *`)

This is for precise 24-hour-before-session reminders. The setup guide already has the updated timing. When you run the cron setup SQL, use the version in the guide — it's correct.

---

## 3. Message data leakage note (not urgent, single-coach is fine)

The coach app's `startMsgPolling()` function fetches ALL messages from the messages table without filtering by coach. Since Mike is the only coach, this works correctly — he sees all his client messages.

**If you ever sell this to a second coach**, you'd need to add a coach identifier to the messages table and filter the query. For now, no action needed.

---

## 4. Push notification subscription (single-coach is correct)

The coach push subscription is stored in `app_settings` with key `push_subscription`. This is a single global subscription — Mike's device. Since there's only one coach, this is correct.

**If multi-coach in the future**, create a `coach_subscriptions` table. For now, no action needed.

---

## 5. Edge functions that need Twilio (work without it via push)

These edge functions attempt to send SMS via Twilio AND push notifications. If Twilio isn't configured yet, SMS silently skips and push handles it alone:

- `auto-remind` — 24-hour session reminders (push to both Mike and client)
- `cancel-booking` — cancellation notifications (push to the other party)
- `daily-schedule` — morning schedule summary (push to Mike)
- `send-sms` — direct SMS sending (fails gracefully without Twilio)
- `confirm-booking` — booking confirmations

**When Twilio is ready**, just set the secrets and redeploy. Both channels will fire automatically. No code changes needed.

---

## 6. Reschedule edge function

The `reschedule-booking` edge function is called from the coach app when Mike changes a session's date/time, but the function file may be incomplete. Check `supabase/functions/reschedule-booking/index.ts` — if it's a stub, build it to match `cancel-booking` (send SMS to client about the time change + push notification).

The push notification for reschedule is already handled client-side in app.html (added in this session). The edge function is just for the SMS component.

---

## SUMMARY — What to do when you sit down at the computer

1. Open `SUPABASE_TWILIO_SETUP.md` and follow Steps 1-21
2. When you get to Step 5, create THREE buckets (gallery, checkin-photos, message-attachments)
3. When you get to Step 17, the cron is already set to every minute
4. Deploy all edge functions as listed in Step 15
5. Set Twilio secrets when your Twilio account is verified
6. Everything else works immediately via push notifications
