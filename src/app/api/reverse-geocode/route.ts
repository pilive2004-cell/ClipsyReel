import { NextRequest, NextResponse } from "next/server";
import cityCache from "@/data/cityCache.json";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

// Simple in-memory cache with TTL
const geocodeCache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Load pre-cached cities
const preloadedCities = new Map<string, any>(
  Object.entries(cityCache.cache).map(([key, value]: [string, any]) => [key, value])
);

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Find closest pre-cached city within ~50km
function findNearbyCache(lat: number, lng: number): any | null {
  let closest = null;
  let closestDistance = Infinity;
  
  for (const [cacheKey, cacheData] of preloadedCities) {
    const [cacheLat, cacheLng] = cacheKey.split(',').map(Number);
    // Simple distance approximation (good enough for 50km)
    const distance = Math.sqrt((lat - cacheLat) ** 2 + (lng - cacheLng) ** 2);
    
    // Consider it a match if within ~0.5 degrees (~50km)
    if (distance < 0.5 && distance < closestDistance) {
      closest = cacheData;
      closestDistance = distance;
    }
  }
  
  return closest;
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
  const lat_num = parseFloat(lat);
  const lng_num = parseFloat(lng);
  
  // Check in-memory cache first
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    console.log(`[reverse-geocode] Cache hit for ${cacheKey}`);
    return NextResponse.json(cached.data);
  }

  // Check pre-loaded city cache for nearby cities
  const nearby = findNearbyCache(lat_num, lng_num);
  if (nearby) {
    console.log(`[reverse-geocode] Pre-cached city found for ${cacheKey}: ${nearby.city}`);
    const result = {
      lat: lat_num,
      lng: lng_num,
      city: nearby.city,
      country: nearby.country,
      region: nearby.region,
      display_name: `${nearby.city}, ${nearby.region}, ${nearby.country}`,
    };
    // Store in memory cache for future requests
    geocodeCache.set(cacheKey, {
      data: result,
      expires: Date.now() + CACHE_TTL_MS,
    });
    return NextResponse.json(result);
  }

  // Try to fetch from Nominatim in background (don't block response)
  (async () => {
    try {
      // Wait a bit to avoid hammering Nominatim
      await delay(5000);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log(`[reverse-geocode] Attempting Nominatim fetch: lat=${lat}, lon=${lng}`);
      
      const response = await fetch(
        `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=jsonv2`,
        {
          signal: controller.signal,
          headers: {
            "Accept": "application/json",
            "User-Agent": "ClipsyReel/1.0",
          },
        }
      );

      clearTimeout(timeoutId);

      if (response.status === 429) {
        console.warn(`[reverse-geocode] Rate limited (429) for ${cacheKey}`);
        return;
      }

      if (!response.ok) {
        console.error(`[reverse-geocode] Nominatim error: ${response.status}`);
        return;
      }

      const data = await response.json();
      
      // Extract relevant fields
      const address = data.address || {};
      const city = address.city || address.town || address.village || address.municipality || address.county || "";
      const country = address.country || "";
      
      const result = {
        lat: lat_num,
        lng: lng_num,
        city,
        country,
        region: address.state || address.province || null,
        display_name: data.display_name || "",
      };

      console.log("[reverse-geocode] Nominatim success:", result);

      // Cache the result
      geocodeCache.set(cacheKey, {
        data: result,
        expires: Date.now() + CACHE_TTL_MS,
      });
    } catch (error) {
      console.error("[reverse-geocode] Nominatim error:", error);
    }
  })();
  
  // Return placeholder immediately
  return NextResponse.json({ city: "", country: "", region: null, display_name: "" });
}

