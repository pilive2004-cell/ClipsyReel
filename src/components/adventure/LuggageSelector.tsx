"use client";

import { BriefcaseBusiness } from "lucide-react";
import AdventureBrandModelSelector from "@/components/adventure/AdventureBrandModelSelector";
import { LUGGAGE_OPTIONS } from "@/data/adventure-gear";
import { AdventureEquipmentItem } from "@/types";

interface LuggageSelectorProps {
  value: AdventureEquipmentItem | null;
  onChange: (next: AdventureEquipmentItem | null) => void;
}

export default function LuggageSelector({ value, onChange }: LuggageSelectorProps) {
  return (
    <AdventureBrandModelSelector
      category="luggage"
      title="Luggage"
      question="Which luggage system did you use?"
      icon={BriefcaseBusiness}
      options={LUGGAGE_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
