"use client";

import { Player } from "@remotion/player";
import { SportTemplate } from "@/modules/remotion/templates/SportTemplate";
import { ViralTemplate } from "@/modules/remotion/templates/ViralTemplate";
import { BestMoment, ReelStyle, ViralCreativeMetadata } from "@/types";

const SHOW_REMOTION_DEBUG_PREVIEW = process.env.NEXT_PUBLIC_SHOW_REMOTION_DEBUG_PREVIEW === "true";

interface RemotionPreviewProps {
  moments: BestMoment[];
  style: ReelStyle;
  title?: string;
  hookText?: string;
  creativeMetadata?: ViralCreativeMetadata | null;
}

export function RemotionPreview({ moments, style, title, hookText, creativeMetadata }: RemotionPreviewProps) {
  if (!SHOW_REMOTION_DEBUG_PREVIEW || !moments.length || (style !== "sport" && style !== "viral")) {
    return null;
  }

  const component = style === "viral" ? ViralTemplate : SportTemplate;
  const label = style === "viral" ? "Viral template" : "Sport template";
  const frameCount = style === "viral" ? 150 : 120;

  return (
    <div className="w-full rounded-2xl border border-fuchsia-500/25 bg-slate-950/75 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.2)] backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-fuchsia-200/80">
        <span>Remotion</span>
        <span>{label}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
        <Player
          component={component}
          acknowledgeRemotionLicense
          inputProps={{
            moments: moments.slice(0, style === "viral" ? 6 : 4),
            title,
            hookText,
            creativitySettings: creativeMetadata
              ? {
                  renderCreativityLevel: creativeMetadata.renderCreativityLevel,
                  viralStyleDNA: creativeMetadata.viralStyleDNA,
                  editingSeed: creativeMetadata.editingSeed,
                  generateVersions: creativeMetadata.generateVersions,
                }
              : undefined,
          }}
          durationInFrames={frameCount}
          fps={30}
          compositionWidth={1080}
          compositionHeight={1920}
          style={{ width: "100%", aspectRatio: "9 / 16" }}
          loop
          controls={false}
        />
      </div>

      <div className="mt-2 text-[10px] text-white/55">
        {title || (style === "viral" ? "Dynamic viral cut" : "Dynamic sports cut")} • {hookText || "Live Remotion composition preview"}
        {creativeMetadata && style === "viral" ? ` • seed ${creativeMetadata.editingSeed}` : ""}
      </div>
    </div>
  );
}
