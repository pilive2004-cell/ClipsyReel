"use client";

import { CircleDot } from "lucide-react";
import AdventureBrandModelSelector from "@/components/adventure/AdventureBrandModelSelector";
import { TIRE_OPTIONS } from "@/data/adventure-gear";
import { AdventureEquipmentItem } from "@/types";

interface TireSelectorProps {
  value: AdventureEquipmentItem | null;
  onChange: (next: AdventureEquipmentItem | null) => void;
}

export default function TireSelector({ value, onChange }: TireSelectorProps) {
  return (
    <AdventureBrandModelSelector
      category="tires"
      title="Tires"
      question="Which tires did you use?"
      icon={CircleDot}
      options={TIRE_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
