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
    const { phone, name, date, time, type, inquiry, notes } = await req.json();

    if (!phone || !name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone, name" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const coachPhone = Deno.env.get("COACH_PHONE");
    const results: { client?: boolean; coach?: boolean; errors: string[] } = {
      errors: [],
    };

    if (inquiry) {
      // Inquiry flow
      const clientMsg =
        `Thank you for your inquiry, ${name}! Coach Big Mike has received your message and will get back to you shortly.`;

      const clientResult = await sendSMS(phone, clientMsg);
      results.client = clientResult.success;
      if (!clientResult.success) {
        results.errors.push(`Client SMS: ${clientResult.error}`);
      }

      if (coachPhone) {
        const coachMsg =
          `New inquiry from ${name} (${phone}):\n"${inquiry}"${notes ? `\nNotes: ${notes}` : ""}`;

        const coachResult = await sendSMS(coachPhone, coachMsg);
        results.coach = coachResult.success;
        if (!coachResult.success) {
          results.errors.push(`Coach SMS: ${coachResult.error}`);
        }
      }
    } else {
      // Booking confirmation flow
      const formattedDate = formatDate(date, time);
      const clientMsg =
        `Your ${type || "session"} with Coach Big Mike is confirmed for ${formattedDate}. See you there!`;

      const clientResult = await sendSMS(phone, clientMsg);
      results.client = clientResult.success;
      if (!clientResult.success) {
        results.errors.push(`Client SMS: ${clientResult.error}`);
      }

      if (coachPhone) {
        const coachMsg =
          `New booking: ${name} - ${type || "Session"} on ${formattedDate}${notes ? `\nNotes: ${notes}` : ""}`;

        const coachResult = await sendSMS(coachPhone, coachMsg);
        results.coach = coachResult.success;
        if (!coachResult.success) {
          results.errors.push(`Coach SMS: ${coachResult.error}`);
        }
      }
    }

    // Fire-and-forget push notification
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseKey) {
        fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: inquiry ? "New Inquiry" : "New Booking",
            body: inquiry
              ? `${name}: "${inquiry.substring(0, 80)}"`
              : `${name} — ${type || "Session"} on ${formatDate(date, time)}`,
            type: inquiry ? "general" : "new_booking",
            tag: inquiry ? `inquiry-${Date.now()}` : `booking-${Date.now()}`,
            url: "./app.html#schedule",
          }),
        });
      }
    } catch { /* push is best-effort */ }

    const allSucceeded = results.errors.length === 0;
    return new Response(
      JSON.stringify({
        success: allSucceeded,
        client: results.client,
        coach: results.coach,
        ...(results.errors.length > 0 && { errors: results.errors }),
      }),
      {
        status: allSucceeded ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("confirm-booking error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
