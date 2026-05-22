import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sendViaTwilio(
  to: string,
  message: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
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

  const data = await res.json();

  if (!res.ok) {
    return {
      success: false,
      error: data.message || `Twilio error: ${res.status}`,
    };
  }

  return { success: true, sid: data.sid };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, message } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate recipient is a known client or the coach
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);
    const { data: clients } = await sb.from("clients").select("id,data").limit(500);
    const knownPhones = (clients || []).map((c: { id: string; data: Record<string, unknown> }) => {
      const p = ((c.data?.phone as string) || "").replace(/\D/g, "");
      return p.length > 10 ? p.slice(-10) : p;
    });
    const toDigits = to.replace(/\D/g, "");
    const toNorm = toDigits.length > 10 ? toDigits.slice(-10) : toDigits;
    const coachPhone = Deno.env.get("COACH_PHONE") || "";
    const coachNorm = coachPhone.replace(/\D/g, "").slice(-10);
    if (!knownPhones.includes(toNorm) && toNorm !== coachNorm) {
      return new Response(
        JSON.stringify({ error: "Unknown recipient" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // First attempt
    let result = await sendViaTwilio(to, message);

    // Retry once on failure
    if (!result.success) {
      console.warn(`SMS send failed, retrying: ${result.error}`);
      result = await sendViaTwilio(to, message);
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, sid: result.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-sms error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
