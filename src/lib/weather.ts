/**
 * Historical weather + reverse-geocoded place name for a real GPS
 * coordinate + capture date extracted from a video's own metadata (see
 * `video-metadata.ts`). Both calls are free, keyless, client-safe APIs:
 *
 * - Open-Meteo's Historical Weather Archive (no key, no rate-limit auth) —
 *   https://open-meteo.com/en/docs/historical-weather-api
 * - OpenStreetMap Nominatim reverse geocoding (no key; a descriptive
 *   `Accept-Language` header + coarse `zoom` level keeps this to a single,
 *   light request per render, in line with Nominatim's usage policy).
 *
 * This is intentionally best-effort: any failure (offline, date out of the
 * archive's range, coordinates over open ocean, etc.) resolves to `null`
 * fields rather than throwing — per the product requirement, the montage
 * simply omits whatever piece of real-world context isn't available instead
 * of fabricating a placeholder.
 */

export interface LocationWeather {
  locationName: string | null;
  tempC: number | null;
  description: string | null;
}

// Subset of the WMO weather-interpretation codes Open-Meteo returns, mapped to short human labels.
const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Foggy",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

export async function fetchLocationWeather(lat: number, lng: number, date: Date): Promise<LocationWeather | null> {
  // Open-Meteo's archive only has data up to ~2-5 days behind real time; a
  // clip filmed minutes/hours ago has no archive entry yet — skip the call
  // entirely rather than let it fail.
  const daysAgo = (Date.now() - date.getTime()) / 86_400_000;
  if (daysAgo < 5) return { locationName: null, tempC: null, description: null };

  const iso = date.toISOString().slice(0, 10);

  const [weatherSettled, geoSettled] = await Promise.allSettled([
    fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${iso}&end_date=${iso}&daily=temperature_2m_max,weathercode&timezone=auto`
    ),
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`, {
      headers: { "Accept-Language": "en" },
    }),
  ]);

  let tempC: number | null = null;
  let description: string | null = null;
  if (weatherSettled.status === "fulfilled" && weatherSettled.value.ok) {
    try {
      const json = await weatherSettled.value.json();
      const rawTemp = json?.daily?.temperature_2m_max?.[0];
      tempC = typeof rawTemp === "number" ? Math.round(rawTemp) : null;
      const code = json?.daily?.weathercode?.[0];
      description = typeof code === "number" ? WEATHER_CODE_LABELS[code] ?? null : null;
    } catch {
      // Malformed response body — leave weather fields null.
    }
  }

  let locationName: string | null = null;
  if (geoSettled.status === "fulfilled" && geoSettled.value.ok) {
    try {
      const json = await geoSettled.value.json();
      const addr = json?.address ?? {};
      const place = addr.city || addr.town || addr.village || addr.county || addr.state || null;
      locationName = place ? (addr.country ? `${place}, ${addr.country}` : place) : json?.name ?? null;
    } catch {
      // Malformed response body — leave location name null.
    }
  }

  if (tempC === null && description === null && locationName === null) return null;
  return { locationName, tempC, description };
}

/**
 * Formats the real capture date (+ resolved location/weather, if any) into
 * the 1-2 short lines burned onto the metadata card in `video-engine.ts`.
 * Always has at least a date line; location/weather are appended only when
 * genuinely resolved.
 */
export function formatMetadataCardLines(capturedAt: Date, weather: LocationWeather | null): string[] {
  const dateLabel = capturedAt.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const weatherLabel =
    weather?.description && weather.tempC !== null
      ? `${weather.description}, ${weather.tempC}°C`
      : weather?.tempC !== null && weather?.tempC !== undefined
        ? `${weather.tempC}°C`
        : weather?.description ?? null;

  if (weather?.locationName) {
    const second = [dateLabel, weatherLabel].filter(Boolean).join(" · ");
    return [weather.locationName, second];
  }
  return weatherLabel ? [dateLabel, weatherLabel] : [dateLabel];
}
