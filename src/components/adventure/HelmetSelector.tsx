"use client";

import { Shield } from "lucide-react";
import AdventureBrandModelSelector from "@/components/adventure/AdventureBrandModelSelector";
import { HELMET_OPTIONS } from "@/data/adventure-gear";
import { AdventureEquipmentItem } from "@/types";

interface HelmetSelectorProps {
  value: AdventureEquipmentItem | null;
  onChange: (next: AdventureEquipmentItem | null) => void;
}

export default function HelmetSelector({ value, onChange }: HelmetSelectorProps) {
  return (
    <AdventureBrandModelSelector
      category="helmet"
      title="Helmet"
      question="Which helmet did you use?"
      icon={Shield}
      options={HELMET_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
