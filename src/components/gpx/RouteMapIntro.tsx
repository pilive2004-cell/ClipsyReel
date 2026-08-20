"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import type { GpxRouteStats, GpxTrackPoint, RouteLabel } from "@/types";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";

/**
 * Configure MapLibre to load its worker from a static URL instead of a blob:.
 * blob: workers are blocked by COEP (Cross-Origin-Embedder-Policy: require-corp)
 * which is required by ffmpeg.wasm for SharedArrayBuffer support.
 */
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}

// ─── Constants ────────────────────────────────────────────────────────────────

export interface RouteIntroClip {
  file: File;
  url: string;
  durationSeconds: number;
}

interface RouteMapIntroProps {
  points: GpxTrackPoint[];
  routeStats?: GpxRouteStats | null;
  /**
   * Pre-filled city/place labels from the route planner or GPX detection.
   * When provided, the component skips its own Nominatim reverse-geocoding
   * and uses these labels directly — faster start and no duplicate API calls.
   * Labels must be sorted by `progress` (0 = start, 1 = end).
   */
  initialLabels?: RouteLabel[];
  onClipReady: (clip: RouteIntroClip | null) => void;
  onStatusChange?: (status: "idle" | "rendering" | "ready" | "error") => void;
  hideUi?: boolean;
}

/** Total duration of the generated intro clip in seconds. */
const CLIP_DURATION_SECONDS = 26;
const MAP_WIDTH = 720;
const MAP_HEIGHT = 1280;
const RECORD_FPS = 24;

/**
 * 5-phase cinematic timeline (all values in seconds):
 *
 *   Phase 0 (0 → T_OVERVIEW)    Country/region context. Full ghost route shown.
 *                                Camera holds at capped overview zoom (≤ z8 so
 *                                it's never continent-scale). Title card visible.
 *   Phase 1 (T_OVERVIEW → T_ZOOMIN)  Smooth zoom-in to the route start point at
 *                                DETAIL_ZOOM (z12) — villages and roads readable.
 *   Phase 2 (T_ZOOMIN → T_DRAW)  Route draws itself. Camera follows the drawing
 *                                head at DETAIL_ZOOM. Labels pop in progressively.
 *   Phase 3 (T_DRAW → T_HOLD)    Route complete. Camera holds near the end,
 *                                pitch flattens.
 *   Phase 4 (T_HOLD → end)       Smooth zoom-out back to full-route overview.
 */
const T_OVERVIEW  = 5;   // s — end of regional hold (extended for title readability)
const T_ZOOMIN    = 10;  // s — end of zoom-in to start
const T_DRAW      = 21;  // s — end of route-draw phase
const T_HOLD      = 23;  // s — end of completion hold
// Phase 4: T_HOLD → CLIP_DURATION_SECONDS

/**
 * Fixed close-up zoom used during route exploration.
 * CartoDB Voyager at zoom 12 shows: village names, secondary roads, terrain.
 * We hardcode this — never derive it from the overview zoom — so the detail
 * phase is always readable regardless of route length.
 */
const DETAIL_ZOOM = 12;

/**
 * Overview zoom is capped so the detail phase is always a zoom-IN (or same).
 * z13 allows short routes (10 km) to have a proper overview zoom around z10-12
 * while long routes (500+ km) sit at z6-8 naturally — no cap needed for those.
 */
const OVERVIEW_MAX_ZOOM = 13;

/**
 * Number of evenly-spaced points the route is resampled to before animation.
 * This normalises sparse GPX files (one point every 2 km) and dense ones
 * (one point every 5 m) so the camera follows at a perfectly constant speed
 * without any sudden jerks or stalls.
 */
const ROUTE_RESAMPLE_COUNT = 280;

/**
 * Exponential-smoothing constants for the camera state.
 * Formula: current = target + (current - target) * exp(-k * dt)
 * Higher k → camera catches up faster (snappier, slight overshoot risk).
 * Lower k  → camera lags more (very smooth, but may feel sluggish).
 * Position and zoom use different constants so the viewer's eye naturally
 * tracks the movement without the horizon bouncing.
 */
const K_POS  = 5.5;   // lat/lng convergence speed
const K_ZOOM = 3.5;   // zoom convergence speed (slower = no zoom jitter)
const K_PITCH = 4.0;  // pitch convergence speed

/**
 * Dynamic place-name zoom — Phase 2 only.
 *
 * When the drawing head approaches a labelled waypoint within
 * LABEL_ZOOM_TRIGGER_KM, the camera smoothly zooms in to
 * LABEL_ZOOM_IN_LEVEL so the name becomes fully readable, then
 * eases back to DETAIL_ZOOM once the head has moved away.
 *
 * Hysteresis (zoom-out threshold = 1.5× zoom-in threshold) prevents
 * oscillation when the head lingers near the trigger boundary.
 * expSmooth(K_ZOOM) provides the cinematic transition — no additional
 * timer logic is needed.
 *
 * Adjust these two constants to tune the feel:
 */
