/**
 * RouteService — abstraction layer for geocoding and road routing.
 *
 * Architecture:
 *   GeocoderProvider   → turns a place-name string into a lat/lng coordinate
 *   RoutingProvider    → turns two coordinates into a GeoJSON LineString (road-snapped)
 *
 * Built-in implementations (all free, no API key):
 *   NominatimGeocoder   — OpenStreetMap's geocoding API (rate-limited for demo; swap for
 *                         Mapbox / Google Geocoding / Pelias in production)
 *   OsrmRouteProvider   — OSRM public demo server; returns a real road-snapped route.
 *                         NOT suitable for production load — replace with a self-hosted
 *                         OSRM instance, OpenRouteService, Mapbox Directions, or Google
 *                         Directions API when shipping to users.
 *   StraightLineProvider — Fallback: interpolates a straight-line "route" between the two
 *                          points. Always available, but not road-snapped.
 *
 * Usage:
 *   const geocoder = new NominatimGeocoder();
 *   const router   = new OsrmRouteProvider();
 *
 *   const start = await geocoder.geocode("Las Vegas, NV");
 *   const end   = await geocoder.geocode("Salt Lake City, UT");
 *   const route = await router.getRoute(start, end);
 *
 *   // route.coordinates is [lng, lat][] ready for computeRouteMetrics
 */

// ─── Core types ───────────────────────────────────────────────────────────────

export interface GeocodedPlace {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteGeometry {
  /** [lng, lat] pairs along the road-snapped route. */
  coordinates: [number, number][];
  /** Approximate total distance in meters. */
  distanceMeters: number;
  /** Approximate travel duration in seconds (may be null for straight-line). */
  durationSeconds: number | null;
}

// ─── Provider interfaces ──────────────────────────────────────────────────────

/** Resolves a place-name string to geographic coordinates. */
export interface GeocoderProvider {
  readonly name: string;
  geocode(query: string): Promise<GeocodedPlace[]>;
}

/** Resolves a start + end coordinate pair to a road-snapped route geometry. */
export interface RoutingProvider {
  readonly name: string;
  getRoute(start: GeocodedPlace, end: GeocodedPlace): Promise<RouteGeometry>;
}

// ─── NominatimGeocoder ────────────────────────────────────────────────────────

/**
 * Free OpenStreetMap geocoder.
 * Nominatim usage policy: max 1 request/second, no bulk geocoding, must set a User-Agent.
 * For production, replace with Mapbox Geocoding API or a self-hosted Nominatim instance.
 */
export class NominatimGeocoder implements GeocoderProvider {
  readonly name = "Nominatim (OpenStreetMap)";

  async geocode(query: string): Promise<GeocodedPlace[]> {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim requires a descriptive User-Agent.
        "User-Agent": "ClipsyReel-RouteStory/1.0 (route map preview feature)",
        Accept: "application/json",
      },
    });

    if (!res.ok) throw new Error(`Nominatim error ${res.status}: ${res.statusText}`);

    const data: Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
      type: string;
    }> = await res.json();

    return data.map((item) => ({
      name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  }
}

// ─── OsrmRouteProvider ────────────────────────────────────────────────────────

/**
 * OSRM public demo server — returns a real road-snapped route.
 *
 * ⚠️  The public demo server (router.project-osrm.org) is for development/demo
 *     only. It may be slow, rate-limited, or unavailable. For production:
 *     - Self-host OSRM: https://project-osrm.org/
 *     - Use OpenRouteService: https://openrouteservice.org/
 *     - Use Mapbox Directions: https://docs.mapbox.com/api/navigation/
 *     - Use Google Directions: https://developers.google.com/maps/documentation/directions
 *
 * To use a different routing backend, implement `RoutingProvider` and inject it
 * where `OsrmRouteProvider` is used — zero other changes needed.
 */
export class OsrmRouteProvider implements RoutingProvider {
  readonly name = "OSRM (demo)";

  constructor(
    /** Override with your own OSRM/routing server base URL. */
    private readonly baseUrl = "https://router.project-osrm.org",
    /** Routing profile: "driving", "cycling", "foot". */
    private readonly profile: "driving" | "cycling" | "foot" = "driving",
  ) {}

  async getRoute(start: GeocodedPlace, end: GeocodedPlace): Promise<RouteGeometry> {
    const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    const url = `${this.baseUrl}/route/v1/${this.profile}/${coords}?overview=full&geometries=geojson`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`OSRM error ${res.status}: ${res.statusText}`);

    const data: {
      code: string;
      routes?: Array<{
        geometry: { coordinates: [number, number][] };
        distance: number;
        duration: number;
      }>;
      message?: string;
    } = await res.json();

    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error(`OSRM: ${data.message ?? "no route found"}`);
    }

    const route = data.routes[0];
    return {
      coordinates: route.geometry.coordinates,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  }
}

// ─── StraightLineProvider (fallback) ─────────────────────────────────────────

/**
 * Fallback routing provider that creates a straight-line interpolated route
 * between two points. Used when no real routing API is reachable.
 * The result is NOT road-snapped — it goes in a straight line regardless of
 * terrain or roads.
 */
export class StraightLineProvider implements RoutingProvider {
  readonly name = "Straight line (fallback)";

  /** Number of intermediate points to generate for smooth animation. */
  constructor(private readonly steps = 200) {}

  async getRoute(start: GeocodedPlace, end: GeocodedPlace): Promise<RouteGeometry> {
    const coords: [number, number][] = [];
    for (let i = 0; i <= this.steps; i++) {
      const t = i / this.steps;
      coords.push([
        start.lng + (end.lng - start.lng) * t,
        start.lat + (end.lat - start.lat) * t,
      ]);
    }

    // Approximate distance using haversine
    const R = 6371000; // Earth radius in meters
    const lat1 = (start.lat * Math.PI) / 180;
    const lat2 = (end.lat * Math.PI) / 180;
    const dLat = lat2 - lat1;
    const dLng = ((end.lng - start.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const distanceMeters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return {
      coordinates: coords,
      distanceMeters,
      durationSeconds: null,
    };
  }
}

// ─── RouteService facade ───────────────────────────────────────────────────────

/**
 * High-level facade used by the UI.
 * Attempts OSRM first, falls back to straight-line if routing fails.
 */
export class RouteService {
  private geocoder: GeocoderProvider;
  private router: RoutingProvider;
  private fallback: RoutingProvider;

  constructor(
    geocoder: GeocoderProvider = new NominatimGeocoder(),
    router: RoutingProvider = new OsrmRouteProvider(),
  ) {
    this.geocoder = geocoder;
    this.router = router;
    this.fallback = new StraightLineProvider();
  }

  async geocode(query: string): Promise<GeocodedPlace[]> {
    return this.geocoder.geocode(query);
  }

  /**
   * Fetches a route between two geocoded places.
   * Falls back to straight-line if the primary router fails.
   */
  async getRoute(
    start: GeocodedPlace,
    end: GeocodedPlace,
  ): Promise<RouteGeometry & { usedFallback: boolean }> {
    try {
      const route = await this.router.getRoute(start, end);
      return { ...route, usedFallback: false };
    } catch (err) {
      console.warn(`[RouteService] Primary router (${this.router.name}) failed — using straight-line fallback.`, err);
      const route = await this.fallback.getRoute(start, end);
      return { ...route, usedFallback: true };
    }
  }
}

/** Singleton instance for convenience. Swap providers here for production. */
export const routeService = new RouteService();
