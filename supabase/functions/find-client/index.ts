const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let body;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({error:"Invalid request"}), {status:400, headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    const { phone, mode } = body;

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Missing required field: phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalize phone to last 10 digits for matching
    const digits = phone.replace(/\D/g, "");
    const matchDigits = digits.length > 10 ? digits.slice(-10) : digits;

    if (matchDigits.length < 10) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use service_role key server-side (safe - never exposed to browser)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await sb.from("clients").select("id, data");

    if (error) {
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find matching client by phone (last 10 digits)
    let match = null;
    if (data) {
      for (const row of data) {
        const cd = row.data;
        if (!cd || !cd.phone) continue;
        const cdDigits = cd.phone.replace(/\D/g, "");
        const cdMatch = cdDigits.length > 10 ? cdDigits.slice(-10) : cdDigits;
        if (cdMatch === matchDigits) {
          match = cd;
          break;
        }
      }
    }

    if (!match) {
      return new Response(
        JSON.stringify({ found: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // "basic" mode returns minimal info (for booking portal)
    // "full" mode returns full client data (for client portal)
    if (mode === "full") {
      const hasPIN = !!match.pinHash;
      delete match.pinHash;
      delete match.resetCode;
      delete match.resetCodeExpiry;
      delete match.pinAttempts;
      delete match.pinLockedUntil;
      return new Response(
        JSON.stringify({ found: true, client: match, hasPIN }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Basic mode - only non-sensitive fields
    return new Response(
      JSON.stringify({
        found: true,
        client: {
          id: match.id,
          name: match.name,
          phone: match.phone,
          email: match.email || "",
          clientType: match.clientType || "",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("find-client error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
