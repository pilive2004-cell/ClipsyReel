import * as turf from "@turf/turf";
import type { GpxTrackPoint } from "@/types";
import { analyzeGpxSignals } from "@/modules/editing-intelligence/GpxSignals";
import type { EnrichedRoutePoint, RouteMetrics, StoryChapter } from "./types";

/** Downsampling ceiling for the 3D stage — thousands of raw GPX fixes render identically at 60fps once thinned to this, and it keeps every per-frame turf/GL computation cheap even for multi-hour tracks. */
export const MAX_ROUTE_POINTS_FOR_STAGE = 900;

/** Downsamples a track to at most `maxPoints`, always keeping the first and last point exactly (so the route never visually clips its start/finish). */
function downsample(points: GpxTrackPoint[], maxPoints: number): GpxTrackPoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const out: GpxTrackPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(points[Math.round(i * step)]);
  }
  return out;
}

/** Great-circle bearing (0-360°) from `a` toward `b`, via Turf — used to orient the vehicle marker and drive the follow/orbit cameras. */
function bearingBetween(a: GpxTrackPoint, b: GpxTrackPoint): number {
  const deg = turf.bearing(turf.point([a.lng, a.lat]), turf.point([b.lng, b.lat]));
  return (deg + 360) % 360;
}

/**
 * Enriches raw GPX points with cumulative distance (Turf `distance`), speed
 * (from consecutive-point distance/time), bearing (Turf `bearing`) and
 * normalized route progress — the single derived dataset every part of the
 * 3D stage (route line, vehicle marker, camera director, HUD) reads from.
 */
function enrichPoints(points: GpxTrackPoint[]): EnrichedRoutePoint[] {
  if (points.length === 0) return [];
  let cumulativeM = 0;
  const enriched: EnrichedRoutePoint[] = points.map((point, index) => {
    const previous = points[index - 1] ?? point;
    const next = points[index + 1] ?? point;
    if (index > 0) {
      cumulativeM += turf.distance(turf.point([previous.lng, previous.lat]), turf.point([point.lng, point.lat]), { units: "meters" });
    }
    const deltaSeconds =
      index > 0 && point.time && previous.time ? Math.max(0.001, (point.time.getTime() - previous.time.getTime()) / 1000) : null;
    const deltaMeters = index > 0 ? turf.distance(turf.point([previous.lng, previous.lat]), turf.point([point.lng, point.lat]), { units: "meters" }) : 0;
    const speedKmh = deltaSeconds ? (deltaMeters / deltaSeconds) * 3.6 : 0;
    const bearingDeg = bearingBetween(point, next === point ? previous : next);
    return {
      ...point,
      distanceFromStartM: cumulativeM,
      speedKmh: Number.isFinite(speedKmh) ? speedKmh : 0,
      bearingDeg,
      progress: 0, // filled in below once total distance is known
    };
  });

  const total = cumulativeM || 1;
  return enriched.map((p) => ({ ...p, progress: total > 0 ? p.distanceFromStartM / total : 0 }));
}

/**
 * Builds the "Travel Story" chapters (Relive-style highlight reel) directly
 * from `analyzeGpxSignals` — the same real GPX-signal analysis the editing
 * intelligence pipeline already uses to score best moments — so the 3D
 * stage's chapters are grounded in the exact same viewpoints/stops/speed
 * data, not a second, disconnected heuristic.
 */
