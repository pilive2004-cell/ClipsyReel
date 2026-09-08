"use client";

import { Lock, MapPin, Plus } from "lucide-react";
import { ManualLocation, VideoLocationMatch } from "@/types";
import { createManualLocation, deleteManualLocation, updateManualLocation } from "@/lib/video-location-matcher";
import ManualLocationForm from "./ManualLocationForm";

interface ManualLocationPanelProps {
  match: VideoLocationMatch;
  isFree: boolean;
  /** Called whenever the manual locations array changes for this video. */
  onChange: (videoId: string, locations: ManualLocation[]) => void;
}

const FREE_MAX = 1;

/**
 * Shown ONLY when a video's status is "metadata_missing" (Level 3).
 * Allows the user to add one or more manual lat/lng locations for that video.
 * Free plan: max 1 manual location. Pro: unlimited.
 */
export default function ManualLocationPanel({ match, isFree, onChange }: ManualLocationPanelProps) {
  // This panel must never render for Level 1 or Level 2 videos
  if (match.status !== "metadata_missing" && match.status !== "manually_placed") return null;

  const locations = match.manualLocations;
  const atFreeLimit = isFree && locations.length >= FREE_MAX;
  const hasValidLocation = locations.some((l) => l.latitude !== null && l.longitude !== null);

  const addLocation = () => {
    if (atFreeLimit) return;
    onChange(match.videoId, [...locations, createManualLocation()]);
  };

  const handleChange = (updated: ManualLocation) => {
    onChange(match.videoId, updateManualLocation(locations, updated.id, updated));
  };

  const handleDelete = (id: string) => {
    onChange(match.videoId, deleteManualLocation(locations, id));
  };

  return (
    <div className="mt-2 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-3 space-y-3">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-violet-300">Manual location required</p>
        <p className="text-[10px] text-white/45 leading-relaxed">
          {match.message}
        </p>
      </div>

      {/* Existing location forms */}
      {locations.map((loc, i) => (
        <ManualLocationForm
          key={loc.id}
          location={loc}
          index={i}
          onChange={handleChange}
          onDelete={() => handleDelete(loc.id)}
          canDelete={locations.length > 1 || hasValidLocation}
        />
      ))}

      {/* Add location button */}
      {atFreeLimit ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-amber-400/20 bg-amber-400/5 px-3 py-2">
          <Lock className="h-3 w-3 shrink-0 text-amber-400" />
          <p className="text-[10px] text-amber-300/80">
            Free plan allows 1 manual location.{" "}
            <span className="font-semibold text-amber-300">Upgrade to Pro</span> for multiple locations per video.
          </p>
        </div>
      ) : (
        <button
          onClick={addLocation}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-violet-400/30 bg-transparent py-2.5 text-[11px] font-semibold text-violet-300 transition hover:border-violet-400/60 hover:bg-violet-500/10 active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add location
        </button>
      )}

      {/* Map pin hint */}
      {locations.length === 0 && (
        <p className="flex items-center gap-1.5 text-[10px] text-white/30">
          <MapPin className="h-3 w-3 shrink-0" />
          Tip: you can also click directly on the map to place this video.
        </p>
      )}
    </div>
  );
}
