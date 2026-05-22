import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* request-2fa-code
   ─────────────────────────────────────────────────────────────
   Generates a server-side cryptographically random 6-digit code,
   stores it on the client record, and sends it via SMS. The code
   is NEVER returned to the caller — the only way to learn the code
   is to receive the SMS at the registered phone.

   Replaces the previous client-side Math.random() generation
   which leaked the code to anyone with devtools open. */

async function sendViaTwilio(to: string, message: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "Twilio not configured" };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = btoa(`${accountSid}:${authToken}`);
  const body = new URLSearchParams({ To: to, From: fromNumber, Body: message });
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { success: false, error: data.message || `Twilio error: ${res.status}` };
  }
  return { success: true };
}

function secureCode(): string {
  // Crypto-secure 6-digit code (000000–999999), zero-padded.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1000000).padStart(6, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let body;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { phone, purpose } = body;
    if (!phone) {
      return new Response(JSON.stringify({ error: "Missing phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const digits = String(phone).replace(/\D/g, "");
    const matchDigits = digits.length > 10 ? digits.slice(-10) : digits;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await sb.from("clients").select("id, data");
    if (error) {
      return new Response(JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let matchRow: { id: string; data: Record<string, unknown> } | null = null;
    for (const row of data || []) {
      const cd = row.data as Record<string, unknown>;
      if (!cd?.phone) continue;
      const cdDigits = String(cd.phone).replace(/\D/g, "");
      const cdMatch = cdDigits.length > 10 ? cdDigits.slice(-10) : cdDigits;
      if (cdMatch === matchDigits) { matchRow = row; break; }
    }

    // Always return success regardless of phone validity to prevent
    // user enumeration. Only the genuine owner will receive a real SMS.
    if (!matchRow) {
      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const code = secureCode();
    const cd = matchRow.data as Record<string, unknown>;
    cd.resetCode = code;
    cd.resetCodeExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: upErr } = await sb.from("clients").upsert(
      { id: matchRow.id, data: cd, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
    if (upErr) {
      return new Response(JSON.stringify({ error: "Failed to store code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const label = purpose === "2fa" ? "verification" : "reset";
    const message = `Your Big Mike Ely Coaching ${label} code is: ${code}. Expires in 10 minutes.`;
    const smsResult = await sendViaTwilio(phone, message);
    if (!smsResult.success) {
      console.warn("SMS send failed:", smsResult.error);
      // Do not leak SMS failure to caller; code is still stored.
    }

    return new Response(JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("request-2fa-code error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
