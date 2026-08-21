"use client";

import { PenLine } from "lucide-react";
import { ReelTitleFont, ReelTitleSize } from "@/types";

interface HookCaptionPanelProps {
  reelTitle: string;
  reelTitleFont: ReelTitleFont;
  reelTitleSize: ReelTitleSize;
  onChangeReelTitle: (value: string) => void;
  onChangeReelTitleFont: (value: ReelTitleFont) => void;
  onChangeReelTitleSize: (value: ReelTitleSize) => void;
  overlayTexts: [string, string, string];
  onChangeOverlayText: (index: 0 | 1 | 2, value: string) => void;
}

export default function HookCaptionPanel({
  reelTitle,
  reelTitleFont,
  reelTitleSize,
  onChangeReelTitle,
  onChangeReelTitleFont,
  onChangeReelTitleSize,
  overlayTexts,
  onChangeOverlayText,
}: HookCaptionPanelProps) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-1 text-sm font-semibold text-white/85">Reel title</h3>
        <p className="text-xs text-white/45">Ajoute un titre affiché en début de Reel, puis choisis sa typographie et sa taille.</p>
      </section>

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs">
          <PenLine className="mt-0.5 h-3 w-3 shrink-0 text-white/30" />
          <input
            value={reelTitle}
            onChange={(e) => onChangeReelTitle(e.target.value)}
            maxLength={60}
            placeholder="Titre du Reel"
            className="flex-1 bg-transparent text-white/80 placeholder:text-white/25 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[11px] text-white/45">
            <span>Typographie</span>
            <select
              value={reelTitleFont}
              onChange={(e) => onChangeReelTitleFont(e.target.value as ReelTitleFont)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/85"
            >
              <option value="cinematic">Cinématique</option>
              <option value="modern">Moderne</option>
              <option value="classic">Classique</option>
            </select>
          </label>
          <label className="space-y-1 text-[11px] text-white/45">
            <span>Taille</span>
            <select
              value={reelTitleSize}
              onChange={(e) => onChangeReelTitleSize(e.target.value as ReelTitleSize)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/85"
            >
              <option value="sm">Petite</option>
              <option value="md">Moyenne</option>
              <option value="lg">Grande</option>
            </select>
          </label>
        </div>
      </div>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-white/85">Hook text</h3>
        <p className="text-xs text-white/45">Ajoute jusqu&apos;à trois textes personnels qui apparaîtront dans la vidéo.</p>
      </section>

      <div className="space-y-2">
        {overlayTexts.map((text, index) => (
          <div key={index} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs">
            <PenLine className="mt-0.5 h-3 w-3 shrink-0 text-white/30" />
            <input
              value={text}
              onChange={(e) => onChangeOverlayText(index as 0 | 1 | 2, e.target.value)}
              placeholder={`Texte ${index + 1}`}
              className="flex-1 bg-transparent text-white/80 placeholder:text-white/25 focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
