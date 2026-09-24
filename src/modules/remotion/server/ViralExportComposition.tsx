import { AbsoluteFill, OffthreadVideo, Sequence } from "remotion";
import { ActionTitleCard } from "@/modules/remotion/overlays/ActionTitleCard";
import { ViralHookLowerThird } from "@/modules/remotion/graphics/ViralHookLowerThird";
import { ViralTransitionEngine } from "@/modules/remotion/transitions/ViralTransitionEngine";
import { VIRAL_REMOTION_FPS, type ViralRemotionCompositionProps } from "@/modules/remotion/render-contract";

const toFrames = (seconds: number) => Math.max(0, Math.round(seconds * VIRAL_REMOTION_FPS));

export function ViralExportComposition({
  baseVideoSrc,
  title,
  titleStyle,
  hookText,
  overlayTexts,
  titleWindow,
  overlayWindows = [],
  transitionMarkers = [],
}: ViralRemotionCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <OffthreadVideo
        src={baseVideoSrc}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {title?.trim() && titleWindow && titleWindow.end > titleWindow.start ? (
        <Sequence
          from={toFrames(titleWindow.start)}
          durationInFrames={Math.max(1, toFrames(titleWindow.end - titleWindow.start))}
        >
          <ActionTitleCard title={title.trim()} titleStyle={titleStyle} />
        </Sequence>
      ) : null}

      {overlayWindows.map((overlay, index) => {
        if (!overlay.text.trim() || overlay.end <= overlay.start) {
          return null;
        }

        return (
          <Sequence
            key={`${overlay.text}-${index}-${overlay.start}`}
            from={toFrames(overlay.start)}
            durationInFrames={Math.max(1, toFrames(overlay.end - overlay.start))}
          >
            <ViralHookLowerThird
              text={overlay.text.trim()}
              durationInFrames={Math.max(1, toFrames(overlay.end - overlay.start))}
            />
          </Sequence>
        );
      })}

      {transitionMarkers.map((marker, index) => {
        const durationInFrames = Math.max(1, marker.durationFrames ?? 18);
        const from = Math.max(0, toFrames(marker.atSeconds) - Math.floor(durationInFrames / 2));
        return (
          <Sequence
            key={`${marker.type}-${marker.direction}-${index}-${marker.atSeconds}`}
            from={from}
            durationInFrames={durationInFrames}
          >
            <ViralTransitionEngine type={marker.type} direction={marker.direction} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
