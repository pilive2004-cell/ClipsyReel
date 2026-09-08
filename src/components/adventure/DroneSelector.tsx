"use client";

import { Send } from "lucide-react";
import AdventureBrandModelSelector from "@/components/adventure/AdventureBrandModelSelector";
import { DRONE_OPTIONS } from "@/data/adventure-gear";
import { AdventureEquipmentItem } from "@/types";

interface DroneSelectorProps {
  value: AdventureEquipmentItem | null;
  onChange: (next: AdventureEquipmentItem | null) => void;
}

export default function DroneSelector({ value, onChange }: DroneSelectorProps) {
  return (
    <AdventureBrandModelSelector
      category="drone"
      title="Drone"
      question="Which drone did you use?"
      icon={Send}
      options={DRONE_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
