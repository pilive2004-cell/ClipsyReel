"use client";

import { PenLine } from "lucide-react";

interface HookCaptionPanelProps {
  overlayTexts: [string, string, string];
  onChangeOverlayText: (index: 0 | 1 | 2, value: string) => void;
}

export default function HookCaptionPanel({
  overlayTexts,
  onChangeOverlayText,
}: HookCaptionPanelProps) {
  return (
    <div className="space-y-4">
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
