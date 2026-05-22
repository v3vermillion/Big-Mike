import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Deploy, then set up cron in Supabase Dashboard:
// SELECT cron.schedule('daily-schedule-sms', '0 10 * * 1-6',
//   $$SELECT net.http_post(
//     url:='https://YOUR_PROJECT.supabase.co/functions/v1/daily-schedule',
//     headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
//   );$$
// );
// NOTE: Cron is in UTC. 10:00 UTC = 5:00 AM EST / 6:00 AM EDT.
// Adjust for daylight saving if needed. 1-6 = Mon-Sat (no Sunday).

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
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
    const coachPhone = Deno.env.get("COACH_PHONE");

    const hasTwilio = !!(twilioSid && twilioAuth && twilioFrom);

    // Check if daily schedule SMS is enabled
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: prefData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "daily_schedule_sms")
      .single();

    if (!prefData?.value?.enabled) {
      return new Response(
        JSON.stringify({ message: "Daily schedule SMS is disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get today's date in US Eastern
    const now = new Date();
    const tz = "America/New_York";
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = dtf.formatToParts(now);
    const yy = parts.find(p => p.type === "year")!.value;
    const mm = parts.find(p => p.type === "month")!.value;
    const dd = parts.find(p => p.type === "day")!.value;
    const today = `${yy}-${mm}-${dd}`;

    // Check day of week (skip Sunday)
    const dayOfWeek = new Date(`${today}T12:00:00`).getDay();
    if (dayOfWeek === 0) {
      return new Response(
        JSON.stringify({ message: "Sunday - no schedule text" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch today's schedule
    const { data: scheduleRows, error } = await supabase
      .from("schedule")
      .select("data");

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch schedule: " + error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const todaySessions = (scheduleRows || [])
      .map((r: any) => r.data)
      .filter((s: any) => s.date === today && s.status !== "cancelled" && s.status !== "complete")
      .sort((a: any, b: any) => (a.time || "").localeCompare(b.time || ""));

    // Build the message
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let msg = `Good morning Mike! Here's your schedule for ${dayNames[dayOfWeek]}, ${mm}/${dd}:\n\n`;

    let totalRev = 0;
    if (todaySessions.length === 0) {
      msg += "No sessions scheduled today. Enjoy your free time!";
    } else {
      for (const s of todaySessions) {
        const time = formatTime(s.time);
        msg += `${time} - ${s.clientName || "Client"} (${s.type || "Training"})${s.rate ? " $" + s.rate : ""}\n`;
        totalRev += parseFloat(s.rate || "0");
      }
      msg += `\n${todaySessions.length} session${todaySessions.length !== 1 ? "s" : ""}`;
      if (totalRev > 0) msg += ` | $${totalRev} projected`;
    }

    // Send push notification to coach
    let pushSent = false;
    try {
      const pushBody = todaySessions.length === 0
        ? "No sessions scheduled today"
        : `${todaySessions.length} session${todaySessions.length !== 1 ? "s" : ""} today` +
          (totalRev > 0 ? ` · $${totalRev} projected` : "");
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Today's Schedule — ${dayNames[dayOfWeek]}`,
          body: pushBody,
          type: "general",
          tag: `daily-${today}`,
          url: "./app.html#schedule",
        }),
      });
      pushSent = true;
    } catch { /* push is best-effort */ }

    // Send SMS if Twilio is configured
    let smsSent = false;
    if (hasTwilio) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const authHeader = "Basic " + btoa(`${twilioSid}:${twilioAuth}`);
      const phone = prefData?.value?.phone || coachPhone;
      if (phone) {
        const res = await fetch(twilioUrl, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: phone, From: twilioFrom!, Body: msg }).toString(),
        });
        smsSent = res.ok;
      }
    }

    return new Response(
      JSON.stringify({ pushSent, smsSent, sessions: todaySessions.length }),
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
