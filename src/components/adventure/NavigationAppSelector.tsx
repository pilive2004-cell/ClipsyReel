"use client";

import { useState } from "react";
import { ChevronDown, MapPinned, RotateCcw } from "lucide-react";
import { NAVIGATION_APP_OPTIONS } from "@/data/adventure-gear";
import { createAdventureNavigationApp, getAdventureNavigationDisplayName, isAdventureNavigationFilled } from "@/lib/adventure-setup";
import { cn } from "@/lib/utils";
import { AdventureNavigationApp } from "@/types";

interface NavigationAppSelectorProps {
  value: AdventureNavigationApp | null;
  onChange: (next: AdventureNavigationApp | null) => void;
}

export default function NavigationAppSelector({ value, onChange }: NavigationAppSelectorProps) {
  const [open, setOpen] = useState(() => !isAdventureNavigationFilled(value));
  const summary = getAdventureNavigationDisplayName(value);
  const ensureValue = () => value ?? createAdventureNavigationApp();

  return (
    <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.03] to-transparent p-4">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-fuchsia-200">
            <MapPinned className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/90">Navigation app</p>
            <p className="mt-0.5 text-xs text-white/45">{summary || "Which navigation app did you use?"}</p>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/35 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs leading-relaxed text-white/55">Select the navigation app you actually used on this adventure.</p>

          <div className="flex flex-wrap gap-2">
            {NAVIGATION_APP_OPTIONS.map((option) => {
              const selected = value?.name === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    const next = ensureValue();
                    onChange({
                      ...next,
                      name: option,
                      customName: option === "Other" ? next.customName : "",
                    });
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                    selected ? "border-fuchsia-400/40 bg-fuchsia-500/12 text-white" : "border-white/10 bg-white/[0.04] text-white/65 hover:text-white"
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {value?.name === "Other" ? (
            <input
              value={value.customName}
              onChange={(e) => {
                const next = ensureValue();
                onChange({ ...next, name: "Other", customName: e.target.value });
              }}
              placeholder="Type your navigation app"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white/90 placeholder:text-white/25 focus:border-fuchsia-400/40 focus:outline-none"
            />
          ) : null}

          {value ? <p className="text-[11px] text-white/45">Automatically included in the Reel and Adventure Card.</p> : null}

          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-xs font-medium text-white/45 transition hover:text-white/75"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Skip for now
          </button>
        </div>
      ) : null}
    </div>
  );
}
