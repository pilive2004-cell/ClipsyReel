"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { ChevronDown, Type } from "lucide-react";
import { ReelTitleColor, ReelTitleFont, ReelTitleSize } from "@/types";
import { useLocale } from "@/lib/i18n";

interface HookCaptionPanelProps {
  overlayTexts: [string, string, string];
  overlayFonts: [ReelTitleFont, ReelTitleFont, ReelTitleFont];
  overlaySizes: [ReelTitleSize, ReelTitleSize, ReelTitleSize];
  overlayColors: [ReelTitleColor, ReelTitleColor, ReelTitleColor];
  onChangeOverlayText: (index: 0 | 1 | 2, value: string) => void;
  onChangeOverlayFont: (index: 0 | 1 | 2, value: ReelTitleFont) => void;
  onChangeOverlaySize: (index: 0 | 1 | 2, value: ReelTitleSize) => void;
  onChangeOverlayColor: (index: 0 | 1 | 2, value: ReelTitleColor) => void;
}

const FONT_OPTIONS: ReelTitleFont[] = ["cinematic", "modern", "classic", "bold", "minimal", "handwritten", "elegant", "impact", "mono", "rounded"];

const COLOR_OPTIONS: { value: ReelTitleColor; swatchClass: string }[] = [
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

function getPreviewTextColor(color: ReelTitleColor): string {
  switch (color) {
    case "gold":
      return "#fcd34d";
    case "coral":
      return "#fdba74";
    case "cyan":
      return "#67e8f9";
    case "lime":
      return "#bef264";
    case "violet":
      return "#c4b5fd";
    case "pink":
      return "#f9a8d4";
    case "red":
      return "#f87171";
    case "blue":
      return "#60a5fa";
    case "emerald":
      return "#6ee7b7";
    case "peach":
      return "#fed7aa";
    case "silver":
      return "#cbd5e1";
    case "white":
    default:
      return "#ffffff";
  }
}

function getPreviewFontFamily(font: ReelTitleFont): string {
  switch (font) {
    case "classic":
      return `Georgia, "Times New Roman", serif`;
    case "modern":
      return `"Inter", "Arial", "Helvetica Neue", sans-serif`;
    case "bold":
      return `"Arial Black", "Inter", "Segoe UI", sans-serif`;
    case "minimal":
      return `"Avenir Next", "Inter", "Helvetica Neue", sans-serif`;
    case "handwritten":
      return `"Brush Script MT", "Snell Roundhand", "Comic Sans MS", cursive`;
    case "elegant":
      return `"Garamond", "Baskerville", Georgia, serif`;
    case "impact":
      return `"Impact", "Arial Black", sans-serif`;
    case "mono":
      return `"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
    case "rounded":
      return `"Trebuchet MS", "Avenir Next", "Segoe UI", sans-serif`;
    case "cinematic":
    default:
      return `"Bodoni MT", "Didot", Georgia, serif`;
  }
}

export default function HookCaptionPanel({
  overlayTexts,
  overlayFonts = ["bold", "bold", "bold"],
  overlaySizes = ["md", "md", "md"],
  overlayColors = ["white", "white", "white"],
  onChangeOverlayFont,
  onChangeOverlaySize,
  onChangeOverlayColor,
  onChangeOverlayText,
}: HookCaptionPanelProps) {
  const [colorMenuOpen, setColorMenuOpen] = useState<number | null>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { copy } = useLocale();

  useEffect(() => {
    const updateCompactMode = () => setIsCompact(window.innerWidth < 640);
    updateCompactMode();
    window.addEventListener("resize", updateCompactMode);
    return () => window.removeEventListener("resize", updateCompactMode);
  }, []);

  return (
    <div className="space-y-3 sm:space-y-4">
      {overlayTexts.map((text, index) => {
        const typedIndex = index as 0 | 1 | 2;
        const font = overlayFonts[index];
        const size = overlaySizes[index];
        const color = overlayColors[index];
        const selectedColorSwatch = COLOR_OPTIONS.find((option) => option.value === color)?.swatchClass ?? "bg-white";

        const previewTextColor = getPreviewTextColor(color);
        const previewFontFamily = getPreviewFontFamily(font);
        const previewFontStyle = font === "handwritten" || font === "elegant" || font === "cinematic" ? "italic" : "normal";
        const previewFontWeight = font === "bold" || font === "impact" ? 800 : 600;
        const previewLetterSpacing = font === "impact" ? "-0.03em" : font === "mono" ? "0.06em" : font === "minimal" ? "0.12em" : "0.02em";
        const previewTextTransform = font === "impact" ? "uppercase" : "none";
        const previewFontSize = size === "sm" ? "1rem" : size === "lg" ? "1.45rem" : "1.2rem";
        const isExpanded = !isCompact || openIndex === index;

        return (
          <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.02] p-2.5 sm:p-3.5">
            {isCompact ? (
              <button
                type="button"
                onClick={() => setOpenIndex((current) => (current === index ? null : index))}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">Hook {index + 1}</div>
                  <div className="mt-1 truncate text-sm font-medium text-white/85">
                    {text.trim() || copy.reelName.placeholder}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-white/55 transition ${isExpanded ? "rotate-180" : ""}`} />
              </button>
            ) : null}

            {(isExpanded || !isCompact) && (
              <div className={`space-y-3 ${isCompact ? "mt-3" : ""}`}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="space-y-1 text-[11px] text-white/45">
                    <span>{copy.reelName.typography}</span>
                    <select
                      value={font}
                      onChange={(e) => onChangeOverlayFont(typedIndex, e.target.value as ReelTitleFont)}
                      className="min-h-[42px] w-full rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-white/85"
                    >
                      {FONT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                        {copy.reelName.fontOptions[option]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-[11px] text-white/45">
                    <span>{copy.reelName.letterSize}</span>
                    <select
                      value={size}
                      onChange={(e) => onChangeOverlaySize(typedIndex, e.target.value as ReelTitleSize)}
                      className="min-h-[42px] w-full rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-white/85"
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
                      onClick={() => setColorMenuOpen((current) => (current === index ? null : index))}
                      className="flex min-h-[42px] w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-white/85"
                      aria-haspopup="listbox"
                      aria-expanded={colorMenuOpen === index}
                      aria-label={copy.reelName.color}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-3.5 w-3.5 rounded-full border border-white/30 ${selectedColorSwatch}`} />
                      </span>
                      <span className="text-white/60">▾</span>
                    </button>

                    {colorMenuOpen === index && (
                      <div className="absolute left-0 right-0 z-20 mt-1 rounded-xl border border-white/10 bg-[#0b0d13] p-2 shadow-xl">
                        <div className="grid grid-cols-4 gap-2" role="listbox" aria-label="Liste de couleurs">
                          {COLOR_OPTIONS.map((option) => {
                            const isActive = option.value === color;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  onChangeOverlayColor(typedIndex, option.value);
                                  setColorMenuOpen(null);
                                }}
                                className={`h-7 w-7 rounded-full border transition ${option.swatchClass} ${
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

                <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 sm:px-4 sm:py-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/40 sm:text-[11px]">
                    <Type className="h-3 w-3" />
                    {copy.reelName.livePreview}
                  </div>
                  <input
                    value={text}
                    onChange={(e) => onChangeOverlayText(typedIndex, e.target.value)}
                    maxLength={60}
                    placeholder={copy.reelName.placeholder}
                    className="w-full min-h-[52px] rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center leading-tight placeholder:text-white/30 focus:border-white/20 focus:outline-none sm:px-4 sm:py-4"
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
                    aria-label={`${copy.hook.title} ${index + 1}`}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
