"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import type { GpxRouteStats, GpxTrackPoint } from "@/types";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, LngLatBoundsLike } from "maplibre-gl";

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
  onClipReady: (clip: RouteIntroClip | null) => void;
  onStatusChange?: (status: "idle" | "rendering" | "ready" | "error") => void;
  hideUi?: boolean;
}

/** Total duration of the generated intro clip in seconds. */
const CLIP_DURATION_SECONDS = 24;
const MAP_WIDTH = 720;
const MAP_HEIGHT = 1280;
const RECORD_FPS = 24;

/**
 * 5-phase cinematic timeline (all values in seconds):
 *
 *   Phase 0 (0 → T_OVERVIEW)    Country/region context. Full ghost route shown.
 *                                Camera holds at capped overview zoom (≤ z8 so
 *                                it's never continent-scale).
 *   Phase 1 (T_OVERVIEW → T_ZOOMIN)  Smooth zoom-in to the start point at
 *                                DETAIL_ZOOM (z12) — villages and roads readable.
 *   Phase 2 (T_ZOOMIN → T_DRAW)  Route draws itself. Camera follows the drawing
 *                                head at DETAIL_ZOOM. Labels pop in progressively.
 *   Phase 3 (T_DRAW → T_HOLD)    Route complete. Camera holds near the end,
 *                                pitch flattens.
 *   Phase 4 (T_HOLD → end)       Smooth zoom-out back to full-route overview.
 */
const T_OVERVIEW  = 3;   // s — end of regional hold
const T_ZOOMIN    = 8;   // s — end of zoom-in to start
const T_DRAW      = 19;  // s — end of route-draw phase
const T_HOLD      = 21;  // s — end of completion hold
// Phase 4: T_HOLD → CLIP_DURATION_SECONDS

/**
 * Fixed close-up zoom used during route exploration.
 * CartoDB Voyager at zoom 12 shows: village names, secondary roads, terrain.
 * We hardcode this — never derive it from the overview zoom — so the detail
 * phase is always readable regardless of route length.
 */
const DETAIL_ZOOM = 12;

/**
 * Overview zoom is capped so the map never starts at continent scale.
 * Even a 2000 km route will start at z7 (country-level), not z4.
 */
const OVERVIEW_MAX_ZOOM = 8;

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

/** Compute the bounding box of the route with optional padding in degrees. */
function routeBounds(points: GpxTrackPoint[], padDeg = 0): LngLatBoundsLike {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const p of points) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return [[minLng - padDeg, minLat - padDeg], [maxLng + padDeg, maxLat + padDeg]];
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
 * Layout (bottom 42% of frame, 9:16):
 *   • ROUTE •         ← micro-label in route red
 *   START CITY        ← departure, medium weight
 *   ──────            ← red separator line
 *   END CITY          ← destination, large bold — the hero text
 */
