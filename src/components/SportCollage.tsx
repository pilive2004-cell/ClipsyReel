"use client";

import { useEffect, useMemo, useRef } from "react";
import DynamicGridLayout from "@/components/DynamicGridLayout";
import { SportCollageCard, SportCropFocus } from "@/lib/sport-style";

function objectPositionForCropFocus(cropFocus: SportCropFocus) {
  if (cropFocus === "left") return "20% 50%";
  if (cropFocus === "right") return "80% 50%";
  if (cropFocus === "top") return "50% 24%";
  if (cropFocus === "bottom") return "50% 76%";
  if (cropFocus === "upper-left") return "24% 24%";
  if (cropFocus === "upper-right") return "76% 24%";
  if (cropFocus === "lower-left") return "24% 76%";
  if (cropFocus === "lower-right") return "76% 76%";
  return "50% 50%";
}

function toneClasses(tone: SportCollageCard["tone"]) {
  if (tone === "green") return "border-emerald-300/70";
  if (tone === "sand") return "border-stone-200/65";
  return "border-[rgba(241,92,5,0.82)]";
}

interface SportCollageProps {
  videoUrl: string;
  currentTimeSeconds: number;
  cards: SportCollageCard[];
}

export default function SportCollage({ videoUrl, currentTimeSeconds, cards }: SportCollageProps) {
  const refs = useRef<Array<HTMLVideoElement | null>>([]);

  useEffect(() => {
    refs.current.forEach((video) => {
      if (!video) return;
      if (Math.abs(video.currentTime - currentTimeSeconds) > 0.24) {
        video.currentTime = currentTimeSeconds;
      }
      if (video.paused) {
        void video.play().catch(() => {});
      }
    });
  }, [currentTimeSeconds, cards]);

  const keyedCards = useMemo(
    () => cards.map((card, index) => ({ card, key: `${videoUrl}-${card.label}-${card.start}-${index}` })),
    [cards, videoUrl]
  );

  if (keyedCards.length === 0) return null;

  return (
    <DynamicGridLayout
      cards={cards}
      renderCard={(card, index) => (
        <div className="relative h-full w-full">
          <div className={`absolute inset-0 overflow-hidden rounded-[20px] border bg-slate-950/42 shadow-[0_16px_34px_rgba(2,6,23,0.42)] backdrop-blur-sm ${toneClasses(card.tone)}`}>
            <video
              key={keyedCards[index]?.key}
              ref={(node) => {
                refs.current[index] = node;
              }}
              src={videoUrl}
              className="h-full w-full scale-[1.16] object-cover saturate-[1.08]"
              style={{ objectPosition: objectPositionForCropFocus(card.cropFocus) }}
              muted
              loop
              autoPlay
              playsInline
              preload="auto"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_30%,rgba(2,6,23,0.18))]" />
          </div>
          <div className="absolute -bottom-2 left-3 rounded-full border border-white/12 bg-black/62 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.24em] text-white/72 backdrop-blur-md">
            {card.label}
          </div>
        </div>
      )}
    />
  );
}
