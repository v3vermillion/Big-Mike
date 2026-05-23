import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    function cap(s: unknown, max: number): string { return typeof s === "string" ? s.slice(0, max) : ""; }

    const name = cap(body.name, 200);
    const phone = cap(body.phone, 30);
    const email = cap(body.email, 200);
    const age = cap(body.age, 10);
    const location = cap(body.location, 200);
    const goal = cap(body.goal, 2000);
    const experience = cap(body.experience, 2000);
    const trainingSplit = cap(body.trainingSplit, 2000);
    const competitionHistory = cap(body.competitionHistory, 2000);
    const injuries = cap(body.injuries, 2000);
    const medical = cap(body.medical, 2000);
    const currentDiet = cap(body.currentDiet, 2000);
    const supplements = cap(body.supplements, 2000);
    const pedHistory = cap(body.pedHistory, 2000);
    const pedDetails = cap(body.pedDetails, 2000);
    const referralSource = cap(body.referralSource, 500);
    const preferredTimes = cap(body.preferredTimes, 500);
    const anythingElse = cap(body.anythingElse, 2000);

    // Validate required fields
    if (!name || !phone) {
      return new Response(JSON.stringify({ error: "Name and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Normalize phone to last 10 digits (same as find-client)
    const digits = phone.replace(/\D/g, "");
    const matchDigits = digits.length > 10 ? digits.slice(-10) : digits;

    if (matchDigits.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build onboarding data object
    const onboarding = {
      goal: goal || "",
      experience: experience || "",
      trainingSplit: trainingSplit || "",
      competitionHistory: competitionHistory || "",
      injuries: injuries || "",
      medical: medical || "",
      currentDiet: currentDiet || "",
      supplements: supplements || "",
      pedHistory: pedHistory || "",
      pedDetails: pedDetails || "",
      referralSource: referralSource || "",
      preferredTimes: preferredTimes || "",
      anythingElse: anythingElse || "",
      submittedAt: new Date().toISOString(),
    };

    // Check if client exists by phone
    const { data: clients, error: clientErr } = await sb.from("clients").select("id, data");
    if (clientErr) {
      return new Response(JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let matchRow: { id: string; data: Record<string, unknown> } | null = null;
    for (const row of clients || []) {
      const cd = row.data as Record<string, unknown>;
      if (!cd?.phone) continue;
      const cdDigits = (cd.phone as string).replace(/\D/g, "");
      const cdMatch = cdDigits.length > 10 ? cdDigits.slice(-10) : cdDigits;
      if (cdMatch === matchDigits) {
        matchRow = row as { id: string; data: Record<string, unknown> };
        break;
      }
    }

    let clientId: string;
    let clientName: string = name;

    if (matchRow) {
      // Existing client — update with onboarding data
      const clientData = matchRow.data;
      clientData.onboarding = onboarding;
      if (email && !clientData.email) clientData.email = email;
      if (age && !clientData.age) clientData.age = age;
      if (location && !clientData.location) clientData.location = location;
      clientId = (clientData.id as string) || matchRow.id;
      clientName = (clientData.name as string) || name;

      const { error: upsertErr } = await sb.from("clients").upsert(
        { id: matchRow.id, data: clientData, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
      if (upsertErr) {
        return new Response(JSON.stringify({ error: "Failed to save onboarding" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      // New prospect — create client record
      clientId = "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const newClient: Record<string, unknown> = {
        id: clientId,
        name,
        phone,
        email: email || "",
        age: age || "",
        location: location || "",
        clientType: "prospect",
        services: "Pending",
        rate: "",
        goals: goal || "",
        injuries: injuries || "",
        medical: medical || "",
        onboarding,
        created: new Date().toISOString(),
      };

      const { error: insertErr } = await sb.from("clients").upsert(
        { id: clientId, data: newClient, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
      if (insertErr) {
        return new Response(JSON.stringify({ error: "Failed to create prospect" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Create inbox entry
    const inboxId = "ob_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const inboxEntry = {
      id: inboxId,
      name: clientName,
      contact: phone,
      message: [
        goal ? "Goal: " + goal : "",
        experience ? "Experience: " + experience : "",
        referralSource ? "Referral: " + referralSource : "",
      ].filter(Boolean).join("\n"),
      service: "Onboarding",
      type: "onboarding",
      status: "new",
      submitted: new Date().toISOString(),
      clientId,
    };

    const { error: inboxErr } = await sb.from("inbox").upsert(
      { id: inboxId, data: inboxEntry, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
    if (inboxErr) {
      console.error("Inbox insert error:", inboxErr);
      // Non-fatal — onboarding still saved
    }

    // Push notification to coach (fire-and-forget)
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "New Prospect",
          body: `${clientName} — ${goal || "No goal specified"}`,
          type: "general",
          tag: `onboarding-${clientId}`,
          url: "./app.html#clients",
          clientId,
        }),
      });
    } catch { /* push is best-effort */ }

    return new Response(JSON.stringify({ success: true, clientId, name: clientName }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("submit-onboarding error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
