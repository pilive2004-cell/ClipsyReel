"use client";

import { Camera } from "lucide-react";
import AdventureBrandModelSelector from "@/components/adventure/AdventureBrandModelSelector";
import { CAMERA_OPTIONS } from "@/data/adventure-gear";
import { AdventureEquipmentItem } from "@/types";

interface CameraSelectorProps {
  value: AdventureEquipmentItem | null;
  onChange: (next: AdventureEquipmentItem | null) => void;
}

export default function CameraSelector({ value, onChange }: CameraSelectorProps) {
  return (
    <AdventureBrandModelSelector
      category="camera"
      title="Camera"
      question="Which camera did you use?"
      icon={Camera}
      options={CAMERA_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
