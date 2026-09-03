"use client";

import { PenLine, Type } from "lucide-react";
import { ReelTitleColor, ReelTitleFont, ReelTitleSize } from "@/types";

interface ReelNamePanelProps {
  reelTitle: string;
  reelTitleFont: ReelTitleFont;
  reelTitleSize: ReelTitleSize;
  reelTitleColor: ReelTitleColor;
  onChangeReelTitle: (value: string) => void;
  onChangeReelTitleFont: (value: ReelTitleFont) => void;
  onChangeReelTitleSize: (value: ReelTitleSize) => void;
  onChangeReelTitleColor: (value: ReelTitleColor) => void;
}

export default function ReelNamePanel({
  reelTitle,
  reelTitleFont,
  reelTitleSize,
  reelTitleColor,
  onChangeReelTitle,
  onChangeReelTitleFont,
  onChangeReelTitleSize,
  onChangeReelTitleColor,
}: ReelNamePanelProps) {
  const colorOptions: { value: ReelTitleColor; swatchClass: string }[] = [
    { value: "white", swatchClass: "bg-white" },
    { value: "gold", swatchClass: "bg-amber-300" },
    { value: "coral", swatchClass: "bg-orange-300" },
    { value: "cyan", swatchClass: "bg-cyan-300" },
    { value: "lime", swatchClass: "bg-lime-300" },
    { value: "violet", swatchClass: "bg-violet-300" },
    { value: "pink", swatchClass: "bg-pink-300" },
    { value: "red", swatchClass: "bg-red-400" },
    { value: "blue", swatchClass: "bg-blue-400" },
    { value: "emerald", swatchClass: "bg-emerald-300" },
    { value: "peach", swatchClass: "bg-orange-200" },
    { value: "silver", swatchClass: "bg-slate-300" },
  ];
  const previewText = reelTitle.trim() || "My next adventure";
  const titleFontClass = reelTitleFont === "classic"
    ? "font-serif"
    : reelTitleFont === "modern"
      ? "font-sans tracking-wide"
      : reelTitleFont === "bold"
        ? "font-sans font-black tracking-tight"
        : reelTitleFont === "minimal"
          ? "font-sans font-light tracking-[0.12em]"
          : reelTitleFont === "handwritten"
            ? "font-serif italic tracking-[0.02em]"
            : reelTitleFont === "elegant"
              ? "font-serif font-medium tracking-[0.06em]"
              : reelTitleFont === "impact"
                ? "font-sans font-extrabold uppercase tracking-tight"
                : reelTitleFont === "mono"
                  ? "font-mono tracking-[0.08em]"
                  : reelTitleFont === "rounded"
                    ? "font-sans font-semibold tracking-[0.04em]"
            : "font-serif italic tracking-[0.08em]";
  const titleSizeClass = reelTitleSize === "sm"
    ? "text-base"
    : reelTitleSize === "lg"
      ? "text-2xl"
      : "text-xl";
  const titleColorClass = reelTitleColor === "gold"
    ? "text-amber-300"
    : reelTitleColor === "coral"
      ? "text-orange-300"
      : reelTitleColor === "cyan"
        ? "text-cyan-300"
        : reelTitleColor === "lime"
          ? "text-lime-300"
          : reelTitleColor === "violet"
            ? "text-violet-300"
            : "text-white";

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-1 text-sm font-semibold text-white/85">Reel Name</h3>
        <p className="text-xs text-white/45">Define the title shown at the start of your Reel.</p>
      </section>

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs">
          <PenLine className="mt-0.5 h-3 w-3 shrink-0 text-white/30" />
          <input
            value={reelTitle}
            onChange={(e) => onChangeReelTitle(e.target.value)}
            maxLength={60}
            placeholder="Enter Reel name"
            className="flex-1 bg-transparent text-white/80 placeholder:text-white/25 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1 text-[11px] text-white/45">
            <span>Typography</span>
            <select
              value={reelTitleFont}
              onChange={(e) => onChangeReelTitleFont(e.target.value as ReelTitleFont)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/85"
            >
              <option value="cinematic">Cinematic</option>
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
              <option value="bold">Bold</option>
              <option value="minimal">Minimal</option>
              <option value="handwritten">Handwritten</option>
              <option value="elegant">Elegant</option>
              <option value="impact">Impact</option>
              <option value="mono">Mono</option>
              <option value="rounded">Rounded</option>
            </select>
          </label>
          <label className="space-y-1 text-[11px] text-white/45">
            <span>Letter size</span>
            <select
              value={reelTitleSize}
              onChange={(e) => onChangeReelTitleSize(e.target.value as ReelTitleSize)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/85"
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </label>
          <label className="space-y-1 text-[11px] text-white/45">
            <span>Color</span>
            <select
              value={reelTitleColor}
              onChange={(e) => onChangeReelTitleColor(e.target.value as ReelTitleColor)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/85"
            >
              {colorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value.charAt(0).toUpperCase() + option.value.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
          <Type className="h-3 w-3" />
          Live preview
        </div>
        <p className={`text-center leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] ${titleColorClass} ${titleFontClass} ${titleSizeClass}`}>
          {previewText}
        </p>
      </div>
    </div>
  );
}