const LABEL_ZOOM_IN_LEVEL   = 14;    // target zoom when near a place (streets readable)
const LABEL_ZOOM_TRIGGER_KM = 1.0;   // km — approach distance that triggers zoom-in

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Smooth cubic ease-in-out — used for keyframe interpolation. */
function easeInOut(t: number) {
  const c = clamp(t, 0, 1);
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Frame-rate-independent exponential smoothing.
 * Eliminates jitter by converging toward `target` at rate `k` per second,
 * regardless of how frequently it is called.
 *
 *   factor = exp(-k * dt)
 *   result = target + (current - target) * factor
 *
 * At k=5.5 and 60fps (dt≈0.0167s): factor ≈ 0.910 → moves ~9% per frame.
 * At k=5.5 and 30fps (dt≈0.033s):  factor ≈ 0.830 → moves ~17% per frame.
 * The convergence *speed* in real time stays the same at any frame rate.
 */
function expSmooth(current: number, target: number, k: number, dt: number): number {
  if (dt <= 0) return current;
  return target + (current - target) * Math.exp(-k * dt);
}

/**
 * Represents the smoothed camera state that drives every `jumpTo` call.
 * All values are floating-point; the smoothing functions converge them toward
 * the timeline's target values each frame.
 */
interface CamState {
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
}

/** Haversine distance between two GPX points in metres. */
function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aa = sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

/**
 * Re-sample a GPX track to exactly `n` evenly-spaced positions.
 *
 * Problem solved: raw GPX files are often highly uneven — one point every
 * 2 km in the mountains, one every 10 m in the city. If the camera follows
 * raw points it lurches through dense sections and freezes through sparse ones.
 * After resampling, every step is the same arc-length, giving perfectly
 * constant-speed camera movement.
 */
function resampleRoute(points: GpxTrackPoint[], n: number): GpxTrackPoint[] {
  if (points.length < 2) return points;
  if (points.length === n) return points;

  // 1. Compute cumulative arc-length at each raw point
  const dist = [0];
  for (let i = 1; i < points.length; i++) {
    dist.push(dist[i - 1] + haversineM(points[i - 1], points[i]));
  }
  const total = dist[dist.length - 1];
  if (total === 0) return points;

  // 2. Place n evenly-spaced samples along the arc
  const result: GpxTrackPoint[] = [];
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total;
    // Advance segment pointer until the sample falls within this segment
    while (seg < points.length - 2 && dist[seg + 1] < target) seg++;
    const segLen = dist[seg + 1] - dist[seg];
    const t = segLen > 0 ? (target - dist[seg]) / segLen : 0;
    result.push({
      lat: points[seg].lat + (points[seg + 1].lat - points[seg].lat) * t,
      lng: points[seg].lng + (points[seg + 1].lng - points[seg].lng) * t,
      ele: null,
      time: null,
    });
  }
  return result;
}

/**
 * Compute the ideal overview camera (center + zoom) so the full GPX route is
 * centred inside the canvas with `paddingPx` margin on every side.
 *
 * Uses pure Mercator mathematics so the result is available BEFORE the Map
 * is constructed and does not depend on MapLibre's fitBounds / getCenter
 * timing (which is sensitive to async rendering pipeline state).
 *
 * Key formula (MapLibre internal world size = 512 at zoom 0):
 *   pixels_at_zoom_z = dimension_in_mercator_units * 512 * 2^z
 *
 * We solve for z independently for width and height and take the minimum.
 */
function computeOverviewCamera(
  points: GpxTrackPoint[],
  canvasW: number,
  canvasH: number,
  paddingPx: number,
  maxZoom: number,
): { centerLng: number; centerLat: number; zoom: number } {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const p of points) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }

  // Web Mercator Y (top-down, 0 = north, 1 = south for the visible world).
  const mercY = (lat: number) =>
    0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);

  // Inverse: Mercator Y → latitude degrees.
  const mercYToLat = (y: number) =>
    (2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) * (180 / Math.PI);

  const usableW = canvasW - 2 * paddingPx;
  const usableH = canvasH - 2 * paddingPx;

  const dLng = maxLng - minLng;
  // northernmost lat → smallest Y (top), southernmost → largest Y (bottom)
  const topMercY    = mercY(maxLat);
  const bottomMercY = mercY(minLat);
  const dMercY      = bottomMercY - topMercY;   // always positive

  // Guard degenerate (single-point) routes
  if (dLng < 1e-8 || dMercY < 1e-8) {
    return {
      centerLng: (minLng + maxLng) / 2,
      centerLat: (minLat + maxLat) / 2,
      zoom: Math.min(maxZoom, 14),
    };
  }

  // MapLibre's internal world coordinate system is always 512 pixels at zoom 0.
  const WORLD = 512;
  const zw = Math.log2((usableW / WORLD) * 360 / dLng);
  const zh = Math.log2((usableH / WORLD) / dMercY);
  const zoom = Math.min(zw, zh, maxZoom);

  const centerLng   = (minLng + maxLng) / 2;
  const centerMercY = (topMercY + bottomMercY) / 2;   // Mercator midpoint (not lat midpoint)
  const centerLat   = mercYToLat(centerMercY);

  return { centerLng, centerLat, zoom };
}

/** Pick N evenly-spaced waypoints along the route (including start & end). */
function pickWaypoints(points: GpxTrackPoint[], n: number): GpxTrackPoint[] {
  if (points.length === 0) return [];
  if (n <= 1) return [points[0]];
  return Array.from({ length: n }, (_, i) => {
    const idx = Math.round((i / (n - 1)) * (points.length - 1));
    return points[clamp(idx, 0, points.length - 1)];
  });
}

