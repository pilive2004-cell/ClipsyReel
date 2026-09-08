"use client";

import { useEffect, useMemo, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { GpxTrackPoint, VideoLocationMatch } from "@/types";

interface MapLibreRouteMapProps {
  points: GpxTrackPoint[];
  locationMatches?: VideoLocationMatch[];
  heightClassName?: string;
  onLoaded?: () => void;
}

const SATELLITE_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TERRAIN_SOURCE_URL = "https://demotiles.maplibre.org/terrain-tiles/tiles.json";

// Must be called at module load time — before any Map/worker pool is created.
// COEP (cross-origin isolation for ffmpeg.wasm) blocks the default inline blob worker.
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}

type LngLat = [number, number];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toLngLat(point: { lng: number; lat: number }): LngLat {
  return [point.lng, point.lat];
}

function getPointAtProgress(points: GpxTrackPoint[], progress: number) {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0];
  const clamped = clamp(progress, 0, 1);
  const exactIndex = clamped * (points.length - 1);
  const index = Math.floor(exactIndex);
  const t = exactIndex - index;
  const a = points[index];
  const b = points[Math.min(index + 1, points.length - 1)];
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    ele: a.ele !== null && b.ele !== null ? a.ele + (b.ele - a.ele) * t : a.ele ?? b.ele ?? null,
    time: null,
  } satisfies GpxTrackPoint;
}

