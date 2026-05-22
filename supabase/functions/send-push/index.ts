/**
 * send-push — Supabase Edge Function
 *
 * Delivers Web Push notifications to Coach Mike's subscribed devices.
 * Called by other Edge Functions (confirm-booking, auto-remind, cancel-booking)
 * or directly from the client app.
 *
 * Required Supabase secrets:
 *   VAPID_PRIVATE_KEY  — Base64url-encoded 32-byte raw private key
 *   VAPID_PUBLIC_KEY   — Base64url-encoded 65-byte uncompressed public key
 *   VAPID_SUBJECT      — "mailto:your@email.com" or "https://yourdomain.com"
 *   SUPABASE_URL       — Auto-provided by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — Auto-provided by Supabase
 *
 * Payload format:
 *   {
 *     title: "New Booking",
 *     body: "John Doe — Contest Prep at 3:00 PM",
 *     type: "new_booking" | "session_reminder" | "cancellation" | "general",
 *     tag: "booking-abc123",          // optional, deduplicates
 *     url: "./app.html#schedule",     // optional, deep link on click
 *     sessionId: "abc123",            // optional, for deep linking
 *     clientId: "xyz456",             // optional
 *     requireInteraction: true        // optional, default true
 *   }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ── Encoding helpers ── */

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ── VAPID key import ──
   VAPID keys are typically raw bytes (32-byte private, 65-byte public).
   Web Crypto requires PKCS8 for private key import, so we wrap raw keys. */

// PKCS8 header for P-256 EC private key (RFC 5958 / SEC 1)
const PKCS8_P256_PREFIX = new Uint8Array([
  0x30, 0x41, // SEQUENCE (65 bytes)
  0x02, 0x01, 0x00, // INTEGER 0 (version)
  0x30, 0x13, // SEQUENCE (19 bytes) - AlgorithmIdentifier
  0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID 1.2.840.10045.2.1 (ecPublicKey)
  0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID 1.2.840.10045.3.1.7 (P-256)
  0x04, 0x27, // OCTET STRING (39 bytes)
  0x30, 0x25, // SEQUENCE (37 bytes) - ECPrivateKey
  0x02, 0x01, 0x01, // INTEGER 1 (version)
  0x04, 0x20, // OCTET STRING (32 bytes) - the actual private key follows
]);

async function importVapidKeys(): Promise<{ publicKey: Uint8Array; privateKey: CryptoKey }> {
  const pubB64 = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const privB64 = Deno.env.get("VAPID_PRIVATE_KEY") || "";

  if (!pubB64 || !privB64) {
    throw new Error("VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY as Supabase secrets.");
  }

  const publicKey = base64UrlToUint8Array(pubB64);
  const privBytes = base64UrlToUint8Array(privB64);

  let privateKey: CryptoKey;

  if (privBytes.length === 32) {
    // Raw 32-byte private key — wrap in PKCS8 DER for Web Crypto import
    const pkcs8 = new Uint8Array(PKCS8_P256_PREFIX.length + 32);
    pkcs8.set(PKCS8_P256_PREFIX, 0);
    pkcs8.set(privBytes, PKCS8_P256_PREFIX.length);

    privateKey = await crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  } else {
    // Already PKCS8 format
    privateKey = await crypto.subtle.importKey(
      "pkcs8",
      privBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  }

  return { publicKey, privateKey };
}

/* ── VAPID JWT (RFC 8292) ── */

async function createVapidAuthHeader(
  audience: string,
  subject: string,
  privateKey: CryptoKey,
  publicKey: Uint8Array
): Promise<{ authorization: string; cryptoKey: string }> {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsigned)
  );

  // Web Crypto may return DER or raw format — normalize to raw r||s (64 bytes)
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;

  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  } else {
    // DER: 0x30 totalLen 0x02 rLen [r] 0x02 sLen [s]
    let offset = 2;
    offset += 1; // 0x02
    const rLen = sigBytes[offset++];
    const rRaw = sigBytes.slice(offset, offset + rLen);
    r = rRaw.length > 32 ? rRaw.slice(rRaw.length - 32) : rRaw;
    offset += rLen;
    offset += 1; // 0x02
    const sLen = sigBytes[offset++];
    const sRaw = sigBytes.slice(offset, offset + sLen);
    s = sRaw.length > 32 ? sRaw.slice(sRaw.length - 32) : sRaw;
  }

  // Zero-pad to 32 bytes each
  const rPadded = new Uint8Array(32);
  rPadded.set(r, 32 - r.length);
  const sPadded = new Uint8Array(32);
  sPadded.set(s, 32 - s.length);

  const rawSig = new Uint8Array(64);
  rawSig.set(rPadded, 0);
  rawSig.set(sPadded, 32);

  const jwt = `${unsigned}.${uint8ArrayToBase64Url(rawSig)}`;
  const pubB64 = uint8ArrayToBase64Url(publicKey);

  return {
    authorization: `vapid t=${jwt}, k=${pubB64}`,
    cryptoKey: `p256ecdsa=${pubB64}`,
  };
}

/* ── Web Push Encryption (RFC 8291 / aes128gcm) ──
   1. ECDH shared secret between ephemeral key and subscriber's key
   2. HKDF to derive IKM from shared secret + auth
   3. HKDF to derive CEK and nonce from IKM + random salt
   4. AES-128-GCM encrypt the padded payload
   5. Build aes128gcm content-coding header */

