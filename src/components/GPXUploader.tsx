"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Lock, Map, X } from "lucide-react";
import { usePlan } from "@/lib/plan-context";
import { DEMO_GPX } from "@/data/demo-gpx";
import { matchVideosToRoute } from "@/lib/video-location-matcher";
import { GpxRouteStats, GpxTrackPoint, UploadedVideo } from "@/types";
import RouteStatsCard from "./gpx/RouteStatsCard";
import VideoLocationMatcher from "./gpx/VideoLocationMatcher";

// Leaflet touches `window`/`document` at import time, so the map must never
// be part of the server-rendered bundle — load it client-side only.
const GPXMap = dynamic(() => import("./gpx/GPXMap"), {
  ssr: false,
  loading: () => <div className="h-40 w-full animate-pulse rounded-xl bg-white/5" />,
});
interface GPXUploaderProps {
  onLockedClick: () => void;
  /** Uploaded source clips — used to auto-place video markers along the parsed route. */
  videos: UploadedVideo[];
  onRouteDataChange?: (route: { points: GpxTrackPoint[] | null; stats: GpxRouteStats | null }) => void;
}

/**
 * Real, Pro-only GPX route map: upload a .gpx file, parse it with
 * `leaflet-gpx`, and render it on an interactive OpenStreetMap. Free users
 * see a blurred demo map with an upgrade prompt instead.
 *
 * Video markers are only placed when a video file contains genuine embedded
 * GPS metadata close enough to the GPX route. Videos without GPS (or with GPS
 * far away from the route) stay off the map and are labeled honestly.
 */
export default function GPXUploader({
  onLockedClick,
  videos,
  onRouteDataChange,
}: GPXUploaderProps) {
  const { isFree } = usePlan();
  const inputRef = useRef<HTMLInputElement>(null);
  const [gpxText, setGpxText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [stats, setStats] = useState<GpxRouteStats | null>(null);
  const [points, setPoints] = useState<GpxTrackPoint[] | null>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setStats(null);
    setPoints(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setGpxText(reader.result);
    };
    reader.readAsText(file);
  };

  const clearRoute = () => {
    setGpxText(null);
    setFileName("");
    setStats(null);
    setPoints(null);
    onRouteDataChange?.({ points: null, stats: null });
    if (inputRef.current) inputRef.current.value = "";
  };

  const routeMatch = useMemo(() => {
    if (!points || points.length === 0 || videos.length === 0) return { matches: [], warning: null };
    return matchVideosToRoute(
      videos.map((video) => video.metadata),
      points
    );
  }, [points, videos]);

  if (isFree) {
    return (
      <button
        type="button"
        onClick={onLockedClick}
        className="group relative block w-full overflow-hidden rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-left transition hover:border-white/20"
      >
        <div className="pointer-events-none blur-[3px] grayscale-[0.15] opacity-70">
          <GPXMap gpxText={DEMO_GPX} videoMatches={[]} heightClassName="h-36" />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 px-4 text-center">
          <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
            <Lock className="h-3 w-3" /> PRO FEATURE
          </span>
          <p className="text-xs font-medium text-white/85">Real interactive route maps</p>
          <p className="max-w-[240px] text-[11px] leading-relaxed text-white/50">
            Upgrade to Creator Pro to plot your GPX ride on a live map with distance, elevation and video markers.
          </p>
        </div>
      </button>
    );
  }

  if (gpxText) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 truncate text-xs font-medium text-white/70">
            <Map className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> <span className="truncate">{fileName}</span>
          </p>
          <button
            onClick={clearRoute}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <GPXMap
          gpxText={gpxText}
          videoMatches={routeMatch.matches}
          onReady={(pts, st) => {
            setPoints(pts);
            setStats(st);
            onRouteDataChange?.({ points: pts, stats: st });
          }}
        />

        {stats && (
          <div className="mt-3">
            <RouteStatsCard stats={stats} />
          </div>
        )}

        {routeMatch.warning && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2 text-[11px] text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{routeMatch.warning}</p>
          </div>
        )}

        {routeMatch.matches.length > 0 && (
          <div className="mt-3">
            <VideoLocationMatcher matches={routeMatch.matches} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept=".gpx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-start gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-left transition hover:border-white/20 hover:bg-white/[0.04]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
          <Map className="h-4.5 w-4.5 text-emerald-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-white/85">Importation GPX (pro)</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
            Upload the .gpx file from your ride, hike or road trip — ClipsyReel plots it on a real interactive map with
            distance, elevation, duration and your video locations.
          </p>
        </div>
      </button>
    </div>
  );
}
