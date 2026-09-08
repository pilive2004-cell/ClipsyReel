"use client";

import { Trash2 } from "lucide-react";
import { ManualLocation } from "@/types";

interface ManualLocationFormProps {
  location: ManualLocation;
  index: number;
  onChange: (updated: ManualLocation) => void;
  onDelete: () => void;
  canDelete: boolean;
}

export default function ManualLocationForm({
  location,
  index,
  onChange,
  onDelete,
  canDelete,
}: ManualLocationFormProps) {
  const patch = (field: keyof ManualLocation, value: string | number | null) => {
    onChange({ ...location, [field]: value });
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 space-y-2.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-violet-300 uppercase tracking-wider">
          Location {index + 1}
        </span>
        {canDelete && (
          <button
            onClick={onDelete}
            className="flex h-5 w-5 items-center justify-center rounded-full text-white/30 hover:text-red-400 transition"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Location name */}
      <div>
        <label className="block text-[10px] font-medium text-white/50 mb-1">Location name</label>
        <input
          type="text"
          value={location.locationName}
          onChange={(e) => patch("locationName", e.target.value)}
          placeholder="e.g. Col du Galibier"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
        />
      </div>

      <p className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px] text-white/45">
        Coordinates are set from the map marker placement.
      </p>

      {/* Optional timestamp */}
      <div>
        <label className="block text-[10px] font-medium text-white/50 mb-1">
          Timestamp <span className="text-white/30">(optional)</span>
        </label>
        <input
          type="datetime-local"
          value={location.optionalTimestamp}
          onChange={(e) => patch("optionalTimestamp", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[12px] text-white placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
        />
      </div>

      {/* Note */}
      <div>
        <label className="block text-[10px] font-medium text-white/50 mb-1">
          Note <span className="text-white/30">(optional)</span>
        </label>
        <input
          type="text"
          value={location.note}
          onChange={(e) => patch("note", e.target.value)}
          placeholder="e.g. Start of descent"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white placeholder:text-white/25 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
        />
      </div>
    </div>
  );
}
