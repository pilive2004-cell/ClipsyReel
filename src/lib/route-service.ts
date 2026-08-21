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

import type { GpxRouteStats, GpxTrackPoint, RouteLabel } from "@/types";

// ─── Public types ─────────────────────────────────────────────────────────────

export type VehicleType = "car" | "motorcycle" | "bicycle" | "walking";

export interface Waypoint {
  /** Short verified city/place name. */
  name: string;
  /** Full display label used in dropdowns / inputs. */
  label: string;
  lat: number;
  lng: number;
  region?: string | null;
  country?: string | null;
}

export interface PlaceSuggestion {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  region: string | null;
  country: string | null;
  importance: number;
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

function normaliseText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function buildPlaceLabel(name: string, region: string | null, country: string | null): string {
  const parts = [name];
  if (region && normaliseText(region) !== normaliseText(name)) parts.push(region);
  if (country && !parts.some((part) => normaliseText(part) === normaliseText(country))) parts.push(country);
  return parts.join(", ");
}

function pickPrimaryPlaceName(
  address: Record<string, string> | undefined,
  displayName: string,
): string {
  const a = address ?? {};
  return (
    a.city ||
    a.town ||
    a.village ||
    a.municipality ||
    a.borough ||
    a.suburb ||
    a.county ||
    displayName.split(",")[0]?.trim() ||
    displayName.trim()
  );
}

function pickRegion(address: Record<string, string> | undefined): string | null {
  const a = address ?? {};
  return a.state || a.region || a.province || a.county || a.state_district || null;
}

function suggestionToInternalWaypoint(suggestion: PlaceSuggestion): Waypoint {
  return {
    name: suggestion.name,
    label: suggestion.label,
    lat: suggestion.lat,
    lng: suggestion.lng,
    region: suggestion.region,
    country: suggestion.country,
  };
}

function disambiguateRouteLabels(labels: RouteLabel[]): RouteLabel[] {
  const counts = new Map<string, number>();
  for (const label of labels) {
    const key = normaliseText(label.name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return labels.map((label) => {
    if ((counts.get(normaliseText(label.name)) ?? 0) < 2) return label;
    const suffix = label.region ?? label.country ?? null;
    return suffix ? { ...label, name: `${label.name}, ${suffix}` } : label;
  });
}

/** Convert a GeoJSON coordinate array to a GpxTrackPoint. */
function coordToPoint([lng, lat]: number[]): GpxTrackPoint {
  return { lat, lng, ele: null, time: null };
}

/** Compute GpxRouteStats from a set of track points and route metrics. */
function buildStats(
  points: GpxTrackPoint[],
  distanceM: number,
  durationSeconds?: number,
): GpxRouteStats {
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
  const roundedDurationSeconds =
    typeof durationSeconds === "number" && Number.isFinite(durationSeconds)
      ? Math.max(0, Math.round(durationSeconds))
      : Math.round((distanceKm / 60) * 3600);
  const h = Math.floor(roundedDurationSeconds / 3600);
  const m = Math.round((roundedDurationSeconds % 3600) / 60);
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
  const [suggestion] = await searchCitySuggestions(query, { limit: 1 });
  return suggestion ? suggestionToInternalWaypoint(suggestion) : null;
}

export async function searchCitySuggestions(
  query: string,
  options?: { limit?: number },
): Promise<PlaceSuggestion[]> {
  if (!query.trim()) return [];
  try {
    const ctrl = new AbortController();
    const tid = window.setTimeout(() => ctrl.abort(), 5_000);
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query.trim());
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", String(options?.limit ?? 5));
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    window.clearTimeout(tid);
    if (!res.ok) return [];
    const results: Array<{
      place_id: number | string;
      lat: string;
      lon: string;
      display_name: string;
      importance?: number;
      address?: Record<string, string>;
    }> = await res.json();
    const q = normaliseText(query);
    return results
      .map((result) => {
        const name = pickPrimaryPlaceName(result.address, result.display_name);
        const region = pickRegion(result.address);
        const country = result.address?.country ?? null;
        return {
          id: String(result.place_id),
          name,
          label: buildPlaceLabel(name, region, country),
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          region,
          country,
          importance: result.importance ?? 0,
        } satisfies PlaceSuggestion;
      })
      .sort((a, b) => {
        const aPrefix = normaliseText(a.label).startsWith(q) || normaliseText(a.name).startsWith(q) ? 1 : 0;
        const bPrefix = normaliseText(b.label).startsWith(q) || normaliseText(b.name).startsWith(q) ? 1 : 0;
        if (aPrefix !== bPrefix) return bPrefix - aPrefix;
        return b.importance - a.importance;
      });
  } catch {
    return [];
  }
}

export function suggestionToWaypoint(suggestion: PlaceSuggestion): Waypoint {
  return suggestionToInternalWaypoint(suggestion);
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
      duration: number;       // seconds
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

  const stats = buildStats(points, route.distance, route.duration);

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

// ─── Route label detection ────────────────────────────────────────────────────

/**
 * Compute cumulative arc-length in km at each GPX point.
 * Used to convert a lat/lng to a normalised route-progress value.
 */
function buildCumDist(pts: GpxTrackPoint[]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + haversineKm(pts[i - 1], pts[i]));
  }
  return cum;
}

/** Find the normalised progress (0–1) of the route point closest to (lat, lng). */
function closestProgress(
  lat: number, lng: number,
  pts: GpxTrackPoint[], cum: number[],
): number {
  let minD = Infinity;
  let idx = 0;
  for (let i = 0; i < pts.length; i++) {
    const d = haversineKm({ lat, lng }, pts[i]);
    if (d < minD) { minD = d; idx = i; }
  }
  const total = cum[cum.length - 1];
  return total > 0 ? cum[idx] / total : 0;
}

async function reverseGeocodeLabel(
  lat: number, lng: number,
): Promise<{ name: string; region: string | null; country: string | null; priority: "major" | "minor" } | null> {
  try {
    const ctrl = new AbortController();
    const tid = window.setTimeout(() => ctrl.abort(), 4_000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2`,
      { signal: ctrl.signal, headers: { Accept: "application/json" } },
    );
    window.clearTimeout(tid);
    if (!res.ok) return null;
    const data: { address?: Record<string, string> } = await res.json();
    const a = data.address ?? {};
    const name = a.city ?? a.town ?? a.borough ?? a.suburb ?? a.village ?? a.municipality ?? a.county ?? "";
    if (!name) return null;
    const region = pickRegion(a);
    const country = a.country ?? null;
    const priority: "major" | "minor" = (a.city || a.town || a.borough) ? "major" : "minor";
    return { name, region, country, priority };
  } catch {
    return null;
  }
}

export type { RouteLabel };

export function createRouteLabelForWaypoint(
  points: GpxTrackPoint[],
  waypoint: Waypoint,
  options?: {
    priority?: "major" | "minor";
    progress?: number;
    verified?: boolean;
  },
): RouteLabel {
  const cum = buildCumDist(points);
  return {
    name: waypoint.name,
    lat: waypoint.lat,
    lng: waypoint.lng,
    region: waypoint.region ?? null,
    country: waypoint.country ?? null,
    verified: options?.verified ?? true,
    progress: options?.progress ?? closestProgress(waypoint.lat, waypoint.lng, points, cum),
    priority: options?.priority ?? "major",
  };
}

export function normalizeRouteLabels(labels: RouteLabel[]): RouteLabel[] {
  if (labels.length === 0) return [];
  const sorted: RouteLabel[] = [...labels].sort((a, b) => a.progress - b.progress).map((label) => ({
    ...label,
    isStart: undefined,
    isEnd: undefined,
  }));
  sorted[0].isStart = true;
  if (sorted.length > 1) sorted[sorted.length - 1].isEnd = true;
  return disambiguateRouteLabels(sorted);
}

async function verifyWaypointNearCoordinates(
  query: string,
  nearLat: number,
  nearLng: number,
): Promise<Waypoint | null> {
  const suggestions = await searchCitySuggestions(query, { limit: 5 });
  if (suggestions.length === 0) return null;
  const ranked = [...suggestions].sort((a, b) => {
    const aScore = haversineKm({ lat: nearLat, lng: nearLng }, a) - a.importance * 8;
    const bScore = haversineKm({ lat: nearLat, lng: nearLng }, b) - b.importance * 8;
    return aScore - bScore;
  });
  return suggestionToInternalWaypoint(ranked[0]);
}

/**
 * Automatically detect city/place labels along a GPX route.
 *
 * Mode A — knownWaypoints provided (location planner): uses those names
 * directly, no extra network requests.
 *
 * Mode B — GPX import: samples N evenly-spaced points and reverse-geocodes
 * each via Nominatim with 350 ms delays between calls (rate-limit compliance).
 * Duplicates are removed. Returns labels sorted start → end.
 */
export async function detectRouteLabels(
  points: GpxTrackPoint[],
  options?: {
    knownWaypoints?: Waypoint[];
    maxLabels?: number;
  },
): Promise<RouteLabel[]> {
  if (points.length < 2) return [];

  const cum = buildCumDist(points);
  const totalKm = cum[cum.length - 1];

  if (options?.knownWaypoints && options.knownWaypoints.length >= 2) {
    return normalizeRouteLabels(
      options.knownWaypoints.map((wp) =>
        createRouteLabelForWaypoint(points, wp, {
          priority: "major",
          progress: closestProgress(wp.lat, wp.lng, points, cum),
        }),
      ),
    );
  }

  const sampleCount =
    options?.maxLabels ??
    (totalKm < 50 ? 3 : totalKm < 200 ? 4 : totalKm < 500 ? 5 : 6);

  const sampleIndices: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    sampleIndices.push(Math.round((i / (sampleCount - 1)) * (points.length - 1)));
  }

  const rawLabels: RouteLabel[] = [];
  for (let i = 0; i < sampleIndices.length; i++) {
    if (i > 0) await new Promise<void>((r) => window.setTimeout(r, 350));
    const pt = points[sampleIndices[i]];
    const progress = cum[sampleIndices[i]] / (totalKm || 1);
    const result = await reverseGeocodeLabel(pt.lat, pt.lng);
    if (!result) continue;
    const verificationQuery = [result.name, result.country].filter(Boolean).join(", ");
    const verifiedWaypoint =
      await verifyWaypointNearCoordinates(verificationQuery || result.name, pt.lat, pt.lng) ??
      {
        name: result.name,
        label: buildPlaceLabel(result.name, result.region, result.country),
        lat: pt.lat,
        lng: pt.lng,
        region: result.region,
        country: result.country,
      } satisfies Waypoint;
    if (rawLabels.some((l) => normaliseText(l.name) === normaliseText(verifiedWaypoint.name))) continue;
    rawLabels.push(
      createRouteLabelForWaypoint(points, verifiedWaypoint, {
        priority: result.priority,
        progress,
        verified: true,
      }),
    );
  }

  return normalizeRouteLabels(rawLabels);
}
