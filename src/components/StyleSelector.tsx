"use client";

import { Lock } from "lucide-react";
import { STYLES } from "@/data/mock";
import { ReelStyle } from "@/types";
import { usePlan } from "@/lib/plan-context";
import { cn } from "@/lib/utils";

interface StyleSelectorProps {
  selected: ReelStyle | null;
  onSelect: (style: ReelStyle) => void;
  onLockedClick: () => void;
}

export default function StyleSelector({ selected, onSelect, onLockedClick }: StyleSelectorProps) {
  const { isFree } = usePlan();

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {STYLES.map((style) => {
        const locked = isFree && style.proOnly;
        const isSelected = selected === style.id;
        return (
          <button
            key={style.id}
            onClick={() => (locked ? onLockedClick() : onSelect(style.id))}
            className={cn(
              "relative flex flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition",
              isSelected
                ? "border-transparent bg-white/[0.06] ring-2 ring-fuchsia-400/60"
                : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
              locked && "opacity-70"
            )}
          >
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-base", style.gradient)}>
              <span>{style.emoji}</span>
            </div>
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-semibold text-white/90">{style.label}</span>
              {locked && (
                <span className="flex items-center gap-0.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                  <Lock className="h-2.5 w-2.5" /> PRO
                </span>
              )}
            </div>
            <p className="text-[11px] leading-tight text-white/45">{style.description}</p>
          </button>
        );
      })}
    </div>
  );
}