function getBearing(a: GpxTrackPoint, b: GpxTrackPoint) {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function buildProgressCoordinates(points: GpxTrackPoint[], progress: number): LngLat[] {
  if (points.length === 0) return [];
  const clamped = clamp(progress, 0, 1);
  const exactIndex = clamped * (points.length - 1);
  const lastIndex = Math.floor(exactIndex);
  const coords = points.slice(0, lastIndex + 1).map(toLngLat);
  if (lastIndex < points.length - 1) {
    const interpolated = getPointAtProgress(points, clamped);
    if (interpolated) coords.push(toLngLat(interpolated));
  }
  return coords;
}

function buildMarkerFeatures(locationMatches: VideoLocationMatch[] | undefined) {
  return (locationMatches ?? [])
    .flatMap((match) => {
      const automatic = match.matchedGPXPoint
        ? [
            {
              type: "Feature" as const,
              properties: {
                kind: match.status === "gps_detected" ? "gps" : "timestamp",
                label: match.fileName,
              },
              geometry: {
                type: "Point" as const,
                coordinates: [match.matchedGPXPoint.lng, match.matchedGPXPoint.lat] as LngLat,
              },
            },
          ]
        : [];
      const manual = match.manualLocations
        .filter((loc) => loc.latitude !== null && loc.longitude !== null)
        .map((loc) => ({
          type: "Feature" as const,
          properties: {
            kind: "manual",
            label: loc.locationName || match.fileName,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [loc.longitude as number, loc.latitude as number] as LngLat,
          },
        }));
      return [...automatic, ...manual];
    });
}

export default function MapLibreRouteMap({ points, locationMatches, heightClassName = "h-64", onLoaded }: MapLibreRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const animationRef = useRef<number | null>(null);
  const routePoints = useMemo(() => points, [points]);
  const markerFeatures = useMemo(() => buildMarkerFeatures(locationMatches), [locationMatches]);

  useEffect(() => {
    if (!containerRef.current || routePoints.length < 2) return;

    const start = routePoints[0];
    const end = routePoints[routePoints.length - 1];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: "raster",
            tiles: [SATELLITE_TILE_URL],
            tileSize: 256,
            attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          },
          terrain: {
            type: "raster-dem",
            url: TERRAIN_SOURCE_URL,
            tileSize: 256,
          },
          routeBase: {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: routePoints.map(toLngLat),
              },
            },
          },
          routeProgress: {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [toLngLat(start), toLngLat(start)],
              },
            },
          },
          routeHead: {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: toLngLat(start) },
            },
          },
          markers: {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: markerFeatures,
            },
          },
        },
        layers: [
          { id: "satellite", type: "raster", source: "satellite" },
          {
            id: "hillshade",
            type: "hillshade",
            source: "terrain",
            paint: {
              "hillshade-shadow-color": "#020617",
              "hillshade-highlight-color": "#dbeafe",
              "hillshade-accent-color": "#0f172a",
              "hillshade-illumination-anchor": "map",
              "hillshade-exaggeration": 0.65,
            },
          },
          {
            id: "route-base",
            type: "line",
            source: "routeBase",
            paint: {
              "line-color": "rgba(255,255,255,0.22)",
              "line-width": 4,
              "line-blur": 0.6,
            },
            layout: { "line-join": "round", "line-cap": "round" },
          },
          {
            id: "route-progress-glow",
            type: "line",
            source: "routeProgress",
            paint: {
              "line-color": "#ef4444",
              "line-width": 10,
              "line-opacity": 0.28,
              "line-blur": 3,
            },
            layout: { "line-join": "round", "line-cap": "round" },
          },
          {
            id: "route-progress",
            type: "line",
            source: "routeProgress",
            paint: {
              "line-color": [
                "interpolate",
                ["linear"],
                ["line-progress"],
                0,
                "#f97316",
                0.45,
                "#ef4444",
                1,
                "#fb7185",
              ],
              "line-width": 5.5,
            },
            layout: { "line-join": "round", "line-cap": "round" },
          },
          {
            id: "route-head-halo",
            type: "circle",
            source: "routeHead",
            paint: {
              "circle-radius": 16,
              "circle-color": "rgba(96,165,250,0.18)",
            },
          },
          {
            id: "route-head",
            type: "circle",
            source: "routeHead",
            paint: {
              "circle-radius": 6,
              "circle-color": "#60a5fa",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          },
          {
            id: "marker-halo",
            type: "circle",
            source: "markers",
            paint: {
              "circle-radius": 11,
              "circle-color": "rgba(255,255,255,0.12)",
            },
          },
          {
            id: "marker-dots",
            type: "circle",
            source: "markers",
            paint: {
              "circle-radius": 4.5,
              "circle-color": [
                "match",
                ["get", "kind"],
                "gps",
                "#34d399",
                "timestamp",
                "#fbbf24",
                "manual",
                "#a78bfa",
                "#ffffff",
              ],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.25,
            },
          },
        ],
        terrain: { source: "terrain", exaggeration: 1.7 },
      },
      center: toLngLat(start),
      zoom: 12,
      pitch: 62,
      bearing: 0,
      attributionControl: false,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      const bounds = routePoints.reduce(
        (acc, point) => acc.extend([point.lng, point.lat]),
        new maplibregl.LngLatBounds([start.lng, start.lat], [end.lng, end.lat])
      );
      map.fitBounds(bounds, { padding: 44, duration: 0 });
      map.easeTo({ pitch: 72, bearing: 18, duration: 1800 });
      onLoaded?.();

      let rafId = 0;
      const loopStart = performance.now();
      const baseZoom = clamp(map.getZoom() + 0.7, 11.8, 15.6);
      const animate = (now: number) => {
        const elapsed = (now - loopStart) / 1000;
        const cycle = 12;
        const progress = (elapsed % cycle) / cycle;
        const eased = 1 - Math.pow(1 - progress, 2);
        const current = getPointAtProgress(routePoints, eased) ?? start;
        const lookAhead = getPointAtProgress(routePoints, clamp(eased + 0.06, 0, 1)) ?? end;
        const bearing = getBearing(current, lookAhead);
        const climb = Math.sin(eased * Math.PI) * 0.95;
        const pitch = 70 + climb * 8;
        const zoom = baseZoom + climb * 0.55;

        const routeProgressSource = map.getSource("routeProgress") as maplibregl.GeoJSONSource | undefined;
        routeProgressSource?.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: buildProgressCoordinates(routePoints, eased),
          },
        });

        const routeHeadSource = map.getSource("routeHead") as maplibregl.GeoJSONSource | undefined;
        routeHeadSource?.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: toLngLat(current) },
        });

        map.jumpTo({
          center: toLngLat(current),
          bearing,
          pitch,
          zoom,
        });

        rafId = window.requestAnimationFrame(animate);
        animationRef.current = rafId;
      };

      rafId = window.requestAnimationFrame(animate);
      animationRef.current = rafId;
    });

    return () => {
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, [routePoints, markerFeatures, onLoaded]);

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-white/10 ${heightClassName}`}>
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-cyan-300/20 bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100 backdrop-blur-md">
        Local 3D prototype
      </div>
    </div>
  );
}
