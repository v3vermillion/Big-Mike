import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { phone, text } = await req.json();
    if (!phone || !text) {
      return new Response(JSON.stringify({ error: "Missing phone or text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (text.length > 2000) {
      return new Response(JSON.stringify({ error: "Message too long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Normalize phone to last 10 digits
    const digits = phone.replace(/\D/g, "");
    const matchDigits = digits.length > 10 ? digits.slice(-10) : digits;

    // Find client
    const { data: clients, error: clientErr } = await sb.from("clients").select("id, data");
    if (clientErr) {
      return new Response(JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let match: { id: string; name: string } | null = null;
    for (const row of clients || []) {
      const cd = row.data;
      if (!cd?.phone) continue;
      const cdDigits = cd.phone.replace(/\D/g, "");
      const cdMatch = cdDigits.length > 10 ? cdDigits.slice(-10) : cdDigits;
      if (cdMatch === matchDigits) {
        match = { id: cd.id || row.id, name: cd.name || "Client" };
        break;
      }
    }

    if (!match) {
      return new Response(JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create message
    const msgId = "msg_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const msgData = {
      id: msgId,
      clientId: match.id,
      from: "client",
      text: text.trim(),
      timestamp: new Date().toISOString(),
      read: false,
      clientName: match.name
    };

    const { error: insertErr } = await sb.from("messages").upsert(
      { id: msgId, data: msgData, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

    if (insertErr) {
      return new Response(JSON.stringify({ error: "Failed to send message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fire-and-forget push notification to coach
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `Message from ${match.name}`,
          body: text.trim().substring(0, 100),
          type: "general",
          tag: `msg-${match.id}`,
          url: "./app.html#clients",
        }),
      });
    } catch { /* push is best-effort */ }

    return new Response(JSON.stringify({ success: true, messageId: msgId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("send-client-message error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
