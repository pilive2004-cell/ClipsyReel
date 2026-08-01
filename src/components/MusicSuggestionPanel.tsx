"use client";

import { Info, Music2 } from "lucide-react";
import { MusicSuggestion } from "@/types";

export default function MusicSuggestionPanel({ music }: { music: MusicSuggestion }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl brand-gradient">
          <Music2 className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white/90">{music.genre}</p>
          <p className="text-xs text-white/50">
            {music.mood} · {music.bpm} BPM
          </p>
          <p className="mt-1 text-[11px] text-white/40">{music.reference}</p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-2 text-[11px] text-amber-200/80">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>ClipsyReel suggests the vibe — add this track manually inside Instagram before posting (music licensing stays on Instagram&apos;s side).</span>
      </div>
    </div>
  );
}
