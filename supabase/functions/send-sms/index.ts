import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * SMS provider hook.
 *
 * The Twilio integration was removed during recovery. The endpoint, recipient
 * validation, and (to, message) contract are intentionally preserved so a new
 * provider — a different SMS service or a Supabase-native setup — can be wired
 * in here without touching callers. Keep the return shape the same.
 */
async function sendSMS(
  to: string,
  message: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
  // TODO: integrate SMS provider here.
  console.log(`[send-sms] no provider configured — would send to ${to}: ${message}`);
  return { success: false, error: "SMS provider not configured" };
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

    const result = await sendSMS(to, message);

    if (!result.success) {
      // 503: endpoint is healthy, but no SMS provider is wired up yet.
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
