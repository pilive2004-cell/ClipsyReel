"use client";

import CameraSelector from "@/components/adventure/CameraSelector";
import DroneSelector from "@/components/adventure/DroneSelector";
import HelmetSelector from "@/components/adventure/HelmetSelector";
import LuggageSelector from "@/components/adventure/LuggageSelector";
import MotorcycleSelector from "@/components/adventure/MotorcycleSelector";
import NavigationAppSelector from "@/components/adventure/NavigationAppSelector";
import OffroadExperienceSlider from "@/components/adventure/OffroadExperienceSlider";
import TireSelector from "@/components/adventure/TireSelector";
import { createEmptyAdventureSetup, isAdventureSetupEmpty } from "@/lib/adventure-setup";
import { AdventureSetup } from "@/types";

interface AdventureSetupFormProps {
  value: AdventureSetup;
  onChange: (next: AdventureSetup) => void;
}

export default function AdventureSetupForm({ value, onChange }: AdventureSetupFormProps) {
  const empty = isAdventureSetupEmpty(value);

  return (
    <div className="space-y-4 rounded-[30px] border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.03] to-transparent p-4 sm:p-5">
      <div className="space-y-2">
        <div>
          <h3 className="text-base font-semibold text-white/90">Tell us about your ride setup</h3>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            Help others discover what you used on this adventure. Added setup is integrated in the Reel and Adventure Report.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <MotorcycleSelector value={value.motorcycle} onChange={(motorcycle) => onChange({ ...value, motorcycle })} />
        <HelmetSelector value={value.helmet} onChange={(helmet) => onChange({ ...value, helmet })} />
        <CameraSelector value={value.camera} onChange={(camera) => onChange({ ...value, camera })} />
        <DroneSelector value={value.drone} onChange={(drone) => onChange({ ...value, drone })} />
        <LuggageSelector value={value.luggage} onChange={(luggage) => onChange({ ...value, luggage })} />
        <NavigationAppSelector value={value.navigationApp} onChange={(navigationApp) => onChange({ ...value, navigationApp })} />
        <TireSelector value={value.tires} onChange={(tires) => onChange({ ...value, tires })} />
        <OffroadExperienceSlider value={value.offroadExperience} onChange={(offroadExperience) => onChange({ ...value, offroadExperience })} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
        <p className="text-xs text-white/45">
          {empty ? "Skip anytime — Reel generation continues normally." : "Your setup will feed the Adventure Report and future community insights."}
        </p>
        {!empty ? (
          <button
            type="button"
            onClick={() => onChange(createEmptyAdventureSetup())}
            className="text-xs font-medium text-white/65 underline decoration-white/20 underline-offset-4 transition hover:text-white"
          >
            Clear setup
          </button>
        ) : null}
      </div>
    </div>
  );
}
