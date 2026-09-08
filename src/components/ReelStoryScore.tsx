"use client";

export default function ReelStoryScore({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"
      : score >= 70
        ? "text-cyan-300 border-cyan-400/30 bg-cyan-400/10"
        : "text-amber-300 border-amber-400/30 bg-amber-400/10";
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs ${tone}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-80">Reel Story Score</p>
      <p className="text-lg font-semibold leading-tight">{score}/100</p>
    </div>
  );
}
