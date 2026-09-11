"use client";

import { ReactNode } from "react";
import { SportCollageCard } from "@/lib/sport-style";

interface DynamicGridLayoutProps {
  cards: SportCollageCard[];
  renderCard: (card: SportCollageCard, index: number) => ReactNode;
}

export default function DynamicGridLayout({ cards, renderCard }: DynamicGridLayoutProps) {
  return (
    <div className="absolute inset-0">
      {cards.map((card, index) => (
        <div
          key={`${card.label}-${card.start}-${index}`}
          className="absolute"
          style={{
            left: `${card.x * 100}%`,
            top: `${card.y * 100}%`,
            width: `${card.width * 100}%`,
            height: `${card.height * 100}%`,
            transform: `rotate(${card.rotate}deg)`,
          }}
        >
          {renderCard(card, index)}
        </div>
      ))}
    </div>
  );
}
