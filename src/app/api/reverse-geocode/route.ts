import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

// Simple in-memory cache with TTL
const geocodeCache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let lastRequestTime = 0;
const REQUEST_DELAY_MS = 100; // Throttle to avoid rate limits

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lon");

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Missing lat or lon parameters" },
      { status: 400 }
    );
  }

  const cacheKey = `${lat},${lng}`;
  
  // Check cache first
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    // Throttle requests to respect Nominatim's rate limits
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < REQUEST_DELAY_MS) {
      await delay(REQUEST_DELAY_MS - timeSinceLastRequest);
    }
    lastRequestTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=jsonv2`,
      {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          "User-Agent": "ClipsyReel/1.0 (https://localhost:3001)",
        },
      }
    );

    clearTimeout(timeoutId);

    if (response.status === 429) {
      // Rate limited - return cached fallback or empty
      return NextResponse.json(
        { city: "", country: "", region: null, display_name: "" },
        { status: 200 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "Nominatim request failed", status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract relevant fields
    const address = data.address || {};
    const city = address.city || address.town || address.village || address.municipality || address.county || "";
    const country = address.country || "";
    
    const result = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      city,
      country,
      region: address.state || address.province || null,
      display_name: data.display_name || "",
    };

    // Cache the result
    geocodeCache.set(cacheKey, {
      data: result,
      expires: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[reverse-geocode] Error:", error);
    return NextResponse.json(
      { city: "", country: "", region: null, display_name: "" },
      { status: 200 }
    );
  }
}

