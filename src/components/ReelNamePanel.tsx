"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { Type } from "lucide-react";
import { ReelTitleColor, ReelTitleFont, ReelTitleSize } from "@/types";
import { useLocale } from "@/lib/i18n";

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
  const { copy } = useLocale();
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
  const selectedColorSwatch = colorOptions.find((option) => option.value === reelTitleColor)?.swatchClass ?? "bg-white";
  const previewTextColor = reelTitleColor === "gold"
    ? "#fcd34d"
    : reelTitleColor === "coral"
      ? "#fdba74"
      : reelTitleColor === "cyan"
        ? "#67e8f9"
        : reelTitleColor === "lime"
          ? "#bef264"
          : reelTitleColor === "violet"
            ? "#c4b5fd"
            : reelTitleColor === "pink"
              ? "#f9a8d4"
              : reelTitleColor === "red"
                ? "#f87171"
                : reelTitleColor === "blue"
                  ? "#60a5fa"
                  : reelTitleColor === "emerald"
                    ? "#6ee7b7"
                    : reelTitleColor === "peach"
                      ? "#fed7aa"
                      : reelTitleColor === "silver"
                        ? "#cbd5e1"
                      : "#ffffff";
  const previewFontFamily = reelTitleFont === "classic"
    ? `Georgia, "Times New Roman", serif`
    : reelTitleFont === "modern"
      ? `"Inter", "Arial", "Helvetica Neue", sans-serif`
      : reelTitleFont === "bold"
        ? `"Arial Black", "Inter", "Segoe UI", sans-serif`
        : reelTitleFont === "minimal"
          ? `"Avenir Next", "Inter", "Helvetica Neue", sans-serif`
          : reelTitleFont === "handwritten"
            ? `"Brush Script MT", "Snell Roundhand", "Comic Sans MS", cursive`
            : reelTitleFont === "elegant"
              ? `"Garamond", "Baskerville", Georgia, serif`
              : reelTitleFont === "impact"
                ? `"Impact", "Arial Black", sans-serif`
                : reelTitleFont === "mono"
                  ? `"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace`
                  : reelTitleFont === "rounded"
                    ? `"Trebuchet MS", "Avenir Next", "Segoe UI", sans-serif`
                    : `"Bodoni MT", "Didot", Georgia, serif`;
  const previewFontStyle = reelTitleFont === "handwritten" || reelTitleFont === "elegant" || reelTitleFont === "cinematic" ? "italic" : "normal";
  const previewFontWeight = reelTitleFont === "bold" || reelTitleFont === "impact" ? 800 : 600;
  const previewLetterSpacing = reelTitleFont === "impact"
    ? "-0.03em"
    : reelTitleFont === "mono"
      ? "0.06em"
      : reelTitleFont === "minimal"
        ? "0.12em"
        : "0.02em";
  const previewTextTransform = reelTitleFont === "impact" ? "uppercase" : "none";
  const previewFontSize = reelTitleSize === "sm" ? "1rem" : reelTitleSize === "lg" ? "1.45rem" : "1.2rem";

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1 text-[11px] text-white/45">
            <span>{copy.reelName.typography}</span>
            <select
              value={reelTitleFont}
              onChange={(e) => onChangeReelTitleFont(e.target.value as ReelTitleFont)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/85"
            >
              {Object.entries(copy.reelName.fontOptions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] text-white/45">
            <span>{copy.reelName.letterSize}</span>
            <select
              value={reelTitleSize}
              onChange={(e) => onChangeReelTitleSize(e.target.value as ReelTitleSize)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/85"
            >
              <option value="sm">{copy.reelName.sizeOptions.sm}</option>
              <option value="md">{copy.reelName.sizeOptions.md}</option>
              <option value="lg">{copy.reelName.sizeOptions.lg}</option>
            </select>
          </label>
          <div className="relative space-y-1 text-[11px] text-white/45">
            <span>{copy.reelName.color}</span>
            <button
              type="button"
              onClick={() => setColorMenuOpen((current) => !current)}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/85"
              aria-haspopup="listbox"
              aria-expanded={colorMenuOpen}
              aria-label={copy.reelName.color}
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
                        aria-label={`${copy.reelName.color} ${option.value}`}
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
          {copy.reelName.livePreview}
        </div>
        <input
          value={reelTitle}
          onChange={(e) => onChangeReelTitle(e.target.value)}
          maxLength={60}
          placeholder={copy.reelName.placeholder}
          className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-5 text-center leading-tight placeholder:text-white/30 focus:border-white/20 focus:outline-none"
          style={{
            fontFamily: previewFontFamily,
            fontStyle: previewFontStyle,
            fontWeight: previewFontWeight,
            letterSpacing: previewLetterSpacing,
            textTransform: previewTextTransform as CSSProperties["textTransform"],
            fontSize: previewFontSize,
            color: previewTextColor,
            WebkitTextFillColor: previewTextColor,
          }}
          aria-label={copy.reelName.title}
        />
      </div>
    </div>
  );
}
