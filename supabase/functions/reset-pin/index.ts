import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let body;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({error:"Invalid request"}), {status:400, headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    const { phone, code, newPinHash } = body;
    if (!phone || !code || !newPinHash) {
      return new Response(JSON.stringify({ error: "Missing required fields" }),
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

    let matchRow: { id: string; data: Record<string, unknown> } | null = null;
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

    if (!matchRow) {
      return new Response(JSON.stringify({ success: false, reason: "not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cd = matchRow.data as Record<string, unknown>;

    // Special case: verify-only mode (just check code validity)
    if (newPinHash === "__verify_only__") {
      if (cd.resetCode === code && new Date(cd.resetCodeExpiry as string) > new Date()) {
        return new Response(JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const reason = new Date(cd.resetCodeExpiry as string) <= new Date() ? "expired" : "invalid";
      return new Response(JSON.stringify({ success: false, reason }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Full reset: always verify the actual SMS code
    if (cd.resetCode !== code) {
      return new Response(JSON.stringify({ success: false, reason: "invalid" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (new Date(cd.resetCodeExpiry as string) <= new Date()) {
      return new Response(JSON.stringify({ success: false, reason: "expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update PIN hash and clear reset fields
    cd.pinHash = newPinHash;
    cd.resetCode = null;
    cd.resetCodeExpiry = null;

    const { error: updateErr } = await sb.from("clients").upsert(
      { id: matchRow.id, data: cd, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

    if (updateErr) {
      return new Response(JSON.stringify({ success: false, reason: "update_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("reset-pin error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
