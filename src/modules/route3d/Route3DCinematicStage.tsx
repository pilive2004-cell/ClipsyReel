"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EnrichedRoutePoint, RouteMetrics, VehicleKind, CameraMode } from "./types";
import { samplePointAtProgress } from "./routeMetrics";
import { CameraController, computeOverviewCamera } from "./CameraController";
import { MapCustomVehicleLayer } from "./MapCustomVehicleLayer";

/**
 * CartoDB Voyager — clean road-map style with terrain tints and full label coverage
 * (city names, road names, district names) at every zoom level we use (9–14).
 * Three tile servers for load distribution.
 * No API key required.
 */
const ROAD_TILE_URLS = [
  "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
  "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
  "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
];

// Must be called ONCE at module load time — before any Map instance (or worker pool) is created.
// In COEP/crossOriginIsolated mode the default MapLibre inline blob worker silently fails;
// serving the worker as a plain static file from the same origin avoids the restriction.
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}

function toLngLat(p: { lng: number; lat: number }): [number, number] {
  return [p.lng, p.lat];
}

/**
 * Builds the "progress drawn so far" coordinates from the start of the route
 * up to the current vehicle position (inclusive).  The resulting LineString
 * is what gets drawn as the animated red "completed" segment.
 */
function buildProgressCoordinates(points: EnrichedRoutePoint[], progress: number): [number, number][] {
  if (points.length === 0) return [];
  const clamped = Math.max(0, Math.min(1, progress));
  const exact = clamped * (points.length - 1);
  const lastIndex = Math.floor(exact);
  const coords = points.slice(0, lastIndex + 1).map(toLngLat);
  if (lastIndex < points.length - 1) {
    const interpolated = samplePointAtProgress(points, clamped);
    if (interpolated) coords.push(toLngLat(interpolated));
  }
  if (coords.length === 1) coords.push(coords[0]);
  return coords;
}

export interface Route3DFrameInput {
  progress: number;
  vehicleKind: VehicleKind;
  /** Seconds since the last frame — used by CameraController for frame-rate independent lerp. */
  dt: number;
  /** Current camera mode (follow / cinematic / overview). */
  cameraMode: CameraMode;
}

export interface Route3DStageHandle {
  /** Advances the whole stage (camera + route line + vehicle) to a given frame — called every animation tick by the player that owns the master clock. */
  renderFrame(input: Route3DFrameInput): void;
  getCanvas(): HTMLCanvasElement | null;
  isReady(): boolean;
}

interface Route3DCinematicStageProps {
  metrics: RouteMetrics;
  vehicleKind: VehicleKind;
  onReady?: () => void;
  heightClassName?: string;
}

/**
 * The cinematic map stage: a MapLibre GL map with CartoDB Voyager tiles
 * (readable labels at all zoom levels), a CameraController that smoothly
 * follows the vehicle or shows the full route overview, a progressive route
 * line drawn in red as the animation plays, and a Three.js vehicle model.
 *
 * Deliberately imperative (`renderFrame` via ref) rather than reacting to
 * React state on every frame: 60fps camera/marker updates through React state
 * would mean 60 re-renders/sec with no visual benefit — all changes here are
 * direct MapLibre / Three.js imperative calls.
 */
