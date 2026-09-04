"use client";

import { useState } from "react";
import { PenLine, Type } from "lucide-react";
import { ReelTitleColor, ReelTitleFont, ReelTitleSize } from "@/types";

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
const COLOR_OPTIONS: { value: ReelTitleColor; swatchClass: string; label: string }[] = [
  { value: "white", swatchClass: "bg-white", label: "White" },
  { value: "gold", swatchClass: "bg-amber-300", label: "Gold" },
  { value: "coral", swatchClass: "bg-orange-400", label: "Coral" },
  { value: "cyan", swatchClass: "bg-cyan-400", label: "Cyan" },
  { value: "lime", swatchClass: "bg-lime-300", label: "Lime" },
  { value: "violet", swatchClass: "bg-violet-400", label: "Violet" },
  { value: "pink", swatchClass: "bg-pink-400", label: "Pink" },
  { value: "red", swatchClass: "bg-red-500", label: "Red" },
  { value: "blue", swatchClass: "bg-blue-500", label: "Blue" },
  { value: "emerald", swatchClass: "bg-emerald-400", label: "Emerald" },
  { value: "peach", swatchClass: "bg-orange-200", label: "Peach" },
  { value: "silver", swatchClass: "bg-slate-300", label: "Silver" },
];

export default function HookCaptionPanel({
  overlayTexts,
  overlayFonts = ["cinematic", "cinematic", "cinematic"],
  overlaySizes = ["md", "md", "md"],
  overlayColors = ["white", "white", "white"],
  onChangeOverlayFont,
  onChangeOverlaySize,
  onChangeOverlayColor,
  onChangeOverlayText,
}: HookCaptionPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [colorMenuOpen, setColorMenuOpen] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {overlayTexts.map((text, index) => {
        const typedIndex = index as 0 | 1 | 2;
        const font = overlayFonts[index];
        const size = overlaySizes[index];
        const color = overlayColors[index];
        const isExpanded = expandedIndex === index;

        return (
          <div key={index} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-xs">
              <PenLine className="mt-0.5 h-3 w-3 shrink-0 text-white/30" />
              <input
                value={text}
                onChange={(e) => onChangeOverlayText(typedIndex, e.target.value)}
                placeholder={`Texte ${index + 1}`}
                className="flex-1 bg-transparent text-white/80 placeholder:text-white/25 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                className="text-white/40 hover:text-white/60 transition text-[10px] font-semibold"
              >
                {isExpanded ? "−" : "+"}
              </button>
            </div>

            {isExpanded && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <label className="space-y-1 text-[11px] text-white/45">
                  <span>Typography</span>
                  <select
                    value={font}
                    onChange={(e) => onChangeOverlayFont(typedIndex, e.target.value as ReelTitleFont)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/85"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-[11px] text-white/45">
                  <span>Letter size</span>
                  <select
                    value={size}
                    onChange={(e) => onChangeOverlaySize(typedIndex, e.target.value as ReelTitleSize)}
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
                    onClick={() => setColorMenuOpen(colorMenuOpen === index ? null : index)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/85"
                    aria-haspopup="listbox"
                    aria-expanded={colorMenuOpen === index}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className={`h-3.5 w-3.5 rounded-full border border-white/30 ${COLOR_OPTIONS.find((o) => o.value === color)?.swatchClass}`} />
                    </span>
                    <span className="text-white/60">▾</span>
                  </button>

                  {colorMenuOpen === index && (
                    <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-white/10 bg-[#0b0d13] p-2 shadow-xl">
                      <div className="grid grid-cols-4 gap-2">
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
                              className={`h-6 w-6 rounded-full border transition ${option.swatchClass} ${
                                isActive ? "border-white ring-2 ring-white/60" : "border-white/20 hover:border-white/40"
                              }`}
                              title={option.label}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {text.trim() && (
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px]">
                <Type className="h-3 w-3 text-white/40" />
                <p className="text-white/60">Preview:</p>
                <p className={`ml-auto font-medium ${color === "white" ? "text-white" : color === "gold" ? "text-amber-300" : color === "coral" ? "text-orange-400" : color === "cyan" ? "text-cyan-400" : color === "lime" ? "text-lime-300" : color === "violet" ? "text-violet-300" : color === "pink" ? "text-pink-300" : color === "red" ? "text-red-400" : color === "blue" ? "text-blue-400" : color === "emerald" ? "text-emerald-300" : color === "peach" ? "text-orange-200" : "text-slate-300"}`}>
                  {text.substring(0, 30)}{text.length > 30 ? "…" : ""}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