function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  startName: string,
  endName: string,
  w: number,
  h: number,
) {
  // Alpha envelope — smooth fade-in/out at phase transitions
  let alpha = 0;
  if (elapsed < 1.2) {
    alpha = easeInOut(elapsed / 1.2);                                   // fade in
  } else if (elapsed < T_OVERVIEW - 0.7) {
    alpha = 1;                                                           // hold
  } else if (elapsed < T_OVERVIEW + 0.6) {
    alpha = easeInOut(Math.max(0, (T_OVERVIEW + 0.6 - elapsed) / 1.3)); // fade out
  } else if (elapsed > T_HOLD + 1.0 && elapsed < CLIP_DURATION_SECONDS - 0.8) {
    // Phase-4 reprise: fade in → hold → fade out
    const repriseLen = CLIP_DURATION_SECONDS - 0.8 - (T_HOLD + 1.0);
    const t = (elapsed - (T_HOLD + 1.0)) / repriseLen;
    alpha = easeInOut(Math.min(1, t < 0.3 ? t / 0.3 : t > 0.7 ? (1 - t) / 0.3 : 1));
  }
  if (alpha < 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Dark gradient fills the bottom 42% of the frame
  const gradH = Math.round(h * 0.42);
  const grad = ctx.createLinearGradient(0, h - gradH, 0, h);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.35, "rgba(0,0,0,0.78)");
  grad.addColorStop(1, "rgba(0,0,0,0.90)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - gradH, w, gradH);

  const cx = w / 2;
  ctx.textAlign = "center";

  // ── Destination (large, 800-weight) ───────────────────────────────────────
  const destSize = Math.round(w * 0.082);
  const destY = h - Math.round(h * 0.10);
  ctx.font = `800 ${destSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(endName.toUpperCase(), cx, destY);

  // ── Red separator line ─────────────────────────────────────────────────────
  const sepY = destY - destSize - 12;
  const sepHalfW = Math.round(w * 0.12);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#FF3B30";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - sepHalfW, sepY);
  ctx.lineTo(cx + sepHalfW, sepY);
  ctx.stroke();

  // ── Departure (medium, lighter) ────────────────────────────────────────────
  const startSize = Math.round(w * 0.048);
  const startY = sepY - 14;
  ctx.font = `300 ${startSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 12;
  ctx.fillText(startName.toUpperCase(), cx, startY);

  // ── "• ROUTE •" micro-label ────────────────────────────────────────────────
  const microSize = Math.round(w * 0.026);
  ctx.font = `600 ${microSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,59,48,0.85)";
  ctx.shadowBlur = 0;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("• ROUTE •", cx, startY - startSize - 16);

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

    // Progress fractions on original points (for label timing)
    const pointProgress = computeProgressPerPoint(points);

    // Overview bounds with padding
    const bounds = routeBounds(points, 0.06);

    // Label waypoints (evenly spaced on the original track)
    const labelCount = Math.min(6, Math.max(2, Math.ceil(points.length / 40)));
    const waypoints = pickWaypoints(points, labelCount);

    void (async () => {
      if (cancelled) return;

      // 1. Reverse-geocode label waypoints in parallel
      const labelData = await Promise.all(
        waypoints.map(async (wp, i) => {
          const name = await reverseGeocode(wp.lat, wp.lng);
          const ptIdx = points.findIndex((p) => p.lat === wp.lat && p.lng === wp.lng);
          const progress = ptIdx >= 0 ? pointProgress[ptIdx] : i / (waypoints.length - 1);
          return { lng: wp.lng, lat: wp.lat, name, progress, isStart: i === 0, isEnd: i === waypoints.length - 1 };
        }),
      );

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
        bounds,
        // OVERVIEW_MAX_ZOOM caps fitBounds so we never start at continent scale.
        // Padding 50px (not 70) keeps the route as the visual focus with minimal empty space.
        fitBoundsOptions: { padding: 50, maxZoom: OVERVIEW_MAX_ZOOM, animate: false },
        // preserveDrawingBuffer: required for canvas.captureStream() under COEP.
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
      });

      // 3. Add layers + start recording once tiles have loaded
      map.on("load", () => {
        if (cancelled || !map) return;

        // Full-route ghost underlay (visible from the very first frame).
        // Intentionally dim so the bright revealed line reads as the hero.
        map.addSource("route-ghost", {
          type: "geojson",
          data: buildLineGeoJSON(resampled, resampled.length),
        });
        map.addLayer({
          id: "route-ghost-casing",
          type: "line",
          source: "route-ghost",
          paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.16 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "route-ghost-line",
          type: "line",
          source: "route-ghost",
          paint: { "line-color": "#c8c8c8", "line-width": 3, "line-opacity": 0.32 },
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

        // Place-name labels.
        // Start and end use text-size 26 (large, readable on mobile) while
        // intermediate waypoints use 17. All labels allow overlap so they never
        // disappear behind each other during animation.
        map.addSource("place-labels", { type: "geojson", data: buildLabelsGeoJSON([]) });
        map.addLayer({
          id: "place-labels-layer",
          type: "symbol",
          source: "place-labels",
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            // Data-driven size: start/end names are larger than intermediate waypoints
            "text-size": ["case", ["any", ["get", "isStart"], ["get", "isEnd"]], 26, 17],
            "text-anchor": "bottom",
            "text-offset": [0, -1.4],
            "text-max-width": 12,
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: {
            "text-color": ["case", ["get", "isEnd"], "#c0392b", ["get", "isStart"], "#15803d", "#111827"],
            "text-halo-color": "#ffffff",
            "text-halo-width": 3.5,
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

        // Snapshot overview camera position after fitBounds
        const overviewCenter = map.getCenter();
        // fitBounds zoom is already ≤ OVERVIEW_MAX_ZOOM (z8)
        const overviewZoom = map.getZoom();

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

        // After each MapLibre WebGL render, composite the map onto the recording
        // canvas and draw the 2D title card overlay on top.
        map.on("render", () => {
          if (cancelled) return;
          compositeCtx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
          compositeCtx.drawImage(mapCanvas, 0, 0);
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
          // Camera follows the drawing head. Zoom LOCKED at DETAIL_ZOOM —
          // no zoom oscillation during route draw.
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
            targetZoom  = DETAIL_ZOOM;  // locked — prevents zoom jitter
            targetPitch = 18;

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
  }, [points, routeStats, onClipReady]);

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