async function encryptPayload(
  payloadText: string,
  clientPublicKeyBytes: Uint8Array,
  clientAuthBytes: Uint8Array
): Promise<Uint8Array> {
  const encoder = new TextEncoder();

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Export ephemeral public key (65 bytes uncompressed)
  const localPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Import subscriber's public key for ECDH
  const clientPubKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPubKey },
      localKeyPair.privateKey,
      256
    )
  );

  // Step 1: Derive IKM from shared secret
  // HKDF(salt=auth_secret, IKM=ecdh_secret, info="WebPush: info\0"||ua_public||as_public, L=32)
  const keyInfoBuf = new Uint8Array([
    ...encoder.encode("WebPush: info\0"),
    ...clientPublicKeyBytes,
    ...localPubRaw,
  ]);

  const sharedSecretKey = await crypto.subtle.importKey(
    "raw", sharedSecret, "HKDF", false, ["deriveBits"]
  );

  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: clientAuthBytes, info: keyInfoBuf },
      sharedSecretKey,
      256
    )
  );

  // Step 2: Generate random 16-byte salt for content encryption
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Step 3: Derive CEK and nonce from IKM using the random salt
  // HKDF(salt=random_salt, IKM=ikm, info="Content-Encoding: aes128gcm\0", L=16)
  const ikmKey = await crypto.subtle.importKey(
    "raw", ikm, "HKDF", false, ["deriveBits"]
  );

  const cek = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: salt, info: encoder.encode("Content-Encoding: aes128gcm\0") },
      ikmKey,
      128
    )
  );

  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: salt, info: encoder.encode("Content-Encoding: nonce\0") },
      ikmKey,
      96
    )
  );

  // Step 4: Encrypt payload with AES-128-GCM
  // Add padding delimiter (0x02) per RFC 8291
  const payloadBytes = encoder.encode(payloadText);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // record delimiter

  const aesKey = await crypto.subtle.importKey(
    "raw", cek, "AES-GCM", false, ["encrypt"]
  );

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      paddedPayload
    )
  );

  // Step 5: Build aes128gcm content-coding:
  // salt(16) || rs(4, big-endian uint32) || idLen(1) || keyId(65) || ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);

  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);          // 16-byte salt
  header.set(rs, 16);           // record size
  header[20] = 65;              // key ID length (65 = uncompressed P-256 point)
  header.set(localPubRaw, 21);  // ephemeral public key

  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header, 0);
  body.set(ciphertext, header.length);

  return body;
}

/* ── Main handler ── */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { title, body, type, tag, url, sessionId, clientId, requireInteraction } = payload;

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing 'title' or 'body'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase env vars not available");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch push subscription from app_settings
    const { data: subData, error: subError } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "push_subscription")
      .single();

    if (subError || !subData?.value?.endpoint) {
      return new Response(
        JSON.stringify({ error: "No push subscription found. Open the app and enable push notifications first." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subscription = subData.value;
    const endpoint: string = subscription.endpoint;
    const keys = subscription.keys;

    if (!keys?.p256dh || !keys?.auth) {
      return new Response(
        JSON.stringify({ error: "Push subscription is missing encryption keys" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the notification payload for the service worker
    const pushPayload = JSON.stringify({
      title,
      body,
      type: type || "general",
      tag: tag || "coaching-" + Date.now(),
      url: url || "./app.html",
      sessionId: sessionId || null,
      clientId: clientId || null,
      requireInteraction: requireInteraction !== false,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
    });

    // Import VAPID keys
    const { publicKey: vapidPublicKey, privateKey: vapidPrivateKey } = await importVapidKeys();
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:coach@bigmikeely.com";

    // Parse endpoint to get audience (origin)
    const endpointUrl = new URL(endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

    // Generate VAPID authorization headers (RFC 8292)
    const vapidHeaders = await createVapidAuthHeader(audience, subject, vapidPrivateKey, vapidPublicKey);

    // Encrypt the payload (RFC 8291 aes128gcm)
    const clientPublicKey = base64UrlToUint8Array(keys.p256dh);
    const clientAuth = base64UrlToUint8Array(keys.auth);
    const encryptedBody = await encryptPayload(pushPayload, clientPublicKey, clientAuth);

    // Send to the push service
    const pushRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": encryptedBody.length.toString(),
        Authorization: vapidHeaders.authorization,
        TTL: "86400",
        Urgency: type === "session_reminder" ? "high" : "normal",
        Topic: tag || "",
      } as Record<string, string>,
      body: encryptedBody,
    });

    if (pushRes.status === 201 || pushRes.status === 200) {
      return new Response(
        JSON.stringify({ success: true, status: pushRes.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pushRes.status === 410 || pushRes.status === 404) {
      // Subscription expired — clean it up
      await supabase.from("app_settings").delete().eq("key", "push_subscription");
      return new Response(
        JSON.stringify({ error: "Push subscription expired. Re-enable in the app.", expired: true }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errText = await pushRes.text();
    return new Response(
      JSON.stringify({ error: `Push service returned ${pushRes.status}`, detail: errText }),
      { status: pushRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
