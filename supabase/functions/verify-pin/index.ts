import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let body;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({error:"Invalid request"}), {status:400, headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    const { phone, pinHash } = body;
    if (!phone || !pinHash) {
      return new Response(JSON.stringify({ error: "Missing phone or pinHash" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const digits = phone.replace(/\D/g, "");
    const matchDigits = digits.length > 10 ? digits.slice(-10) : digits;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await sb.from("clients").select("id, data");
    if (error) {
      return new Response(JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let matchRow: { id: string; data: any } | null = null;
    for (const row of data || []) {
      const cd = row.data;
      if (!cd?.phone) continue;
      const cdDigits = cd.phone.replace(/\D/g, "");
      const cdMatch = cdDigits.length > 10 ? cdDigits.slice(-10) : cdDigits;
      if (cdMatch === matchDigits) {
        matchRow = row;
        break;
      }
    }

    if (!matchRow || !matchRow.data?.pinHash) {
      return new Response(JSON.stringify({ valid: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cd = matchRow.data;
    const attempts = cd.pinAttempts || 0;
    const lockedUntil = cd.pinLockedUntil ? new Date(cd.pinLockedUntil) : null;

    // Check lockout
    if (lockedUntil && lockedUntil > new Date()) {
      return new Response(JSON.stringify({ valid: false, locked: true, lockedUntil: cd.pinLockedUntil }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Compare PIN
    if (cd.pinHash !== pinHash) {
      cd.pinAttempts = attempts + 1;
      if (cd.pinAttempts >= 5) {
        cd.pinLockedUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      }
      await sb.from("clients").upsert(
        { id: matchRow.id, data: cd, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
      return new Response(JSON.stringify({ valid: false, attemptsRemaining: Math.max(0, 5 - cd.pinAttempts) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Success — reset attempts
    cd.pinAttempts = 0;
    cd.pinLockedUntil = null;
    await sb.from("clients").upsert(
      { id: matchRow.id, data: cd, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

    return new Response(
      JSON.stringify({ valid: true, clientId: cd.id || matchRow.id, clientName: cd.name || "Client" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-pin error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
