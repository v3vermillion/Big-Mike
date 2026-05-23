// Square Booking Edge Function for Big Mike Ely Coaching
// Handles: services listing, availability lookup, booking creation
// Reads SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID from Supabase secrets

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SQUARE_BASE = "https://connect.squareup.com/v2";

interface SquareConfig {
  accessToken: string;
  locationId: string;
}

function getSquareConfig(): SquareConfig {
  const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN") || "";
  const locationId = Deno.env.get("SQUARE_LOCATION_ID") || "";
  return { accessToken, locationId };
}

function squareHeaders(token: string): Record<string, string> {
  return {
    "Square-Version": "2024-01-18",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ── LIST BOOKABLE SERVICES ──
async function getServices(config: SquareConfig): Promise<Response> {
  try {
    // Fetch catalog items of type APPOINTMENT_SERVICE
    const catalogRes = await fetch(
      `${SQUARE_BASE}/catalog/search`,
      {
        method: "POST",
        headers: squareHeaders(config.accessToken),
        body: JSON.stringify({
          object_types: ["ITEM"],
          query: {
            exact_query: {
              attribute_name: "item_data.product_type",
              attribute_value: "APPOINTMENTS_SERVICE",
            },
          },
        }),
      }
    );

    if (!catalogRes.ok) {
      const err = await catalogRes.json();
      console.error("Square catalog error:", err);
      return errorResponse("Failed to fetch services", 502);
    }

    const catalogData = await catalogRes.json();
    const objects = catalogData.objects || [];

    const services = objects.map((obj: any) => {
      const item = obj.item_data || {};
      const variation = item.variations?.[0];
      const variationData = variation?.item_variation_data || {};

      // Duration in minutes from service_duration (milliseconds)
      const durationMs = variationData.service_duration || 3600000;
      const durationMin = Math.round(durationMs / 60000);

      // Price
      const priceMoney = variationData.price_money || {};
      const priceAmount = priceMoney.amount || 0;
      const priceCurrency = priceMoney.currency || "USD";

      return {
        id: obj.id,
        variationId: variation?.id || obj.id,
        name: item.name || "Service",
        description: item.description || "",
        duration: durationMin,
        price: priceAmount / 100,
        currency: priceCurrency,
        imageUrl: item.image_ids?.[0] || null,
      };
    });

    return jsonResponse({ services });
  } catch (e) {
    console.error("getServices error:", e);
    return errorResponse("Internal error fetching services", 500);
  }
}

// ── GET AVAILABILITY ──
async function getAvailability(
  config: SquareConfig,
  serviceVariationId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD
): Promise<Response> {
  try {
    // Build start/end in RFC3339
    const startAt = `${startDate}T00:00:00Z`;
    const endAt = `${endDate}T23:59:59Z`;

    const body: any = {
      query: {
        filter: {
          start_at_range: {
            start_at: startAt,
            end_at: endAt,
          },
          location_id: config.locationId,
          segment_filters: [
            {
              service_variation_id: serviceVariationId,
            },
          ],
        },
      },
    };

    const res = await fetch(
      `${SQUARE_BASE}/bookings/availability/search`,
      {
        method: "POST",
        headers: squareHeaders(config.accessToken),
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("Square availability error:", err);
      return errorResponse("Failed to fetch availability", 502);
    }

    const data = await res.json();
    const availabilities = (data.availabilities || []).map((slot: any) => ({
      startAt: slot.start_at,
      locationId: slot.location_id,
      appointmentSegments: slot.appointment_segments,
    }));

    return jsonResponse({ availabilities });
  } catch (e) {
    console.error("getAvailability error:", e);
    return errorResponse("Internal error fetching availability", 500);
  }
}

// ── CREATE BOOKING ──
async function createBooking(
  config: SquareConfig,
  serviceVariationId: string,
  startAt: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  customerNote: string,
  teamMemberId?: string
): Promise<Response> {
  try {
    // First, create or find the customer
    const customerRes = await fetch(
      `${SQUARE_BASE}/customers/search`,
      {
        method: "POST",
        headers: squareHeaders(config.accessToken),
        body: JSON.stringify({
          query: {
            filter: {
              email_address: { exact: customerEmail },
            },
          },
        }),
      }
    );

    let customerId: string | undefined;

    if (customerRes.ok) {
      const customerData = await customerRes.json();
      if (customerData.customers?.length > 0) {
        customerId = customerData.customers[0].id;
      }
    }

    // Create customer if not found
    if (!customerId) {
      const nameParts = customerName.trim().split(/\s+/);
      const givenName = nameParts[0] || "";
      const familyName = nameParts.slice(1).join(" ") || "";

      const createRes = await fetch(
        `${SQUARE_BASE}/customers`,
        {
          method: "POST",
          headers: squareHeaders(config.accessToken),
          body: JSON.stringify({
            given_name: givenName,
            family_name: familyName,
            email_address: customerEmail,
            phone_number: customerPhone || undefined,
            note: customerNote || undefined,
            idempotency_key: crypto.randomUUID(),
          }),
        }
      );

      if (createRes.ok) {
        const created = await createRes.json();
        customerId = created.customer?.id;
      }
    }

    // Create the booking
    const bookingBody: any = {
      booking: {
        start_at: startAt,
        location_id: config.locationId,
        customer_id: customerId,
        customer_note: customerNote || "",
        appointment_segments: [
          {
            service_variation_id: serviceVariationId,
            service_variation_version: Date.now(),
            team_member_id: teamMemberId || "anyone",
          },
        ],
      },
      idempotency_key: crypto.randomUUID(),
    };

    const bookRes = await fetch(
      `${SQUARE_BASE}/bookings`,
      {
        method: "POST",
        headers: squareHeaders(config.accessToken),
        body: JSON.stringify(bookingBody),
      }
    );

    if (!bookRes.ok) {
      const err = await bookRes.json();
      console.error("Square booking error:", err);
      const msg =
        err.errors?.[0]?.detail || "Failed to create booking";
      return errorResponse(msg, 502);
    }

    const bookData = await bookRes.json();
    const booking = bookData.booking || {};

    return jsonResponse({
      booking: {
        id: booking.id,
        status: booking.status,
        startAt: booking.start_at,
        locationId: booking.location_id,
        customerId: booking.customer_id,
        createdAt: booking.created_at,
      },
    });
  } catch (e) {
    console.error("createBooking error:", e);
    return errorResponse("Internal error creating booking", 500);
  }
}

// ── MAIN HANDLER ──
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const config = getSquareConfig();

  // If no token configured, return a clear message
  if (!config.accessToken) {
    return errorResponse(
      "Square is not configured. Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID as Supabase secrets.",
      503
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const { action } = body;

  switch (action) {
    case "services":
      return getServices(config);

    case "availability":
      if (!body.serviceVariationId || !body.startDate || !body.endDate) {
        return errorResponse(
          "Missing required fields: serviceVariationId, startDate, endDate"
        );
      }
      return getAvailability(
        config,
        body.serviceVariationId,
        body.startDate,
        body.endDate
      );

    case "book":
      if (
        !body.serviceVariationId ||
        !body.startAt ||
        !body.customerName ||
        !body.customerEmail
      ) {
        return errorResponse(
          "Missing required fields: serviceVariationId, startAt, customerName, customerEmail"
        );
      }
      return createBooking(
        config,
        body.serviceVariationId,
        body.startAt,
        body.customerName,
        body.customerEmail,
        body.customerPhone || "",
        body.customerNote || "",
        body.teamMemberId
      );

    default:
      return errorResponse(
        "Unknown action. Use: services, availability, book"
      );
  }
});
