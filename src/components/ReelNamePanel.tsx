"use client";

import { useState } from "react";
import { Type } from "lucide-react";
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
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
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
            : reelTitleColor === "pink"
              ? "text-pink-300"
              : reelTitleColor === "red"
                ? "text-red-400"
                : reelTitleColor === "blue"
                  ? "text-blue-400"
                  : reelTitleColor === "emerald"
                    ? "text-emerald-300"
                    : reelTitleColor === "peach"
                      ? "text-orange-200"
                      : reelTitleColor === "silver"
                        ? "text-slate-300"
            : "text-white";
  const selectedColorSwatch = colorOptions.find((option) => option.value === reelTitleColor)?.swatchClass ?? "bg-white";

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
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
          <div className="relative space-y-1 text-[11px] text-white/45">
            <span>Color</span>
            <button
              type="button"
              onClick={() => setColorMenuOpen((current) => !current)}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/85"
              aria-haspopup="listbox"
              aria-expanded={colorMenuOpen}
              aria-label="Choisir une couleur"
            >
              <span className="inline-flex items-center gap-2">
                <span className={`h-3.5 w-3.5 rounded-full border border-white/30 ${selectedColorSwatch}`} />
              </span>
              <span className="text-white/60">▾</span>
            </button>
            {colorMenuOpen && (
              <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-white/10 bg-[#0b0d13] p-2 shadow-xl">
                <div className="grid grid-cols-4 gap-2" role="listbox" aria-label="Liste de couleurs">
                  {colorOptions.map((option) => {
                    const isActive = option.value === reelTitleColor;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onChangeReelTitleColor(option.value);
                          setColorMenuOpen(false);
                        }}
                        className={`h-6 w-6 rounded-full border transition ${option.swatchClass} ${
                          isActive ? "border-white ring-2 ring-white/60" : "border-white/20 hover:border-white/40"
                        }`}
                        title={option.value}
                        aria-label={`Choisir la couleur ${option.value}`}
                        aria-pressed={isActive}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
          <Type className="h-3 w-3" />
          Live preview
        </div>
        <input
          value={reelTitle}
          onChange={(e) => onChangeReelTitle(e.target.value)}
          maxLength={60}
          placeholder="Tape ton texte ici"
          className={`w-full bg-transparent text-center leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] placeholder:text-white/30 focus:outline-none ${titleColorClass} ${titleFontClass} ${titleSizeClass}`}
          aria-label="Reel title live preview input"
        />
        {!reelTitle.trim() && (
          <p className={`mt-1 text-center leading-tight opacity-60 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] ${titleColorClass} ${titleFontClass} ${titleSizeClass}`}>
            {previewText}
          </p>
        )}
      </div>
    </div>
  );
}
