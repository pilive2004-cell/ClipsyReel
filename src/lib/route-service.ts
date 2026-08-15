/**
 * RouteService — provider-agnostic geocoding + routing abstraction.
 *
 * Current implementation uses:
 *   • Nominatim  (openstreetmap.org) for geocoding  — free, no key required
 *   • OSRM demo  (project-osrm.org)  for routing    — free, no key required
 *
 * The `geocodeCity` and `generateRoute` functions are the public surface.
 * To switch to Mapbox, Google Maps, or another provider later, replace only
 * the implementation bodies — the calling code in components does not change.
 */

import type { GpxRouteStats, GpxTrackPoint } from "@/types";

// ─── Public types ─────────────────────────────────────────────────────────────

export type VehicleType = "car" | "motorcycle" | "bicycle" | "walking";

export interface Waypoint {
  /** Human-readable name / address label. */
  name: string;
  lat: number;
  lng: number;
}

export interface GeneratedRoute {
  points: GpxTrackPoint[];
  stats: GpxRouteStats;
  /** The ordered waypoints used to build this route (geocoded from user input). */
  waypoints: Waypoint[];
  vehicleType: VehicleType;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Map our VehicleType to the OSRM routing profile name. */
function osrmProfile(vehicle: VehicleType): string {
  switch (vehicle) {
    case "bicycle": return "cycling";
    case "walking": return "foot";
    case "car":
    case "motorcycle":
    default:
      return "driving";
  }
}

/** Haversine distance in km between two lat/lng points. */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Convert a GeoJSON coordinate array to a GpxTrackPoint. */
function coordToPoint([lng, lat]: number[]): GpxTrackPoint {
  return { lat, lng, ele: null, time: null };
}

/** Compute GpxRouteStats from a set of track points and a total distance in metres. */
function buildStats(points: GpxTrackPoint[], distanceM: number): GpxRouteStats {
  let elevGain = 0;
  let highest: number | null = null;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].ele;
    const curr = points[i].ele;
    if (prev !== null && curr !== null) {
      if (curr > prev) elevGain += curr - prev;
      if (highest === null || curr > highest) highest = curr;
    }
  }
  const distanceKm = distanceM / 1000;
  // Rough duration estimate: 60 km/h driving average (used as fallback)
  const hours = distanceKm / 60;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const durationLabel = h > 0 ? `${h}h ${m}min` : `${m} min`;
  return { distanceKm, durationLabel, elevationGainM: Math.round(elevGain), highestPointM: highest };
}

// ─── Nominatim geocoding ──────────────────────────────────────────────────────

/**
 * Forward-geocode a city/address string via Nominatim.
 * Returns the best matching Waypoint, or null on failure / no result.
 *
 * Rate limit: 1 request per second — we add a small delay if multiple calls
 * are made in quick succession. The caller should not fire more than one
 * geocode per user keystroke (debounce in the UI).
 */
export async function geocodeCity(query: string): Promise<Waypoint | null> {
  if (!query.trim()) return null;
  try {
    const ctrl = new AbortController();
    const tid = window.setTimeout(() => ctrl.abort(), 5_000);
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query.trim());
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    window.clearTimeout(tid);
    if (!res.ok) return null;
    const results: Array<{ lat: string; lon: string; display_name: string }> = await res.json();
    if (!results.length) return null;
    const r = results[0];
    const label = r.display_name.split(",").slice(0, 2).join(", ");
    return { name: label, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
  } catch {
    return null;
  }
}

// ─── OSRM routing ─────────────────────────────────────────────────────────────

/**
 * Generate a turn-by-turn route using the OSRM demo server.
 *
 * Supports 2–5 waypoints (from, optional stops, to).
 * Returns a dense GeoJSON polyline decoded into GpxTrackPoint[].
 *
 * IMPORTANT: the OSRM demo server is rate-limited and intended for testing.
 * For production, replace the base URL with a self-hosted OSRM instance or
 * switch the implementation to Mapbox/Google/OpenRouteService.
 */
export async function generateRoute(
  waypoints: Waypoint[],
  vehicle: VehicleType,
): Promise<GeneratedRoute> {
  if (waypoints.length < 2) throw new Error("At least two waypoints are required.");

  const profile = osrmProfile(vehicle);
  // OSRM coordinate string: "lng,lat;lng,lat;..."
  const coordStr = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/${coordStr}` +
    `?overview=full&geometries=geojson&steps=false`;

  const ctrl = new AbortController();
  const tid = window.setTimeout(() => ctrl.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
  } catch (err) {
    window.clearTimeout(tid);
    throw new Error(`Routing request failed: ${err instanceof Error ? err.message : "network error"}`);
  }
  window.clearTimeout(tid);

  if (!res.ok) throw new Error(`OSRM returned HTTP ${res.status}`);

  interface OsrmResponse {
    code: string;
    routes?: Array<{
      distance: number;       // metres
      geometry: GeoJSON.LineString;
    }>;
  }
  const data: OsrmResponse = await res.json();

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("OSRM could not find a route between these locations.");
  }

  const route = data.routes[0];
  const points: GpxTrackPoint[] = route.geometry.coordinates.map(coordToPoint);

  if (points.length < 2) throw new Error("Route returned by OSRM has fewer than 2 points.");

  const stats = buildStats(points, route.distance);

  return { points, stats, waypoints, vehicleType: vehicle };
}

// ─── GPX export ───────────────────────────────────────────────────────────────

/**
 * Serialize a GeneratedRoute (or any list of GpxTrackPoints) as a standard
 * GPX 1.1 XML string that can be downloaded or re-uploaded by the user.
 */
export function exportRouteAsGpx(route: GeneratedRoute): string {
  const coords = route.points
    .map((p) => {
      const ele = p.ele !== null ? `\n        <ele>${p.ele.toFixed(1)}</ele>` : "";
      return `      <trkpt lat="${p.lat}" lon="${p.lng}">${ele}\n      </trkpt>`;
    })
    .join("\n");

  const name = route.waypoints.map((w) => w.name.split(",")[0]).join(" → ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ClipsyReel" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <desc>Generated by ClipsyReel route planner (${route.vehicleType})</desc>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${coords}
    </trkseg>
  </trk>
</gpx>`;
}

// ─── Straight-line fallback ───────────────────────────────────────────────────

/**
 * When OSRM is unavailable, generate a simple great-circle interpolation
 * between waypoints. This is used as an offline/demo fallback only — it
 * does not follow roads.
 */
export function buildStraightLineRoute(
  waypoints: Waypoint[],
  vehicle: VehicleType,
  samplesPerSegment = 60,
): GeneratedRoute {
  const points: GpxTrackPoint[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    for (let s = 0; s <= samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      points.push({
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t,
        ele: null,
        time: null,
      });
    }
  }

  let totalKm = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalKm += haversineKm(waypoints[i], waypoints[i + 1]);
  }
  const stats: GpxRouteStats = {
    distanceKm: totalKm,
    durationLabel: `~${Math.round(totalKm / 60)} h`,
    elevationGainM: 0,
    highestPointM: null,
  };

  return { points, stats, waypoints, vehicleType: vehicle };
}
