"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import type L from "leaflet";
import "@/lib/leaflet-gpx-setup";
import "leaflet-gpx";
import { GpxRouteStats, GpxTrackPoint, VideoRouteMatch } from "@/types";
import { extractTrackPoints, computeRouteStatsFromPoints } from "@/lib/gpx";
import AnimatedRoutePreview from "./AnimatedRoutePreview";
import VideoMarkerLayer from "./VideoMarkerLayer";

interface GPXMapProps {
  gpxText: string;
  videoMatches: VideoRouteMatch[];
  onReady?: (points: GpxTrackPoint[], stats: GpxRouteStats) => void;
  heightClassName?: string;
}

/** Builds the no-image `L.divIcon`s used everywhere on this map — keeps the "premium styled" look and sidesteps Leaflet's default marker image 404s in Next.js bundling. */
function useMapIcons() {
  const [icons, setIcons] = useState<{
    invisible: L.DivIcon;
    start: L.DivIcon;
    end: L.DivIcon;
    video: (status: "gps" | "timestamp") => L.DivIcon;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((leaflet) => {
      if (cancelled) return;
      const Lm = leaflet.default;
      setIcons({
        invisible: Lm.divIcon({ className: "", html: "", iconSize: [0, 0] }),
        start: Lm.divIcon({ className: "", html: `<div class="gpx-marker gpx-marker-start"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] }),
        end: Lm.divIcon({ className: "", html: `<div class="gpx-marker gpx-marker-end"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] }),
        video: (status) =>
          Lm.divIcon({
            className: "",
            html: `<div class="gpx-marker gpx-marker-video gpx-marker-video-${status}">${status === "gps" ? "\u{1F4CD}" : "\u{1F553}"}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return icons;
}

/** Adds the real parsed GPX polyline to the map (via `leaflet-gpx`), reports back extracted points/stats, and flies the camera to fit the route once loaded. */
function GpxRouteLayer({
  gpxText,
  invisibleIcon,
  onLoaded,
}: {
  gpxText: string;
  invisibleIcon: L.DivIcon;
  onLoaded: (points: GpxTrackPoint[], stats: GpxRouteStats, bounds: L.LatLngBounds) => void;
}) {
  const map = useMap();
  const layerRef = useRef<InstanceType<typeof L.GPX> | null>(null);

  useEffect(() => {
    let removed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Lany = (window as any).L as typeof L;
    const layer = new Lany.GPX(gpxText, {
      async: true,
      // NOTE: despite `@types/leaflet-gpx` naming this option `marker_options`,
      // the actual runtime option leaflet-gpx reads for start/end/waypoint
      // icons is `markers` (see node_modules/leaflet-gpx/gpx.js) — the type
      // package is out of date here, hence the cast. `marker_options` (typed)
      // only controls icon *size/anchor* defaults, not which icon is used.
      markers: {
        startIcon: invisibleIcon as unknown as L.Icon,
        endIcon: invisibleIcon as unknown as L.Icon,
        wptIcons: { "": invisibleIcon as unknown as L.Icon },
      },
      polyline_options: {
        color: "#38bdf8",
        weight: 4,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
        className: "gpx-route-line",
      },
    } as L.GPXOptions);
    layerRef.current = layer;

    layer.on("loaded", () => {
      if (removed) return;
      const points = extractTrackPoints(layer);
      const stats = computeRouteStatsFromPoints(points);
      const bounds = layer.getBounds();
      map.flyToBounds(bounds, { padding: [36, 36], duration: 1.2 });
      onLoaded(points, stats, bounds);
    });
    layer.addTo(map);

    return () => {
      removed = true;
      map.removeLayer(layer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpxText, invisibleIcon]);

  return null;
}

/**
 * Real, interactive Leaflet + OpenStreetMap route map for Pro users.
 * Renders the parsed GPX track, start/end markers, and one marker per
 * uploaded video that could be matched to a route point.
 */
export default function GPXMap({ gpxText, videoMatches, onReady, heightClassName = "h-64" }: GPXMapProps) {
  const icons = useMapIcons();
  const [points, setPoints] = useState<GpxTrackPoint[] | null>(null);

  const handleLoaded = (pts: GpxTrackPoint[], stats: GpxRouteStats) => {
    setPoints(pts);
    onReady?.(pts, stats);
  };

  const first = points?.[0];
  const last = points && points.length > 0 ? points[points.length - 1] : undefined;

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-white/10 ${heightClassName}`}>
      <AnimatedRoutePreview visible={!points} />
      {icons && (
        <MapContainer
          center={[45.75, 4.85]}
          zoom={9}
          scrollWheelZoom
          className="h-full w-full"
          style={{ background: "#0a0a10" }}
        >
          <TileLayer
            className="gpx-map-tiles"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GpxRouteLayer gpxText={gpxText} invisibleIcon={icons.invisible} onLoaded={handleLoaded} />

          {first && (
            <Marker position={[first.lat, first.lng]} icon={icons.start}>
              <Popup>Start</Popup>
            </Marker>
          )}
          {last && last !== first && (
            <Marker position={[last.lat, last.lng]} icon={icons.end}>
              <Popup>Finish</Popup>
            </Marker>
          )}

          {points && <VideoMarkerLayer matches={videoMatches} iconFor={icons.video} />}
        </MapContainer>
      )}
    </div>
  );
}
