"use client";

import { Mountain, RotateCcw } from "lucide-react";
import { createOffroadExperience, getOffroadExperienceLabel } from "@/lib/adventure-setup";
import { OffroadExperience } from "@/types";

interface OffroadExperienceSliderProps {
  value: OffroadExperience | null;
  onChange: (next: OffroadExperience | null) => void;
}

export default function OffroadExperienceSlider({ value, onChange }: OffroadExperienceSliderProps) {
  const level = value?.level ?? 0;
  const label = value?.label ?? getOffroadExperienceLabel(level);

  return (
    <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.03] to-transparent p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-fuchsia-200">
          <Mountain className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/90">Off-road experience</p>
          <p className="mt-0.5 text-xs text-white/45">What is your off-road experience level?</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={level}
          onChange={(e) => {
            const nextLevel = Number(e.target.value);
            const next = value ?? createOffroadExperience(nextLevel);
            onChange({
              ...next,
              level: nextLevel,
              label: getOffroadExperienceLabel(nextLevel),
            });
          }}
          className="w-full accent-fuchsia-400"
        />

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/35">Selected level</p>
          <p className="mt-1 text-lg font-semibold text-white">{level}/10</p>
          <p className="text-sm text-white/60">{label}</p>
        </div>

        {value ? <p className="text-[11px] text-white/45">Shown in the Reel and Adventure Card as rider context.</p> : null}

        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1 text-xs font-medium text-white/45 transition hover:text-white/75"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Skip for now
        </button>
      </div>
    </div>
  );
}
