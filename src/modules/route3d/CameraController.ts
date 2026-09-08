/**
 * Smooth camera controller for the Route Story Player.
 *
 * Design principles:
 * - Exponential lerp (α = 1 − e^(−k·dt)) is frame-rate independent unlike a
 *   fixed per-frame lerp factor, so the camera feels the same at 30fps or 120fps.
 * - "Follow" mode is always North-up (bearing=0) so CartoDB/OSM map labels
 *   remain horizontal and readable throughout the animation.
 * - "Cinematic" mode adds pitch and slowly rotates bearing to track the route
 *   direction, giving a more dramatic feel.
 * - Zoom adapts to vehicle speed: slower → more zoom (city context), faster →
 *   wider view (highway/regional context). All zoom values stay in the range
 *   where CartoDB Voyager labels (city names, road names) remain legible.
 * - Overview mode uses fitBounds via the caller (Map.fitBounds) — the controller
 *   only handles per-frame camera smoothing for follow/cinematic modes.
 */

import type { EnrichedRoutePoint } from "./types";
import type { CameraMode } from "./types";

// ─── Tunables ────────────────────────────────────────────────────────────────

/** How many "half-lives" the camera position travels per second toward target.
 *  3.0 → 63% there in ~333ms, 95% in ~1s — feels responsive but smooth. */
const POSITION_LERP_SPEED = 3.5;

/** Slightly slower bearing lerp avoids a spinning feeling on sharp turns. */
const BEARING_LERP_SPEED = 2.0;

/** Zoom lerp speed — slower to avoid jarring zoom changes. */
const ZOOM_LERP_SPEED = 1.5;

/** Pitch lerp speed. */
const PITCH_LERP_SPEED = 2.0;

// Zoom range ensuring CartoDB Voyager labels (city names, road names) stay visible.
const MIN_FOLLOW_ZOOM = 9.5;
const MAX_FOLLOW_ZOOM = 13.5;