/**
 * Compute the cumulative distance fraction (0–1) for each GPX point.
 * Used to tie label appearance to geographic route progress.
 */
function computeProgressPerPoint(points: GpxTrackPoint[]): number[] {
  let total = 0;
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    total += haversineM(points[i - 1], points[i]);
    cum.push(total);
  }
  return cum.map((d) => (total > 0 ? d / total : 0));
}

/** Reverse-geocode a single coordinate via Nominatim. Returns a short label. */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const ctrl = new AbortController();
    const tid = window.setTimeout(() => ctrl.abort(), 3_500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2`,
      { signal: ctrl.signal, headers: { Accept: "application/json" } },
    );
    window.clearTimeout(tid);
    if (!res.ok) return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    const data: { address?: Record<string, string> } = await res.json();
    const a = data.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";
    const country = a.country ?? "";
    return [city, country].filter(Boolean).join(", ") || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  } catch {
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  }
}

/** Build a GeoJSON LineString from the first `count` points. */
function buildLineGeoJSON(points: GpxTrackPoint[], count: number): GeoJSON.FeatureCollection {
  const n = Math.max(2, Math.min(count, points.length));
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: points.slice(0, n).map((p) => [p.lng, p.lat]),
        },
        properties: {},
      },
    ],
  };
}

/** Build a GeoJSON FeatureCollection of labelled waypoints. */
function buildLabelsGeoJSON(
  labels: Array<{ lng: number; lat: number; name: string; isStart?: boolean; isEnd?: boolean }>,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: labels.map((l) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [l.lng, l.lat] },
      properties: { name: l.name, isStart: l.isStart ?? false, isEnd: l.isEnd ?? false },
    })),
  };
}

async function readBlobDuration(blob: Blob, fallback: number): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : fallback); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(fallback); };
    v.src = url;
  });
}

function pickMimeType(): string {
  for (const t of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

/**
 * Draws a cinematic title banner (departure → destination) directly onto the
 * compositing canvas using the Canvas 2D API.
 *
 * Shown in two moments:
 *   Phase 0 (0 – T_OVERVIEW):   viewer reads route endpoints while the overview
 *                                 establishes geographic context.
 *   Phase 4 (T_HOLD+1 – end):   brief reprise as the camera zooms out.
 *
 * Layout (bottom 38% of frame, 9:16):
 *   • ROUTE •         ← micro-label in route red
 *   START CITY        ← departure, medium weight
 *   ──────            ← red separator line
 *   END CITY          ← destination, large bold — the hero text
 *
 * SAFE AREA: all text is constrained to [SAFE_X, w - SAFE_X] horizontally.
 * Long city names automatically have their font size reduced until they fit.
 */

/** Horizontal inset (px) that no text element may cross. */
const TITLE_SAFE_X = 52;

/**
 * Returns the largest font size at which `text` fits within `maxW` pixels,
 * starting at `idealSize` and stepping down to `minSize`.
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: string,
  idealSize: number,
  minSize: number,
  maxW: number,
  fontStack: string,
): number {
  let size = idealSize;
  ctx.font = `${weight} ${size}px ${fontStack}`;
  while (ctx.measureText(text).width > maxW && size > minSize) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${fontStack}`;
  }
  return size;
}

