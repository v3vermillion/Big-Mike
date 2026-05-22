import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Square Webhook Receiver — Two-way sync between Square Bookings and BigMike app
//
// Setup:
// 1. Go to https://developer.squareup.com/apps → select your app
// 2. Under Webhooks, subscribe to: booking.created, booking.updated, booking.cancelled
// 3. Set the webhook URL to: https://YOUR_PROJECT.supabase.co/functions/v1/square-sync
// 4. Set these secrets in Supabase Edge Functions:
//    - SQUARE_WEBHOOK_SIGNATURE_KEY (from Square webhook subscription)
//    - SQUARE_ACCESS_TOKEN (from Square app credentials)
//    - COACH_PHONE (Mike's phone for notifications)

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
    const squareToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
    const coachPhone = Deno.env.get("COACH_PHONE");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();

    // Square sends event_type at top level
    const eventType = body.type || body.event_type || "";
    const bookingData = body.data?.object?.booking || body.data?.booking || {};

    if (!bookingData.id) {
      return new Response(
        JSON.stringify({ message: "No booking data in webhook" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch full booking details from Square API if we have the token
    let booking = bookingData;
    if (squareToken && bookingData.id) {
      try {
        const sqRes = await fetch(`https://connect.squareapis.com/v2/bookings/${bookingData.id}`, {
          headers: {
            "Square-Version": "2024-01-18",
            "Authorization": `Bearer ${squareToken}`,
            "Content-Type": "application/json",
          },
        });
        if (sqRes.ok) {
          const sqData = await sqRes.json();
          booking = sqData.booking || bookingData;
        }
      } catch { /* Use webhook data as fallback */ }
    }

    // Extract booking info
    const startAt = booking.start_at || "";
    const customerNote = booking.customer_note || "";
    const status = booking.status || "";
    const customerId = booking.customer_id || "";

    // Parse date/time from ISO
    let date = "";
    let time = "";
    if (startAt) {
      const dt = new Date(startAt);
      date = dt.toISOString().split("T")[0];
      time = dt.toTimeString().substring(0, 5);
    }

    // Look up customer name from Square if possible
    let customerName = "Square Booking";
    let customerPhone = "";
    if (squareToken && customerId) {
      try {
        const custRes = await fetch(`https://connect.squareapis.com/v2/customers/${customerId}`, {
          headers: {
            "Square-Version": "2024-01-18",
            "Authorization": `Bearer ${squareToken}`,
            "Content-Type": "application/json",
          },
        });
        if (custRes.ok) {
          const custData = await custRes.json();
          const cust = custData.customer;
          customerName = [cust.given_name, cust.family_name].filter(Boolean).join(" ") || "Square Booking";
          customerPhone = cust.phone_number || "";
        }
      } catch { /* Use default name */ }
    }

    const schedId = "sq_" + bookingData.id;

    if (eventType.includes("created") || eventType.includes("updated")) {
      // Upsert into our schedule table
      const entry = {
        id: schedId,
        clientId: customerId ? "sq_" + customerId : "",
        clientName: customerName,
        clientPhone: customerPhone,
        date: date,
        time: time,
        type: "Training",
        rate: "",
        status: status === "CANCELLED_BY_CUSTOMER" || status === "CANCELLED_BY_SELLER" ? "cancelled" : "pending",
        notes: customerNote,
        source: "square",
        created_at: new Date().toISOString(),
      };

      await supabase.from("schedule").upsert(
        { id: schedId, data: entry, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );

      // Notify Mike of new booking
      if (eventType.includes("created") && twilioSid && twilioAuth && twilioFrom && coachPhone) {
        const msg = `New Square booking: ${customerName} on ${date} at ${formatTime(time)}${customerNote ? " — Note: " + customerNote : ""}`;
        await sendSMS(twilioSid, twilioAuth, twilioFrom, coachPhone, msg);
      }
    } else if (eventType.includes("cancelled")) {
      // Mark as cancelled in our schedule
      const { data: existing } = await supabase
        .from("schedule")
        .select("data")
        .eq("id", schedId)
        .single();

      if (existing?.data) {
        const updated = { ...existing.data, status: "cancelled" };
        await supabase.from("schedule").upsert(
          { id: schedId, data: updated, updated_at: new Date().toISOString() },
          { onConflict: "id" }
        );
      }

      // Notify Mike of cancellation
      if (twilioSid && twilioAuth && twilioFrom && coachPhone) {
        const msg = `Square cancellation: ${customerName} cancelled their session on ${date} at ${formatTime(time)}`;
        await sendSMS(twilioSid, twilioAuth, twilioFrom, coachPhone, msg);
      }
    }

    return new Response(
      JSON.stringify({ success: true, event: eventType, bookingId: bookingData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendSMS(sid: string, auth: string, from: string, to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${sid}:${auth}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
}

function formatTime(t: string): string {
  if (!t) return "TBD";
  const [hr, min] = t.split(":");
  const h = parseInt(hr);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${min} ${ap}`;
}
