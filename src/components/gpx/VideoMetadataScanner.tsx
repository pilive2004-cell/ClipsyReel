"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Radar } from "lucide-react";
import { GpxTrackPoint, ManualLocation, UploadedVideo, VideoLocationMatch } from "@/types";
import { matchVideosToGPX } from "@/lib/video-location-matcher";
import VideoLocationStatusCard from "./VideoLocationStatusCard";
import ManualLocationPanel from "./ManualLocationPanel";
import { usePlan } from "@/lib/plan-context";

interface VideoMetadataScannerProps {
  videos: UploadedVideo[];
  gpxPoints: GpxTrackPoint[];
  /** Called whenever the full set of VideoLocationMatch results updates so
   *  the parent (GPXUploader) can forward manual markers to the map. */
  onMatchesChange?: (matches: VideoLocationMatch[]) => void;
}

/**
 * Orchestrates the Smart Video Location Matcher scanning flow:
 * 1. On mount (or when videos/gpxPoints change), runs `matchVideosToGPX` to
 *    detect Level 1 / 2 / 3 for every uploaded video.
 * 2. Renders a `VideoLocationStatusCard` per video.
 * 3. Shows `ManualLocationPanel` only for Level-3 (metadata_missing) videos.
 * 4. Manages the manual-locations state and bubbles updates via `onMatchesChange`.
 */
export default function VideoMetadataScanner({ videos, gpxPoints, onMatchesChange }: VideoMetadataScannerProps) {
  const { isFree } = usePlan();
  const [scanning, setScanning] = useState(false);
  const [matches, setMatches] = useState<VideoLocationMatch[]>([]);

  // Track the last set of video IDs we scanned so we don't rescan on every
  // gpxPoints reference change (gpxPoints is a new array ref on every GPX parse).
  const lastVideoKey = useRef<string>("");
  const videoKey = videos.map((v) => v.name + v.file.size).join("|");

  useEffect(() => {
    let cancelled = false;
    if (videos.length === 0) {
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        setMatches([]);
        setScanning(false);
        onMatchesChange?.([]);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    if (videoKey === lastVideoKey.current && gpxPoints.length === 0) return;
    lastVideoKey.current = videoKey;

    setScanning(true);
    matchVideosToGPX(videos, gpxPoints).then((results) => {
      if (cancelled) return;
      setMatches(results);
      onMatchesChange?.(results);
      setScanning(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoKey, gpxPoints.length]);

  const handleManualChange = (videoId: string, locations: ManualLocation[]) => {
    setMatches((prev) => {
      const next = prev.map((m) => {
        if (m.videoId !== videoId) return m;
        const anyValid = locations.some((l) => l.latitude !== null && l.longitude !== null);
        return {
          ...m,
          manualLocations: locations,
          status: anyValid
            ? ("manually_placed" as const)
            : ("metadata_missing" as const),
        };
      });
      onMatchesChange?.(next);
      return next;
    });
  };

  if (videos.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Radar className="h-3.5 w-3.5 text-white/40" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Video Location Detection
        </h3>
        {scanning && <Loader2 className="ml-auto h-3 w-3 animate-spin text-white/30" />}
      </div>

      {scanning && matches.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />
          <span className="text-[11px] text-white/40">Scanning video metadata…</span>
        </div>
      )}

      {/* Per-video cards */}
      {matches.map((match) => (
        <div key={match.videoId} className="space-y-0.5">
          <VideoLocationStatusCard match={match} />
          <ManualLocationPanel
            match={match}
            isFree={isFree}
            onChange={handleManualChange}
          />
        </div>
      ))}

      {/* Summary */}
      {!scanning && matches.length > 0 && (
        <p className="flex items-center gap-1.5 text-[10px] text-white/30 pt-1">
          <MapPin className="h-3 w-3 shrink-0" />
          {matches.filter((m) => m.status === "gps_detected").length} GPS ·{" "}
          {matches.filter((m) => m.status === "timestamp_detected").length} timestamp ·{" "}
          {matches.filter((m) => m.status === "metadata_missing").length} manual required
        </p>
      )}
    </div>
  );
}