function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  startName: string,
  endName: string,
  w: number,
  h: number,
) {
  // Alpha envelope — smooth fade-in/out at phase transitions
  // Title is fully visible for ~3 seconds before the zoom-in begins.
  let alpha = 0;
  if (elapsed < 1.4) {
    alpha = easeInOut(elapsed / 1.4);                                          // fade in 0→1
  } else if (elapsed < T_OVERVIEW - 1.0) {
    alpha = 1;                                                                  // hold (1.4s → 4.0s = 2.6s full visibility)
  } else if (elapsed < T_OVERVIEW + 0.8) {
    alpha = easeInOut(Math.max(0, (T_OVERVIEW + 0.8 - elapsed) / 1.8));        // fade out
  } else if (elapsed > T_HOLD + 1.0 && elapsed < CLIP_DURATION_SECONDS - 0.8) {
    // Phase-4 reprise: fade in → hold → fade out
    const repriseLen = CLIP_DURATION_SECONDS - 0.8 - (T_HOLD + 1.0);
    const t = (elapsed - (T_HOLD + 1.0)) / repriseLen;
    alpha = easeInOut(Math.min(1, t < 0.3 ? t / 0.3 : t > 0.7 ? (1 - t) / 0.3 : 1));
  }
  if (alpha < 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Maximum text width — both left and right edges are protected by TITLE_SAFE_X
  const maxTextW = w - TITLE_SAFE_X * 2;
  const fontStack = `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;

  // Dark gradient fills the bottom 28% of the frame as a semi-transparent
  // overlay. The route line is visible through it (gradient starts at 0 alpha).
  const gradH = Math.round(h * 0.28);
  const grad = ctx.createLinearGradient(0, h - gradH, 0, h);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.35, "rgba(0,0,0,0.72)");
  grad.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - gradH, w, gradH);

  const cx = w / 2;
  ctx.textAlign = "center";

  // ── Destination (large, 800-weight) — font size auto-reduced to fit safe area
  const destIdeal = Math.round(w * 0.078);
  const destSize = fitFontSize(ctx, endName.toUpperCase(), "800", destIdeal, 28, maxTextW, fontStack);
  const destY = h - Math.round(h * 0.072);
  ctx.font = `800 ${destSize}px ${fontStack}`;
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(endName.toUpperCase(), cx, destY);

  // ── Red separator line
  const sepY = destY - destSize - 12;
  const sepHalfW = Math.round(w * 0.11);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#FF3B30";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - sepHalfW, sepY);
  ctx.lineTo(cx + sepHalfW, sepY);
  ctx.stroke();

  // ── Departure (medium, lighter) — also auto-sized
  const startIdeal = Math.round(w * 0.044);
  const startSize = fitFontSize(ctx, startName.toUpperCase(), "300", startIdeal, 20, maxTextW, fontStack);
  const startY = sepY - 14;
  ctx.font = `300 ${startSize}px ${fontStack}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 12;
  ctx.fillText(startName.toUpperCase(), cx, startY);

  // ── "• ROUTE •" micro-label
  const microSize = Math.round(w * 0.025);
  ctx.font = `600 ${microSize}px ${fontStack}`;
  ctx.fillStyle = "rgba(255,59,48,0.85)";
  ctx.shadowBlur = 0;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("• ROUTE •", cx, startY - startSize - 14);

  ctx.restore();
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Generates the map-intro clip that opens the final travel reel.
 *
 * Anti-jitter system:
 *   All camera movement uses a CamState object advanced each frame via
 *   frame-rate-independent exponential smoothing (expSmooth). The camera
 *   converges toward a computed target rather than jumping to raw keyframe
 *   values, eliminating all micro-jitter visible at 60fps.
 *
 * Overview zoom fix:
 *   The fitBounds zoom is capped at OVERVIEW_MAX_ZOOM (z8) so the map never
 *   starts at continent scale, then zooms to DETAIL_ZOOM (z12) in Phase 1.
 *
 * Route resampling:
 *   Raw GPX is resampled to ROUTE_RESAMPLE_COUNT equally-spaced points so
 *   camera speed is perfectly constant regardless of original GPX density.
 */
export default function RouteMapIntro({
  points,
  routeStats,
  initialLabels,
  onClipReady,
  onStatusChange,
  hideUi = false,
}: RouteMapIntroProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cleanupUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "rendering" | "ready" | "error">("idle");

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    onClipReady(null);
    const host = hostRef.current;
    if (!host || points.length < 2) {
      queueMicrotask(() => setStatus("error"));
      return;
    }

    const mimeType = pickMimeType();
    if (!mimeType) {
      queueMicrotask(() => setStatus("error"));
      return;
    }

    setStatus("rendering");

    let cancelled = false;
    let map: maplibregl.Map | null = null;
    let raf = 0;

    // Normalize route density → constant-speed camera movement
    const resampled = resampleRoute(points, ROUTE_RESAMPLE_COUNT);

    // Pre-compute the overview camera using pure Mercator math.
    // Available before the Map is constructed — used in the Map constructor
    // for initial tile loading AND re-applied in the load handler via jumpTo.
    // 80 px symmetric padding gives comfortable breathing room on all sides.
    const { centerLng: ovLng, centerLat: ovLat, zoom: ovZoom } =
      computeOverviewCamera(points, MAP_WIDTH, MAP_HEIGHT, 80, OVERVIEW_MAX_ZOOM);

    void (async () => {
      if (cancelled) return;

      // 1. Resolve label data.
      //    If `initialLabels` were pre-filled by the route planner / GPX
      //    detector, use them directly — no network calls needed, no delay.
      //    Otherwise fall back to the internal Nominatim reverse-geocoding
      //    (legacy path for callers that don't supply labels yet).
      let labelData: Array<{ lng: number; lat: number; name: string; progress: number; isStart: boolean; isEnd: boolean }>;

      if (initialLabels && initialLabels.length >= 2) {
        // Map RouteLabel[] (external) → internal labelData shape
        labelData = initialLabels.map((l, i) => ({
          lng: l.lng,
          lat: l.lat,
          name: l.name,
          progress: l.progress,
          isStart: i === 0,
          isEnd: i === initialLabels.length - 1,
        }));
      } else {
        // Fallback: geocode N evenly-spaced waypoints via Nominatim
        const pointProgress = computeProgressPerPoint(points);
        const labelCount = Math.min(6, Math.max(2, Math.ceil(points.length / 40)));
        const waypoints = pickWaypoints(points, labelCount);
        labelData = await Promise.all(
          waypoints.map(async (wp, i) => {
            const name = await reverseGeocode(wp.lat, wp.lng);
            const ptIdx = points.findIndex((p) => p.lat === wp.lat && p.lng === wp.lng);
            const progress = ptIdx >= 0 ? pointProgress[ptIdx] : i / (waypoints.length - 1);
            return { lng: wp.lng, lat: wp.lat, name, progress, isStart: i === 0, isEnd: i === waypoints.length - 1 };
          }),
        );
      }

      if (cancelled) return;

      // 2. Create the off-screen MapLibre container
      const container = document.createElement("div");
      container.style.cssText = `width:${MAP_WIDTH}px;height:${MAP_HEIGHT}px;position:absolute;top:0;left:0;`;
      host.appendChild(container);

      map = new maplibregl.Map({
        container,
        style: {
          version: 8,
          glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
          sources: {
            "carto-voyager": {
              type: "raster",
              tiles: [
                "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
                "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
                "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
                "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
              ],
              tileSize: 256,
              maxzoom: 19,
              attribution: "© OpenStreetMap © CARTO",
            },
          },
          layers: [{ id: "base-tiles", type: "raster", source: "carto-voyager" }],
        },
        // Start tile loading at the exact overview position computed above.
        // The load handler re-applies these via jumpTo after adding layers.
        center: [ovLng, ovLat],
        zoom: ovZoom,
        // preserveDrawingBuffer: required for canvas.captureStream() under COEP.
        // pixelRatio: 1 forces the WebGL canvas to be exactly MAP_WIDTH×MAP_HEIGHT
        // regardless of devicePixelRatio, making the drawImage compositing trivial
        // (no scaling needed) and eliminating any DPR-related cropping.
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
        pixelRatio: 1,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
      });

      // 3. Add layers + start recording once tiles have loaded
      map.on("load", () => {
        if (cancelled || !map) return;

        // Full-route ghost underlay (visible from the very first frame).
        // Opacity 0.55 / width 5px — visible enough during the Phase 0 overview
        // that the viewer can trace the full route, but subdued enough that the
        // progressively-revealed red line still pops as the hero element.
        map.addSource("route-ghost", {
          type: "geojson",
          data: buildLineGeoJSON(resampled, resampled.length),
        });
        map.addLayer({
          id: "route-ghost-casing",
          type: "line",
          source: "route-ghost",
          paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.30 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "route-ghost-line",
          type: "line",
          source: "route-ghost",
          paint: { "line-color": "#FF3B30", "line-width": 5, "line-opacity": 0.55 },
          layout: { "line-cap": "round", "line-join": "round" },
        });

        // Progressively revealed route — bright red, thick, premium travel appearance.
        // 16px white casing beneath 10px #FF3B30 line gives strong contrast on all map styles.
        map.addSource("route-revealed", { type: "geojson", data: buildLineGeoJSON(resampled, 2) });
        map.addLayer({
          id: "route-revealed-casing",
          type: "line",
          source: "route-revealed",
          paint: { "line-color": "#ffffff", "line-width": 16, "line-opacity": 0.92 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "route-revealed-line",
          type: "line",
          source: "route-revealed",
          paint: { "line-color": "#FF3B30", "line-width": 10, "line-opacity": 1 },
          layout: { "line-cap": "round", "line-join": "round" },
        });

        // Vehicle head dot — matches route red for visual coherence
        map.addSource("vehicle-head", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [{ type: "Feature", geometry: { type: "Point", coordinates: [resampled[0].lng, resampled[0].lat] }, properties: {} }],
          },
        });
        map.addLayer({
          id: "vehicle-head-glow",
          type: "circle",
          source: "vehicle-head",
          paint: { "circle-radius": 22, "circle-color": "#FF3B30", "circle-opacity": 0.20, "circle-blur": 1 },
        });
        map.addLayer({
          id: "vehicle-head-dot",
          type: "circle",
          source: "vehicle-head",
          paint: {
            "circle-radius": 11,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#FF3B30",
            "circle-stroke-width": 5,
          },
        });

        // Place-name labels — two-layer approach for maximum mobile readability.
        //
        // Layer 1 "place-labels-halo": renders only a thick white halo at the
        // same position as the text. This creates a crisp white chip/pill that
        // completely isolates the label from the red route and map tiles below.
        //
        // Layer 2 "place-labels-text": the actual colored text on top.
        //
        // Both layers use zoom-interpolated text-size so labels grow naturally
        // when the camera zooms in to DETAIL_ZOOM (z12) or LABEL_ZOOM_IN_LEVEL
        // (z14) and shrink back during the overview without becoming illegible.
        //
        //   z 8  (overview)   → start/end 22 px  |  intermediate 14 px
        //   z12  (detail)     → start/end 32 px  |  intermediate 22 px
        //   z14  (zoom-in)    → start/end 42 px  |  intermediate 30 px
        //
        // symbol-sort-key ensures start/end labels render above intermediate
        // ones when their bounding boxes happen to touch.
        const LABEL_SIZE_EXPR: maplibregl.ExpressionSpecification = [
          "interpolate", ["linear"], ["zoom"],
          8,  ["case", ["any", ["get", "isStart"], ["get", "isEnd"]] as maplibregl.ExpressionSpecification, 22, 14],
          12, ["case", ["any", ["get", "isStart"], ["get", "isEnd"]] as maplibregl.ExpressionSpecification, 32, 22],
          14, ["case", ["any", ["get", "isStart"], ["get", "isEnd"]] as maplibregl.ExpressionSpecification, 42, 30],
        ];
        const LABEL_LAYOUT_COMMON = {
          "text-field": ["get", "name"] as maplibregl.ExpressionSpecification,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": LABEL_SIZE_EXPR,
          "text-anchor": "bottom" as const,
          "text-offset": [0, -1.6] as [number, number],
          "text-max-width": 10,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-transform": "uppercase" as const,
          "text-letter-spacing": 0.04,
          // Lower value = higher z-order: start/end labels always render on top
          "symbol-sort-key": ["case", ["any", ["get", "isStart"], ["get", "isEnd"]] as maplibregl.ExpressionSpecification, 0, 1] as maplibregl.ExpressionSpecification,
        };

        map.addSource("place-labels", { type: "geojson", data: buildLabelsGeoJSON([]) });

        // Halo layer — thick white chip separates label from the red route
        map.addLayer({
          id: "place-labels-halo",
          type: "symbol",
          source: "place-labels",
          layout: LABEL_LAYOUT_COMMON,
          paint: {
            "text-color": "rgba(0,0,0,0)",
            "text-halo-color": "rgba(255,255,255,0.97)",
            "text-halo-width": 8,
            "text-halo-blur": 1,
          },
        });

        // Text layer — colored text on top of the white chip
        map.addLayer({
          id: "place-labels-text",
          type: "symbol",
          source: "place-labels",
          layout: LABEL_LAYOUT_COMMON,
          paint: {
            "text-color": ["case",
              ["get", "isEnd"]   as maplibregl.ExpressionSpecification, "#b91c1c",
              ["get", "isStart"] as maplibregl.ExpressionSpecification, "#15803d",
              "#111827",
            ] as maplibregl.ExpressionSpecification,
            "text-halo-color": "rgba(255,255,255,0.5)",
            "text-halo-width": 2,
          },
        });

        // Pre-show the START label immediately (Phase 0 / overview hold) so the
        // viewer can read the departure location while the title card is visible.
        const startLabelFeature = labelData.find((l) => l.isStart);
        if (startLabelFeature) {
          (map.getSource("place-labels") as GeoJSONSource | undefined)?.setData(
            buildLabelsGeoJSON([startLabelFeature]),
          );
        }

        // 4. Recording setup — compositing canvas approach
        //
        // MapLibre renders into a WebGL canvas. Canvas 2D API can drawImage()
        // a WebGL canvas (with preserveDrawingBuffer: true, already set above).
        // We create a second 2D "compositing" canvas, composite the map onto it
        // each MapLibre render, then draw the title card overlay on top.
        // The MediaRecorder streams from this compositing canvas so the 2D title
        // card text appears in the final exported clip.
        const mapCanvas = map.getCanvas();
        const compositeCanvas = document.createElement("canvas");
        compositeCanvas.width = MAP_WIDTH;
        compositeCanvas.height = MAP_HEIGHT;
        const compositeCtx = compositeCanvas.getContext("2d")!;

        const stream = compositeCanvas.captureStream(RECORD_FPS);
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onerror = () => { if (!cancelled) { setStatus("error"); onClipReady(null); } };
        recorder.onstop = async () => {
          if (cancelled) return;
          const blob = new Blob(chunks, { type: mimeType });
          if (blob.size === 0) { setStatus("error"); onClipReady(null); return; }
          const durationSeconds = await readBlobDuration(blob, CLIP_DURATION_SECONDS);
          const file = new File([blob], "route-map-intro.webm", { type: mimeType });
          const url = URL.createObjectURL(blob);
          cleanupUrlRef.current = url;
          setStatus("ready");
          onClipReady({ file, url, durationSeconds });
        };

        // ── ROUTE CENTERING ─────────────────────────────────────────────
        //
        // Apply the pre-computed Mercator overview camera.
        // jumpTo is always synchronous; no animation pipeline, no timing
        // ambiguity, no persistent-padding side effects.
        // After this call map.getCenter() / map.getZoom() match exactly.
        map.jumpTo({ center: [ovLng, ovLat], zoom: ovZoom, bearing: 0, pitch: 0 });

        // Expose as {lat, lng} objects so the render-loop closure can use them
        // with the same `.lat` / `.lng` accessors as a MapLibre LngLat.
        const overviewCenter = { lat: ovLat, lng: ovLng };
        const overviewZoom   = ovZoom;

        // Smoothed camera state — starts exactly at the overview position
        let cam: CamState = {
          lat: overviewCenter.lat,
          lng: overviewCenter.lng,
          zoom: overviewZoom,
          pitch: 0,
        };

        // Route-end position (updated during Phase 2, used in Phase 4 zoom-out)
        let routeEndLat = resampled[resampled.length - 1].lat;
        let routeEndLng = resampled[resampled.length - 1].lng;

        const startLabelName = labelData.find((l) => l.isStart)?.name ?? "";
        const endLabelName   = labelData.find((l) => l.isEnd)?.name ?? "";

        let startTime: number | null = null;
        let prevFrameTime: number | null = null;
        let warmupFrames = 0;
        let lastRevealedIdx = 1;
        let shownLabels: typeof labelData = startLabelFeature ? [startLabelFeature] : [];
        let lastLabelsLen = shownLabels.length;
        let lastGeoJSONUpdateMs = 0;
        let endLabelShown = false;
        // Dynamic zoom-in state — true while the head is close to a place name
        let labelZoomActive = false;

        // After each MapLibre WebGL render, composite the map onto the recording
        // canvas and draw the 2D title card overlay on top.
        map.on("render", () => {
          if (cancelled) return;
          compositeCtx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
          // Scale the MapLibre WebGL canvas into the compositeCanvas.
          // CRITICAL: always provide explicit destination dimensions so that
          // the draw is correct regardless of devicePixelRatio. On Retina
          // displays MapLibre renders to a canvas that is DPR × the CSS size
          // (e.g. 1440×2560 at DPR=2). Without the destination size arg,
          // drawImage copies at 1:1 pixel and only the top-left DPR-fraction
          // of the map is captured — making the route appear in the bottom-right
          // corner even though MapLibre placed it perfectly at centre.
          compositeCtx.drawImage(mapCanvas, 0, 0, MAP_WIDTH, MAP_HEIGHT);
          if (startTime !== null) {
            const elapsedSec = (performance.now() - startTime) / 1000;
            drawTitleCard(compositeCtx, elapsedSec, startLabelName, endLabelName, MAP_WIDTH, MAP_HEIGHT);
          }
        });

        const renderFrame = (now: DOMHighResTimeStamp) => {
          if (cancelled || !map) return;

          // Warm-up: wait for tiles to appear before starting the recorder
          if (startTime === null) {
            map.triggerRepaint();
            warmupFrames++;
            if (warmupFrames >= 10) {
              startTime = now;
              prevFrameTime = now;
              recorder.start(200);
            }
            raf = requestAnimationFrame(renderFrame);
            return;
          }

          // dt: seconds since last frame, clamped to avoid large jumps if the
          // browser throttles the tab
          const dt = Math.min((now - (prevFrameTime ?? now)) / 1000, 0.08);
          prevFrameTime = now;

          const elapsed = (now - startTime) / 1000;

          if (elapsed >= CLIP_DURATION_SECONDS) {
            cancelAnimationFrame(raf);
            recorder.stop();
            return;
          }

          // ─────────────────────────────────────────────────────────────────
          // TIMELINE — compute the raw keyframe target for this moment.
          // The target is NOT applied directly to the map. expSmooth()
          // converges the CamState toward it, removing all micro-jitter.
          // ─────────────────────────────────────────────────────────────────
          let targetLat: number;
          let targetLng: number;
          let targetZoom: number;
          let targetPitch: number;

          // ── Phase 0 (0 – T_OVERVIEW): Regional context hold ──────────────
          // Camera stationary at capped overview zoom (≤ z8).
          // Sub-pixel drift adds barely-perceptible cinematic life.
          if (elapsed < T_OVERVIEW) {
            const drift = Math.sin(elapsed * 0.6) * 0.00025;
            targetLat   = overviewCenter.lat;
            targetLng   = overviewCenter.lng + drift;
            targetZoom  = overviewZoom;
            targetPitch = 0;
          }

          // ── Phase 1 (T_OVERVIEW – T_ZOOMIN): Zoom-in to start ────────────
          // Camera flies from overview center to route start point while
          // zooming from overviewZoom to DETAIL_ZOOM (z12 — villages readable).
          // Pitch ramps 0° → 18° for subtle depth.
          else if (elapsed < T_ZOOMIN) {
            const t = easeInOut((elapsed - T_OVERVIEW) / (T_ZOOMIN - T_OVERVIEW));
            targetLat   = lerp(overviewCenter.lat, resampled[0].lat, t);
            targetLng   = lerp(overviewCenter.lng, resampled[0].lng, t);
            targetZoom  = lerp(overviewZoom, DETAIL_ZOOM, t);
            targetPitch = lerp(0, 18, t);
          }

          // ── Phase 2 (T_ZOOMIN – T_DRAW): Route discovery ─────────────────
          // Revealed line advances through resampled points at constant speed.
          // Camera follows the drawing head. Zoom is normally DETAIL_ZOOM but
          // zooms in to LABEL_ZOOM_IN_LEVEL when the head approaches a labelled
          // waypoint, then smoothly returns when the head moves away.
          else if (elapsed < T_DRAW) {
            const phaseT = easeInOut((elapsed - T_ZOOMIN) / (T_DRAW - T_ZOOMIN));
            const headIdx = Math.min(
              Math.floor(phaseT * (resampled.length - 1)),
              resampled.length - 1,
            );
            const head = resampled[headIdx];

            // Advance revealed GeoJSON (throttled to ≤ 1 update per 80ms)
            if (headIdx !== lastRevealedIdx && now - lastGeoJSONUpdateMs > 80) {
              lastRevealedIdx = headIdx;
              lastGeoJSONUpdateMs = now;
              (map.getSource("route-revealed") as GeoJSONSource | undefined)?.setData(
                buildLineGeoJSON(resampled, headIdx + 1),
              );
              (map.getSource("vehicle-head") as GeoJSONSource | undefined)?.setData({
                type: "FeatureCollection",
                features: [{ type: "Feature", geometry: { type: "Point", coordinates: [head.lng, head.lat] }, properties: {} }],
              });
            }

            // Reveal intermediate place-name labels as the route draw head passes them.
            // Start label is already shown from Phase 0; end label is added in Phase 3.
            const newlyVisible = labelData.filter(
              (l) => !l.isStart && !l.isEnd && l.progress <= phaseT && !shownLabels.find((s) => s.name === l.name),
            );
            if (newlyVisible.length > 0 || shownLabels.length !== lastLabelsLen) {
              shownLabels = [...shownLabels, ...newlyVisible];
              lastLabelsLen = shownLabels.length;
              (map.getSource("place-labels") as GeoJSONSource | undefined)?.setData(
                buildLabelsGeoJSON(shownLabels),
              );
            }

            targetLat   = head.lat;
            targetLng   = head.lng;
            targetPitch = 18;

            // ── Dynamic zoom near place-name labels ───────────────────
            // Find the nearest non-start / non-end label.
            // Intermediate labels are geocoded waypoints that appear as
            // the route draws; zooming in makes their names readable.
            let nearestLabelKm = Infinity;
            for (const label of labelData) {
              if (label.isStart || label.isEnd) continue;
              const km = haversineM(head, label) / 1_000;
              if (km < nearestLabelKm) nearestLabelKm = km;
            }

            // Hysteresis: enter zoom-in at 1× threshold, exit at 1.5×.
            // This prevents oscillation when the head lingers at the boundary.
            if (!labelZoomActive && nearestLabelKm < LABEL_ZOOM_TRIGGER_KM) {
              labelZoomActive = true;
            } else if (labelZoomActive && nearestLabelKm > LABEL_ZOOM_TRIGGER_KM * 1.5) {
              labelZoomActive = false;
            }

            targetZoom = labelZoomActive ? LABEL_ZOOM_IN_LEVEL : DETAIL_ZOOM;

            routeEndLat = head.lat;
            routeEndLng = head.lng;
          }

          // ── Phase 3 (T_DRAW – T_HOLD): Completion hold ───────────────────
          // Camera holds at route end. All labels visible. Pitch flattens.
          // End label (destination) is added here — after the full route is drawn
          // the viewer can see exactly where the journey ends on the map.
          else if (elapsed < T_HOLD) {
            if (!endLabelShown) {
              endLabelShown = true;
              const endLabel = labelData.find((l) => l.isEnd);
              if (endLabel && !shownLabels.find((s) => s.name === endLabel.name)) {
                shownLabels = [...shownLabels, endLabel];
                lastLabelsLen = shownLabels.length;
                (map.getSource("place-labels") as GeoJSONSource | undefined)?.setData(
                  buildLabelsGeoJSON(shownLabels),
                );
              }
            }
            const t = easeInOut((elapsed - T_DRAW) / (T_HOLD - T_DRAW));
            targetLat   = routeEndLat;
            targetLng   = routeEndLng;
            targetZoom  = DETAIL_ZOOM;
            targetPitch = lerp(18, 4, t);
          }

          // ── Phase 4 (T_HOLD – end): Final zoom-out overview ───────────────
          // Camera eases back to full-route overview. Pitch returns to 0°.
          else {
            const t = easeInOut((elapsed - T_HOLD) / (CLIP_DURATION_SECONDS - T_HOLD));
            targetLat   = lerp(routeEndLat, overviewCenter.lat, t);
            targetLng   = lerp(routeEndLng, overviewCenter.lng, t);
            targetZoom  = lerp(DETAIL_ZOOM, overviewZoom, t);
            targetPitch = lerp(4, 0, t);
          }

          // ── Exponential smoothing — the anti-jitter core ─────────────────
          // Each component converges toward its target at an independent rate.
          // Position uses K_POS (fast), zoom K_ZOOM (slower, prevents bounce),
          // pitch K_PITCH (medium). All are frame-rate independent via expSmooth.
          cam.lat   = expSmooth(cam.lat,   targetLat,   K_POS,   dt);
          cam.lng   = expSmooth(cam.lng,   targetLng,   K_POS,   dt);
          cam.zoom  = expSmooth(cam.zoom,  targetZoom,  K_ZOOM,  dt);
          cam.pitch = expSmooth(cam.pitch, targetPitch, K_PITCH, dt);

          map.jumpTo({
            center: [cam.lng, cam.lat],
            zoom: cam.zoom,
            pitch: cam.pitch,
            bearing: 0,
          });

          map.triggerRepaint();
          raf = requestAnimationFrame(renderFrame);
        };

        raf = requestAnimationFrame(renderFrame);
      });

      map.on("error", (e) => {
        // Tile errors are non-fatal — map renders with whatever tiles loaded
        console.warn("[RouteMapIntro] MapLibre error:", e.error?.message ?? e);
      });
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      try { map?.remove(); } catch { /* ignore */ }
      map = null;
      if (cleanupUrlRef.current) {
        URL.revokeObjectURL(cleanupUrlRef.current);
        cleanupUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, routeStats, initialLabels, onClipReady]);

  const hostDiv = (
    <div
      ref={hostRef}
      className="fixed left-0 top-0 overflow-hidden pointer-events-none opacity-0"
      style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
      aria-hidden="true"
    />
  );

  if (hideUi) return hostDiv;

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-white/75">Route map intro</p>
          <p className="mt-1 text-[11px] text-white/45">
            {CLIP_DURATION_SECONDS}s · 5 phases · smooth camera · mobile labels
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
          {status === "rendering" && <Loader2 className="h-3 w-3 animate-spin text-emerald-300" />}
          {status === "ready"     && <CheckCircle2 className="h-3 w-3 text-emerald-300" />}
          {status === "error"     && <TriangleAlert className="h-3 w-3 text-rose-300" />}
          <span>
            {status === "rendering" ? "Rendering" : status === "ready" ? "Ready" : status === "error" ? "Error" : "Idle"}
          </span>
        </div>
      </div>

      {status === "rendering" && (
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div className="h-full animate-[shimmer_2s_linear_infinite] rounded-full bg-gradient-to-r from-emerald-400/0 via-emerald-400/70 to-emerald-400/0 bg-[length:200%_100%]" />
        </div>
      )}
      {status === "error" && (
        <p className="text-xs text-rose-200/75">
          Impossible de générer l'intro carte (MediaRecorder non supporté).
        </p>
      )}

      {hostDiv}
    </div>
  );
}
