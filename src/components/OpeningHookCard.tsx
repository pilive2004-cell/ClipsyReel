"use client";

import { EmotionalStoryBeat } from "@/types";

export default function OpeningHookCard({ beat }: { beat: EmotionalStoryBeat }) {
  return (
    <div className="rounded-xl border border-orange-400/25 bg-orange-400/[0.08] p-3 text-xs">
      <p className="text-[10px] uppercase tracking-wider text-orange-200/80">Opening Hook</p>
      <p className="mt-1 text-orange-100">{beat.startTime} → {beat.endTime} · {beat.intensity}%</p>
      <p className="text-orange-100/70">{beat.targetEmotion}</p>
    </div>
  );
}