const Route3DCinematicStage = forwardRef<Route3DStageHandle, Route3DCinematicStageProps>(function Route3DCinematicStage(
  { metrics, vehicleKind, onReady, heightClassName = "h-full" },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vehicleLayerRef = useRef<MapCustomVehicleLayer | null>(null);
  const readyRef = useRef(false);
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  // CameraController holds the smoothed camera state and lerps toward targets.
  const cameraCtrlRef = useRef<CameraController | null>(null);

  // Track last vehicle kind to avoid redundant setVehicleKind calls.
  const lastVehicleKindRef = useRef<VehicleKind>(vehicleKind);

  // Track last progress to skip redundant setData calls when the scrubber is held still.
  const lastProgressRef = useRef<number>(-1);

  useImperativeHandle(
    ref,
    () => ({
      renderFrame({ progress, vehicleKind: kind, dt, cameraMode }: Route3DFrameInput) {
        const map = mapRef.current;
        const cc = cameraCtrlRef.current;
        if (!map || !cc || !readyRef.current) return;

        const points = metricsRef.current.points;
        const vehicle = samplePointAtProgress(points, progress);
        if (!vehicle) return;

        // ── Vehicle marker ──────────────────────────────────────────────────
        const vehicleLayer = vehicleLayerRef.current;
        if (vehicleLayer) {
          if (kind !== lastVehicleKindRef.current) {
            vehicleLayer.setVehicleKind(kind);
            lastVehicleKindRef.current = kind;
          }
          vehicleLayer.setPosition(vehicle.lng, vehicle.lat, vehicle.bearingDeg, 0);
        }

        // ── Camera (smooth follow / cinematic / overview) ────────────────────
        // Use overview mode when progress is at the very start (before play),
        // otherwise use whatever mode the player requests.
        const effectiveMode: CameraMode = progress === 0 ? "overview" : cameraMode;
        const cam = cc.update(dt, vehicle, points, effectiveMode);
        map.jumpTo({
          center: [cam.lng, cam.lat],
          zoom: cam.zoom,
          bearing: cam.bearing,
          pitch: cam.pitch,
        });

        // ── Route line (only update when progress changes) ──────────────────
        if (progress !== lastProgressRef.current) {
          lastProgressRef.current = progress;

          const progressSource = map.getSource("routeProgress") as maplibregl.GeoJSONSource | undefined;
          progressSource?.setData({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: buildProgressCoordinates(points, progress) },
          });

          const headSource = map.getSource("routeHead") as maplibregl.GeoJSONSource | undefined;
          headSource?.setData({
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: toLngLat(vehicle) },
          });
        }

        map.triggerRepaint();
      },

      getCanvas() {
        return mapRef.current?.getCanvas() ?? null;
      },

      isReady() {
        return readyRef.current;
      },
    }),
    []
  );

  useEffect(() => {
    if (!containerRef.current || metrics.points.length < 2) return;
    const points = metrics.points;
    const start = points[0];
    const end = points[points.length - 1];

    // Pre-compute overview to set initial map position.
    const overview = computeOverviewCamera(points);

    const chapterFeatures = metrics.chapters.map((chapter) => {
      const p = points[chapter.pointIndex] ?? start;
      return {
        type: "Feature" as const,
        properties: { kind: chapter.kind, title: chapter.title },
        geometry: { type: "Point" as const, coordinates: toLngLat(p) },
      };
    });

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        // Glyphs endpoint — required to prevent 404s that block style load in some MapLibre versions.
        glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
        sources: {
          road: {
            type: "raster",
            // @2x tiles for sharper rendering on retina / high-DPI screens.
            tiles: ROAD_TILE_URLS,
            tileSize: 256,
            maxzoom: 19,
            attribution:
              "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors © <a href='https://carto.com/attributions'>CARTO</a>",
          },
        },
        layers: [
          { id: "road-base", type: "raster", source: "road", paint: { "raster-opacity": 1.0 } },
        ],
      },
      center: [overview.lng, overview.lat],
      zoom: overview.zoom,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    // `load` fires after the style is fully parsed and tiles are initialising.
    // GeoJSON sources added here are processed by the worker that is now
    // correctly served as a same-origin static file (public/maplibre-gl-worker.mjs).
    map.once("load", () => {
      // Fit the entire route in view with generous padding so the context is clear.
      const bounds = points.reduce(
        (acc, p) => acc.extend(toLngLat(p)),
        new maplibregl.LngLatBounds(toLngLat(start), toLngLat(end))
      );
      map.fitBounds(bounds, { padding: 64, duration: 0, maxZoom: 13, minZoom: 6 });

      // Initialise the camera controller to match the fitted overview position.
      const fittedCenter = map.getCenter();
      cameraCtrlRef.current = new CameraController({
        lng: fittedCenter.lng,
        lat: fittedCenter.lat,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      });

      // ── GeoJSON sources ──────────────────────────────────────────────────
      map.addSource("routeBase", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points.map(toLngLat) } },
      });
      map.addSource("routeProgress", {
        type: "geojson",
        lineMetrics: true,
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [toLngLat(start), toLngLat(start)] },
        },
      });
      map.addSource("routeHead", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: toLngLat(start) } },
      });
      map.addSource("chapters", {
        type: "geojson",
        data: { type: "FeatureCollection", features: chapterFeatures },
      });

      // ── Route layers ─────────────────────────────────────────────────────
      // Order: shadow → unvisited ghost → completed red → vehicle head dot → chapter markers
      // The shadow adds contrast over light map backgrounds.
      map.addLayer({
        id: "route-shadow",
        type: "line",
        source: "routeBase",
        paint: { "line-color": "#000000", "line-width": 9, "line-opacity": 0.22, "line-blur": 3 },
        layout: { "line-join": "round", "line-cap": "round" },
      });
      // Unvisited segment (grey, thin)
      map.addLayer({
        id: "route-base",
        type: "line",
        source: "routeBase",
        paint: { "line-color": "rgba(180,180,180,0.55)", "line-width": 5 },
        layout: { "line-join": "round", "line-cap": "round" },
      });
      // Completed segment — white casing for contrast + red fill (TravelBoast-style)
      map.addLayer({
        id: "route-progress-casing",
        type: "line",
        source: "routeProgress",
        paint: { "line-color": "#ffffff", "line-width": 10, "line-opacity": 0.85 },
        layout: { "line-join": "round", "line-cap": "round" },
      });
      map.addLayer({
        id: "route-progress",
        type: "line",
        source: "routeProgress",
        paint: { "line-color": "#e53935", "line-width": 7 },
        layout: { "line-join": "round", "line-cap": "round" },
      });
      // Vehicle head — white dot with red border
      map.addLayer({
        id: "route-head",
        type: "circle",
        source: "routeHead",
        paint: {
          "circle-radius": 10,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#e53935",
          "circle-stroke-width": 3,
          "circle-pitch-alignment": "map",
        },
      });
      // Chapter markers (orange dots)
      map.addLayer({
        id: "chapter-halo",
        type: "circle",
        source: "chapters",
        paint: { "circle-radius": 14, "circle-color": "rgba(251,191,36,0.18)", "circle-pitch-alignment": "map" },
      });
      map.addLayer({
        id: "chapter-dots",
        type: "circle",
        source: "chapters",
        paint: {
          "circle-radius": 5,
          "circle-color": "#fbbf24",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-pitch-alignment": "map",
        },
      });

      map.triggerRepaint();

      // Three.js vehicle model — optional, fails gracefully on devices without WebGL2
      try {
        const vehicleLayer = new MapCustomVehicleLayer();
        vehicleLayer.setVehicleKind(vehicleKind);
        vehicleLayerRef.current = vehicleLayer;
        map.addLayer(vehicleLayer);
      } catch (err) {
        console.warn("[route3d] Three.js vehicle layer unavailable (WebGL2 required)", err);
      }

      readyRef.current = true;
      onReady?.();
    });

    map.on("error", (e) => {
      // Swallow tile-not-found errors (common with raster tiles at edge zoom levels)
      const msg = e?.error?.message ?? "";
      if (!msg.includes("404") && !msg.includes("aborted")) {
        console.warn("[route3d] map error", msg || e);
      }
    });

    return () => {
      readyRef.current = false;
      vehicleLayerRef.current = null;
      cameraCtrlRef.current = null;
      lastProgressRef.current = -1;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics]);

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 ${heightClassName}`}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
});

export default Route3DCinematicStage;
