import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Fire-and-forget push notification to coach's device */
async function sendCoachPush(supabaseUrl: string, supabaseKey: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch { /* push is best-effort */ }
}

/** Fire-and-forget push notification to a client's device */
async function sendClientPush(supabaseUrl: string, supabaseKey: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-client-push`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch { /* push is best-effort */ }
}

/** Try to send SMS via Twilio — returns false if Twilio not configured (not an error) */
async function trySendSMS(to: string, message: string): Promise<boolean> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!sid || !auth || !from) return false; // Twilio not configured — skip silently
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(`${sid}:${auth}`), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Body: message }).toString(),
    });
    return res.ok;
  } catch { return false; }
}

// Deploy this function, then set up a cron job:
// SELECT cron.schedule('auto-remind', '* * * * *', $$SELECT net.http_post(url:='https://YOUR_PROJECT.supabase.co/functions/v1/auto-remind', headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb);$$);
// Runs every MINUTE for precise 24-hour reminder timing.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const coachPhone = Deno.env.get("COACH_PHONE") || "";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Current time in US Eastern
    const now = new Date();
    const tz = "America/New_York";
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = dtf.formatToParts(now);
    const yy = parts.find(p => p.type === "year")!.value;
    const mm = parts.find(p => p.type === "month")!.value;
    const dd = parts.find(p => p.type === "day")!.value;
    const today = `${yy}-${mm}-${dd}`;

    // Tomorrow's date
    const tmrw = new Date(now);
    tmrw.setDate(tmrw.getDate() + 1);
    const tf2 = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const tp2 = tf2.formatToParts(tmrw);
    const tomorrow = `${tp2.find(p => p.type === "year")!.value}-${tp2.find(p => p.type === "month")!.value}-${tp2.find(p => p.type === "day")!.value}`;

    // Current time in minutes (ET)
    const tf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hour12: false });
    const tp = tf.formatToParts(now);
    const currentHr = parseInt(tp.find(p => p.type === "hour")!.value);
    const currentMn = parseInt(tp.find(p => p.type === "minute")!.value);
    const currentMinutes = currentHr * 60 + currentMn;

    // Fetch all schedule entries
    const { data: scheduleRows, error } = await supabase
      .from("schedule")
      .select("data")
      .order("updated_at", { ascending: false });

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch schedule: " + error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allSessions = (scheduleRows || []).map((r: any) => r.data);

    // Get already-sent reminders tracking
    const sentKey24 = `reminders_24h_${today}`;
    const { data: sent24Data } = await supabase.from("app_state").select("data").eq("id", sentKey24).single();
    const sent24: Record<string, boolean> = sent24Data?.data || {};

    const results: any[] = [];

    // ═══════════════════════════════════════════════════════
    // 24-HOUR REMINDER — Client gets notified exactly 24h before
    // Check tomorrow's sessions, match against current time
    // ═══════════════════════════════════════════════════════
    const tomorrowSessions = allSessions.filter((s: any) => {
      if (s.date !== tomorrow) return false;
      if (s.status === "complete" || s.status === "cancelled") return false;
      if (!s.time) return false;
      if (sent24[s.id]) return false;

      const [hr, min] = s.time.split(":").map(Number);
      const sessMinutes = hr * 60 + min;
      // Match if session time tomorrow equals current time (within 2-minute window)
      // e.g., session at 8:36 PM tomorrow → fire at 8:35-8:37 PM today
      const diff = Math.abs(sessMinutes - currentMinutes);
      return diff <= 2;
    });

    for (const s of tomorrowSessions) {
      const timeStr = formatTime(s.time);
      const clientFirstName = (s.clientName || "").split(" ")[0] || "Hey";

      // Push to client
      if (s.clientId) {
        await sendClientPush(supabaseUrl, supabaseKey, {
          clientId: s.clientId,
          title: "Session Tomorrow",
          body: `${s.type || "Training"} with Coach Mike tomorrow at ${timeStr} ET`,
          type: "session_reminder",
          tag: `remind24-${s.id}`,
          url: "./portal.html",
        });
      }

      // SMS to client (if Twilio configured and client has phone)
      if (s.clientPhone) {
        await trySendSMS(s.clientPhone,
          `Hey ${clientFirstName}, reminder: ${s.type || "training"} session tomorrow at ${timeStr} ET with Coach Mike. See you there!`
        );
      }

      // Push to coach
      await sendCoachPush(supabaseUrl, supabaseKey, {
        title: "Tomorrow's Session",
        body: `${s.clientName || "Client"} — ${s.type || "Training"} at ${timeStr}`,
        type: "session_reminder",
        tag: `remind24-coach-${s.id}`,
        url: "./app.html#schedule",
        sessionId: s.id,
      });

      // SMS to coach (if configured)
      if (coachPhone) {
        await trySendSMS(coachPhone,
          `Tomorrow: ${s.clientName || "Client"} — ${s.type || "Training"} at ${timeStr}.${s.rate ? " $" + s.rate : ""}`
        );
      }

      sent24[s.id] = true;
      results.push({ id: s.id, client: s.clientName, type: "24h_reminder", time: timeStr });
    }

    // Save tracking state
    if (tomorrowSessions.length) {
      await supabase.from("app_state").upsert(
        { id: sentKey24, data: sent24, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
    }

    return new Response(
      JSON.stringify({ sent: results.length, results, checked: allSessions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatTime(t: string): string {
  if (!t) return "TBD";
  const [hr, min] = t.split(":");
  const h = parseInt(hr);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${min} ${ap}`;
}
