import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Expected multipart/form-data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const formData = await req.formData();
    const phone = formData.get("phone") as string;
    const weight = formData.get("weight") as string;
    const bodyFat = formData.get("bodyFat") as string;
    const notes = formData.get("notes") as string;
    const photoCount = parseInt(formData.get("photoCount") as string || "0", 10);

    if (photoCount > 20) {
      return new Response(JSON.stringify({ error: "Maximum 20 photos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!phone) {
      return new Response(JSON.stringify({ error: "Missing phone" }),
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

    if (!matchRow) {
      return new Response(JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const clientData = matchRow.data;
    const clientId = (clientData.id as string) || matchRow.id;
    const clientName = (clientData.name as string) || "Client";
    const timestamp = Date.now();

    // Upload photos to Supabase Storage
    const photos: { url: string; label: string }[] = [];
    for (let i = 0; i < photoCount; i++) {
      const file = formData.get(`photo_${i}`) as File | null;
      const label = (formData.get(`photoLabel_${i}`) as string) || `Photo ${i + 1}`;
      if (!file) continue;

      // Validate size (10MB)
      if (file.size > 10 * 1024 * 1024) continue;

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${clientId}/${timestamp}_${i}.${ext}`;

      const arrayBuf = await file.arrayBuffer();
      const { error: uploadErr } = await sb.storage
        .from("checkin-photos")
        .upload(path, arrayBuf, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      if (!uploadErr) {
        const { data: urlData } = sb.storage
          .from("checkin-photos")
          .getPublicUrl(path);
        if (urlData?.publicUrl) {
          photos.push({ url: urlData.publicUrl, label });
        }
      }
    }

    // Build check-in record
    const checkinId = "ci_" + timestamp.toString(36) + Math.random().toString(36).slice(2, 8);
    const checkin = {
      id: checkinId,
      date: new Date().toISOString().split("T")[0],
      weight: weight || "",
      bodyFat: bodyFat || "",
      notes: notes || "",
      photos,
      source: "client",
      submittedAt: new Date().toISOString(),
    };

    // Push into client's checkins array
    const checkins = Array.isArray(clientData.checkins) ? clientData.checkins : [];
    checkins.push(checkin);
    clientData.checkins = checkins;

    // Also log weight
    if (weight) {
      const weightLog = Array.isArray(clientData.weightLog) ? clientData.weightLog : [];
      weightLog.push({ date: checkin.date, lbs: parseFloat(weight) });
      clientData.weightLog = weightLog;
    }

    // Upsert client record
    const { error: upsertErr } = await sb.from("clients").upsert(
      { id: matchRow.id, data: clientData, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

    if (upsertErr) {
      return new Response(JSON.stringify({ error: "Failed to save check-in" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Push notification to coach (fire-and-forget)
    try {
      const pushBody = weight
        ? `${weight} lbs \u00b7 ${photos.length} photo${photos.length !== 1 ? "s" : ""}`
        : "New check-in submitted";
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `Check-in \u2014 ${clientName}`,
          body: pushBody,
          type: "general",
          tag: `checkin-${clientId}-${checkin.date}`,
          url: "./app.html#clients",
          clientId,
        }),
      });
    } catch { /* push is best-effort */ }

    return new Response(JSON.stringify({ success: true, checkinId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("submit-checkin error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
