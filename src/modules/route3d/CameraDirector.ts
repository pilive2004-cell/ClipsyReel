import type { EnrichedRoutePoint, CameraMode } from "./types";

/** What the 3D stage needs to point a MapLibre/Mapbox-style camera at, each frame. */
export interface CameraParams {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function computeRouteOverview(points: EnrichedRoutePoint[]) {
  if (points.length === 0) return { center: [0, 0] as [number, number], zoom: 12 };
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }
  const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  const latSpan = Math.max(0.00001, maxLat - minLat);
  const lngSpan = Math.max(0.00001, maxLng - minLng);
  const span = Math.max(latSpan, lngSpan);
  const zoom = clamp(10.8 - Math.log2(span * 18), 7.0, 13.5);
  return { center, zoom };
}

export interface CameraContext {
  points: EnrichedRoutePoint[];
  progress: number;
  /** Seconds since the current camera mode became active — keeps the journey mode gently evolving even before the route reaches its final chapters. */
  modeElapsedSeconds: number;
  speedKmh: number;
  /** 0-1 proxy for how dramatic/complex the surrounding route is (feeds zoom/pitch choices) — see `terrainComplexityAt`. */
  terrainComplexity: number;
}

/**
 * Pure per-mode camera geometry — the 3 route-story camera behaviors.
 * Each mode reacts to the same GPX context differently so the UI can stay
 * intuitive while still feeling cinematic.
 */
function computeModeParams(mode: CameraMode, ctx: CameraContext): CameraParams {
  const { points } = ctx;
  const overview = computeRouteOverview(points);

  return {
    center: overview.center,
    zoom: overview.zoom,
    pitch: 22,
    bearing: 0,
  };
}

/**
 * Stateful wrapper around `computeModeParams` that blends the OLD mode's
 * camera params into the newly-selected mode's params over
 * `TRANSITION_MS` — this is what makes switching e.g. Follow → Orbit read
 * as a smooth cinematic move instead of an instant, jarring snap.
 */
export class CameraDirector {
  private mode: CameraMode = "overview";

  setMode(mode: CameraMode) {
    this.mode = mode;
  }

  getMode() {
    return this.mode;
  }

  getParams(points: EnrichedRoutePoint[]): CameraParams {
    return computeModeParams(this.mode, { points, progress: 0, modeElapsedSeconds: 0, speedKmh: 0, terrainComplexity: 0 });
  }
}

/** Cheap terrain-complexity proxy (0-1): how much the route's bearing is changing around this progress point — sharp/frequent turns and switchbacks read as "complex" terrain worth a flatter, wider camera. */
export function terrainComplexityAt(points: EnrichedRoutePoint[], progress: number, windowSize = 6): number {
  if (points.length < 3) return 0;
  const centerIndex = clamp(Math.round(progress * (points.length - 1)), 0, points.length - 1);
  const from = Math.max(0, centerIndex - windowSize);
  const to = Math.min(points.length - 1, centerIndex + windowSize);
  let totalDelta = 0;
  let count = 0;
  for (let i = from + 1; i <= to; i++) {
    const delta = Math.abs(((points[i].bearingDeg - points[i - 1].bearingDeg + 540) % 360) - 180);
    totalDelta += delta;
    count++;
  }
  const avgDelta = count > 0 ? totalDelta / count : 0;
  return clamp(avgDelta / 35, 0, 1);
}
