import { corsHeaders } from "../_shared/cors.ts";

async function sendSMS(
  to: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = btoa(`${accountSid}:${authToken}`);

  const body = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: message,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const data = await res.json();
    return {
      success: false,
      error: data.message || `Twilio error: ${res.status}`,
    };
  }

  return { success: true };
}

function formatDate(dateStr: string, timeStr: string): string {
  try {
    const days = [
      "Sunday", "Monday", "Tuesday", "Wednesday",
      "Thursday", "Friday", "Saturday",
    ];
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    const d = new Date(`${dateStr}T${timeStr}`);
    if (isNaN(d.getTime())) return `${dateStr} at ${timeStr}`;

    const dayName = days[d.getDay()];
    const monthName = months[d.getMonth()];
    const dayNum = d.getDate();

    let hours = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    return `${dayName}, ${monthName} ${dayNum} at ${hours}:${mins} ${ampm}`;
  } catch {
    return `${dateStr} at ${timeStr}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      scheduleId,
      clientName,
      clientPhone,
      date,
      time,
      type,
      cancelledBy,
    } = await req.json();

    if (!clientName || !cancelledBy) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: clientName, cancelledBy",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Require auth for coach-initiated cancellations
    if (cancelledBy === "coach") {
      const authHeader = req.headers.get("Authorization") || "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!authHeader.includes(serviceKey) && !authHeader.includes("Bearer " + serviceKey)) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const coachPhone = Deno.env.get("COACH_PHONE");
    const formattedDate =
      date && time ? formatDate(date, time) : "your upcoming session";
    const sessionDesc = type ? `${type} session` : "session";

    let result: { success: boolean; error?: string };

    if (cancelledBy === "coach") {
      // Coach cancelled -- notify the client
      if (!clientPhone) {
        return new Response(
          JSON.stringify({
            error: "clientPhone required when cancelledBy is coach",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const msg =
        `Hi ${clientName}, your ${sessionDesc} on ${formattedDate} with Coach Big Mike has been cancelled. Please reach out to reschedule.`;

      result = await sendSMS(clientPhone, msg);
    } else {
      // Client cancelled -- notify the coach
      if (!coachPhone) {
        return new Response(
          JSON.stringify({ error: "COACH_PHONE not configured" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const msg =
        `${clientName} has cancelled their ${sessionDesc} on ${formattedDate}.${scheduleId ? ` (ID: ${scheduleId})` : ""}`;

      result = await sendSMS(coachPhone, msg);
    }

    // Send push notification alongside SMS (works even if Twilio fails)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (supabaseUrl && serviceKey) {
      try {
        if (cancelledBy === "coach" && scheduleId) {
          // Coach cancelled — push to client
          // Need clientId; try to extract from scheduleId context
          const { data: schedRow } = await (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(supabaseUrl, serviceKey)
            .from("schedule").select("data").eq("id", scheduleId).single();
          const cId = schedRow?.data?.clientId;
          if (cId) {
            await fetch(`${supabaseUrl}/functions/v1/send-client-push`, {
              method: "POST",
              headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                clientId: cId,
                title: "Session Cancelled",
                body: `Your ${type || "session"} on ${formattedDate} has been cancelled by Coach Mike. Reach out to reschedule.`,
                type: "cancellation",
                tag: `cancel-${scheduleId}`,
                url: "./portal.html",
              }),
            });
          }
        } else {
          // Client cancelled — push to coach
          await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Session Cancelled",
              body: `${clientName} cancelled their ${type || "session"} on ${formattedDate}`,
              type: "cancellation",
              tag: `cancel-${scheduleId || Date.now()}`,
              url: "./app.html#schedule",
            }),
          });
        }
      } catch { /* push is best-effort */ }
    }

    // SMS may have failed but push may have succeeded — return based on overall attempt
    if (!result.success) {
      // SMS failed but push may have worked — still report partial success
      return new Response(
        JSON.stringify({ success: false, error: result.error, pushAttempted: true }),
        {
          status: 200, // Not 500 — push may have delivered
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("cancel-booking error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
