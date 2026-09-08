"use client";

import { Bike, BriefcaseBusiness, Camera, CircleDot, MapPinned, Send, Shield, Star } from "lucide-react";
import EquipmentItemCard from "@/components/adventure/EquipmentItemCard";
import PartnerStatusBadge from "@/components/adventure/PartnerStatusBadge";
import {
  getAdventureEquipmentDisplayName,
  getAdventureNavigationDisplayName,
  isAdventureEquipmentItemFilled,
  isAdventureNavigationFilled,
} from "@/lib/adventure-setup";
import { AdventureSetup } from "@/types";

interface AdventureSetupCardProps {
  setup: AdventureSetup;
}

interface SetupCardItem {
  key: string;
  icon: typeof Bike;
  title: string;
  value: string;
  detail?: string;
  badge?: React.ReactNode;
}

export default function AdventureSetupCard({ setup }: AdventureSetupCardProps) {
  const items: SetupCardItem[] = [];

  if (setup.motorcycle && isAdventureEquipmentItemFilled(setup.motorcycle)) {
    items.push({
      key: "motorcycle",
      icon: Bike,
      title: "Motorcycle",
      value: getAdventureEquipmentDisplayName(setup.motorcycle),
      badge: <PartnerStatusBadge status={setup.motorcycle.partnerStatus} />,
    });
  }

  if (setup.helmet && isAdventureEquipmentItemFilled(setup.helmet)) {
    items.push({
      key: "helmet",
      icon: Shield,
      title: "Helmet",
      value: getAdventureEquipmentDisplayName(setup.helmet),
      badge: <PartnerStatusBadge status={setup.helmet.partnerStatus} />,
    });
  }

  if (setup.camera && isAdventureEquipmentItemFilled(setup.camera)) {
    items.push({
      key: "camera",
      icon: Camera,
      title: "Camera",
      value: getAdventureEquipmentDisplayName(setup.camera),
      badge: <PartnerStatusBadge status={setup.camera.partnerStatus} />,
    });
  }

  if (setup.drone && isAdventureEquipmentItemFilled(setup.drone)) {
    items.push({
      key: "drone",
      icon: Send,
      title: "Drone",
      value: getAdventureEquipmentDisplayName(setup.drone),
      badge: <PartnerStatusBadge status={setup.drone.partnerStatus} />,
    });
  }

  if (setup.luggage && isAdventureEquipmentItemFilled(setup.luggage)) {
    items.push({
      key: "luggage",
      icon: BriefcaseBusiness,
      title: "Luggage",
      value: getAdventureEquipmentDisplayName(setup.luggage),
      badge: <PartnerStatusBadge status={setup.luggage.partnerStatus} />,
    });
  }

  if (setup.navigationApp && isAdventureNavigationFilled(setup.navigationApp)) {
    items.push({
      key: "navigation",
      icon: MapPinned,
      title: "Navigation",
      value: getAdventureNavigationDisplayName(setup.navigationApp),
    });
  }

  if (setup.tires && isAdventureEquipmentItemFilled(setup.tires)) {
    items.push({
      key: "tires",
      icon: CircleDot,
      title: "Tires",
      value: getAdventureEquipmentDisplayName(setup.tires),
      badge: <PartnerStatusBadge status={setup.tires.partnerStatus} />,
    });
  }

  if (setup.offroadExperience) {
    items.push({
      key: "offroad",
      icon: Star,
      title: "Off-road Experience",
      value: `Offroad Experience ${setup.offroadExperience.level}/10`,
      detail: setup.offroadExperience.label,
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
        No ride setup added yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <EquipmentItemCard
          key={item.key}
          icon={item.icon}
          title={item.title}
          value={item.value}
          detail={item.detail}
          badge={item.badge}
          action={<div className="text-[10px] uppercase tracking-[0.18em] text-white/25">Setup</div>}
        />
      ))}
    </div>
  );
}
