"use client";

import { Bike } from "lucide-react";
import AdventureBrandModelSelector from "@/components/adventure/AdventureBrandModelSelector";
import { MOTORCYCLE_OPTIONS } from "@/data/adventure-gear";
import { AdventureEquipmentItem } from "@/types";

interface MotorcycleSelectorProps {
  value: AdventureEquipmentItem | null;
  onChange: (next: AdventureEquipmentItem | null) => void;
}

export default function MotorcycleSelector({ value, onChange }: MotorcycleSelectorProps) {
  return (
    <AdventureBrandModelSelector
      category="motorcycle"
      title="Motorcycle"
      question="Which motorcycle did you use?"
      icon={Bike}
      options={MOTORCYCLE_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