/** Zoom offset above the speed-derived base that the "follow" mode adds. */
const CINEMATIC_ZOOM_OFFSET = -0.75; // slightly wider than follow

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CameraState {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number; // 0-360, compass degrees
  pitch: number;   // 0-60, degrees from vertical
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Exponential-decay lerp, frame-rate independent.
 *  α = 1 − e^(−speed·dt)  ≈ speed·dt for small dt. */
function expLerp(current: number, target: number, speed: number, dt: number): number {
  const alpha = 1 - Math.exp(-speed * dt);
  return current + (target - current) * alpha;
}

/** Lerps bearing along the shortest arc, handling the 0/360 wraparound. */
function lerpBearing(current: number, target: number, speed: number, dt: number): number {
  const alpha = 1 - Math.exp(-speed * dt);
  // Shortest angular delta in [−180, +180]
  const delta = ((target - current + 540) % 360) - 180;
  return ((current + delta * alpha) + 360) % 360;
}

/**
 * Computes the target zoom level for follow/cinematic modes based on vehicle speed.
 *
 * Logic:
 *   - At standstill / low speed (cycling < 20 km/h): zoom 13 — shows streets,
 *     neighbourhood names, individual road labels.
 *   - At city speed (50 km/h): zoom ~12 — shows district + surrounding towns.
 *   - At motorway speed (120 km/h): zoom ~10.5 — shows full region, city names.
 *
 * All values stay above CartoDB Voyager's label-visibility threshold (~9).
 */
function zoomFromSpeed(speedKmh: number): number {
  // Clamp speed to [0, 140] then map logarithmically
  const s = clamp(speedKmh, 0, 140);
  // At 0 km/h → 13.0, at 140 km/h → 10.5
  const zoom = 13.0 - (s / 140) * 2.5;
  return clamp(zoom, MIN_FOLLOW_ZOOM, MAX_FOLLOW_ZOOM);
}

/**
 * Computes overview camera params that fit the entire route into view.
 * Returns center and zoom; caller supplies the actual map bounds via fitBounds.
 */
export function computeOverviewCamera(points: EnrichedRoutePoint[]): Pick<CameraState, "lng" | "lat" | "zoom"> {
  if (points.length === 0) return { lng: 0, lat: 0, zoom: 9 };

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const latSpan = Math.max(0.00001, maxLat - minLat);
  const lngSpan = Math.max(0.00001, maxLng - minLng);
  const span = Math.max(latSpan, lngSpan);

  // Empirical formula: larger span → lower zoom.
  // span=0.1° (≈10km) → ~12.8 | span=1° (≈100km) → ~10.1 | span=10° → ~7.5
  const zoom = clamp(10.8 - Math.log2(span * 18), 6.5, 13.5);

  return { lng: centerLng, lat: centerLat, zoom };
}

// ─── CameraController ─────────────────────────────────────────────────────────

/**
 * Stateful camera controller: computes a target CameraState each frame and
 * exponentially lerps the current state toward it.
 *
 * Usage:
 * ```ts
 * // Once on mount
 * const cc = new CameraController(initialState);
 *
 * // Every animation frame (inside renderFrame)
 * const smoothed = cc.update(dt, vehiclePoint, allPoints, cameraMode);
 * map.jumpTo({ center: [smoothed.lng, smoothed.lat], zoom: smoothed.zoom,
 *              bearing: smoothed.bearing, pitch: smoothed.pitch });
 * ```
 */
export class CameraController {
  private current: CameraState;

  constructor(initial: CameraState) {
    this.current = { ...initial };
  }

  /** Resets the smoothed state to a new value (e.g. after the overview fitBounds). */
  reset(state: CameraState) {
    this.current = { ...state };
  }

  /**
   * Advances the smoothed camera by dt seconds toward the target determined
   * by mode + vehicle context. Returns the smoothed state to apply to the map.
   */
  update(
    dt: number,
    vehicle: EnrichedRoutePoint,
    allPoints: EnrichedRoutePoint[],
    mode: CameraMode,
  ): CameraState {
    const target = this.computeTarget(vehicle, allPoints, mode);
    this.current = this.lerp(this.current, target, dt);
    return { ...this.current };
  }

  /** Snap to a target with no smoothing (used for scrubbing / reset). */
  snap(vehicle: EnrichedRoutePoint, allPoints: EnrichedRoutePoint[], mode: CameraMode) {
    this.current = this.computeTarget(vehicle, allPoints, mode);
  }

  private computeTarget(
    vehicle: EnrichedRoutePoint,
    allPoints: EnrichedRoutePoint[],
    mode: CameraMode,
  ): CameraState {
    if (mode === "overview") {
      const ov = computeOverviewCamera(allPoints);
      return { lng: ov.lng, lat: ov.lat, zoom: ov.zoom, bearing: 0, pitch: 0 };
    }

    const targetZoom = zoomFromSpeed(vehicle.speedKmh) + (mode === "cinematic" ? CINEMATIC_ZOOM_OFFSET : 0);

    if (mode === "follow") {
      return {
        lng: vehicle.lng,
        lat: vehicle.lat,
        zoom: targetZoom,
        bearing: 0, // North-up: labels stay readable
        pitch: 0,
      };
    }

    // "cinematic" — camera tracks route bearing with gentle pitch
    return {
      lng: vehicle.lng,
      lat: vehicle.lat,
      zoom: targetZoom,
      bearing: vehicle.bearingDeg,
      pitch: 28,
    };
  }

  private lerp(current: CameraState, target: CameraState, dt: number): CameraState {
    const safeDt = clamp(dt, 0, 0.25); // Cap dt to avoid huge jumps after tab switch
    return {
      lng: expLerp(current.lng, target.lng, POSITION_LERP_SPEED, safeDt),
      lat: expLerp(current.lat, target.lat, POSITION_LERP_SPEED, safeDt),
      zoom: expLerp(current.zoom, target.zoom, ZOOM_LERP_SPEED, safeDt),
      bearing: lerpBearing(current.bearing, target.bearing, BEARING_LERP_SPEED, safeDt),
      pitch: expLerp(current.pitch, target.pitch, PITCH_LERP_SPEED, safeDt),
    };
  }
}