function buildStoryChapters(enriched: EnrichedRoutePoint[], signals: ReturnType<typeof analyzeGpxSignals>): StoryChapter[] {
  const chapters: StoryChapter[] = [];
  const pointCount = enriched.length;
  const progressOf = (pointIndex: number) => (pointCount > 1 ? clamp(pointIndex / (pointCount - 1), 0, 1) : 0);

  // Highest altitude.
  if (signals.summary.highestAltitudeM !== null) {
    const idx = enriched.reduce((best, p, i) => (p.ele !== null && (enriched[best].ele ?? -Infinity) < p.ele ? i : best), 0);
    chapters.push({
      kind: "highestAltitude",
      title: "Highest point",
      detail: `${Math.round(signals.summary.highestAltitudeM)} m above sea level`,
      pointIndex: idx,
      progress: progressOf(idx),
      elapsedSeconds: enriched[idx]?.time ? secondsFromStart(enriched, idx) : null,
    });
  }

  // Longest distance is the whole ride — anchor the chapter card at the finish.
  if (signals.summary.totalDistanceMeters > 0) {
    const idx = pointCount - 1;
    chapters.push({
      kind: "longestDistance",
      title: "Longest distance",
      detail: `${(signals.summary.totalDistanceMeters / 1000).toFixed(1)} km covered`,
      pointIndex: idx,
      progress: 1,
      elapsedSeconds: signals.summary.totalDurationSeconds || null,
    });
  }

  // Fastest section — the single strongest "speed_peak" interesting moment (already scored/deduped).
  const fastestMoment = signals.interestingMoments
    .filter((m) => m.kind === "speed_peak")
    .sort((a, b) => b.intensity - a.intensity)[0];
  if (fastestMoment) {
    const speedKmh = enriched[fastestMoment.pointIndex]?.speedKmh ?? signals.summary.maxSpeedMps * 3.6;
    chapters.push({
      kind: "fastestSection",
      title: "Fastest section",
      detail: `Peak speed ~${Math.round(speedKmh)} km/h`,
      pointIndex: fastestMoment.pointIndex,
      progress: progressOf(fastestMoment.pointIndex),
      elapsedSeconds: fastestMoment.elapsedSeconds,
    });
  }

  // Most scenic viewpoint — highest `scenicScore`.
  const bestViewpoint = [...signals.viewpoints].sort((a, b) => b.scenicScore - a.scenicScore)[0];
  if (bestViewpoint) {
    chapters.push({
      kind: "mostScenicViewpoint",
      title: "Most scenic viewpoint",
      detail: `${Math.round(bestViewpoint.altitudeM)} m — a standout view along the route`,
      pointIndex: bestViewpoint.pointIndex,
      progress: progressOf(bestViewpoint.pointIndex),
      elapsedSeconds: bestViewpoint.elapsedSeconds,
    });
  }

  // Longest stop.
  const longestStop = [...signals.stops].sort((a, b) => b.durationSeconds - a.durationSeconds)[0];
  if (longestStop) {
    chapters.push({
      kind: "longestStop",
      title: "Longest stop",
      detail: `${Math.round(longestStop.durationSeconds / 60)} min pause`,
      pointIndex: longestStop.startPointIndex,
      progress: progressOf(longestStop.startPointIndex),
      elapsedSeconds: longestStop.startElapsedSeconds,
    });
  }

  return chapters.sort((a, b) => a.progress - b.progress);
}

function secondsFromStart(enriched: EnrichedRoutePoint[], index: number): number | null {
  const start = enriched[0]?.time;
  const at = enriched[index]?.time;
  if (!start || !at) return null;
  return (at.getTime() - start.getTime()) / 1000;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * The single entry point the 3D module needs: raw parsed GPX points in,
 * everything the cinematic stage/player/exporter need out — downsampled to
 * a render-friendly point count, enriched with distance/speed/bearing, and
 * paired with auto-generated Travel Story chapters.
 */
export function computeRouteMetrics(rawPoints: GpxTrackPoint[], maxPoints: number = MAX_ROUTE_POINTS_FOR_STAGE): RouteMetrics {
  const points = downsample(rawPoints, maxPoints);
  const enriched = enrichPoints(points);
  const signals = analyzeGpxSignals(points);
  const chapters = buildStoryChapters(enriched, signals);

  return {
    points: enriched,
    totalDistanceMeters: signals.summary.totalDistanceMeters,
    totalDurationSeconds: signals.summary.totalDurationSeconds || null,
    maxSpeedKmh: signals.summary.maxSpeedMps * 3.6,
    highestAltitudeM: signals.summary.highestAltitudeM,
    elevationGainM: enriched.reduce((sum, p, i) => {
      if (i === 0) return sum;
      const prevEle = enriched[i - 1].ele;
      if (p.ele === null || prevEle === null) return sum;
      const delta = p.ele - prevEle;
      return delta > 0 ? sum + delta : sum;
    }, 0),
    chapters,
    signals,
  };
}

/** Interpolated point at any [0,1] progress along the enriched route — the core sampling function the stage/camera/HUD all call every animation frame. */
export function samplePointAtProgress(points: EnrichedRoutePoint[], progress: number): EnrichedRoutePoint | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0];
  const clamped = clamp(progress, 0, 1);
  const exact = clamped * (points.length - 1);
  const index = Math.floor(exact);
  const t = exact - index;
  const a = points[index];
  const b = points[Math.min(index + 1, points.length - 1)];
  if (t === 0 || a === b) return a;
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    ele: a.ele !== null && b.ele !== null ? a.ele + (b.ele - a.ele) * t : a.ele ?? b.ele ?? null,
    time: null,
    distanceFromStartM: a.distanceFromStartM + (b.distanceFromStartM - a.distanceFromStartM) * t,
    speedKmh: a.speedKmh + (b.speedKmh - a.speedKmh) * t,
    bearingDeg: a.bearingDeg,
    progress: clamped,
  };
}
