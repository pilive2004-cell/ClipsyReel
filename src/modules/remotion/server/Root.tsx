import { Composition, registerRoot } from "remotion";
import {
  VIRAL_REMOTION_COMPOSITION_ID,
  VIRAL_REMOTION_FPS,
  VIRAL_REMOTION_HEIGHT,
  VIRAL_REMOTION_WIDTH,
  type ViralRemotionCompositionProps,
} from "@/modules/remotion/render-contract";
import { ViralExportComposition } from "@/modules/remotion/server/ViralExportComposition";

const defaultProps: ViralRemotionCompositionProps = {
  baseVideoSrc: "",
  durationSeconds: 30,
  width: VIRAL_REMOTION_WIDTH,
  height: VIRAL_REMOTION_HEIGHT,
  title: "",
  titleStyle: null,
  hookText: "",
  overlayTexts: [],
  titleWindow: null,
  overlayWindows: [],
  transitionMarkers: [],
};

const RemotionRoot = () => {
  const defaultDurationFrames = Math.max(1, Math.ceil(defaultProps.durationSeconds * VIRAL_REMOTION_FPS));

  return (
    <Composition
      id={VIRAL_REMOTION_COMPOSITION_ID}
      component={ViralExportComposition}
      width={VIRAL_REMOTION_WIDTH}
      height={VIRAL_REMOTION_HEIGHT}
      fps={VIRAL_REMOTION_FPS}
      durationInFrames={defaultDurationFrames}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => {
        const nextDurationFrames = Math.max(1, Math.ceil((Number(props.durationSeconds) || defaultProps.durationSeconds) * VIRAL_REMOTION_FPS));
        const nextWidth = Math.max(1, Math.round(Number(props.width) || defaultProps.width || VIRAL_REMOTION_WIDTH));
        const nextHeight = Math.max(1, Math.round(Number(props.height) || defaultProps.height || VIRAL_REMOTION_HEIGHT));
        return {
          fps: VIRAL_REMOTION_FPS,
          width: nextWidth,
          height: nextHeight,
          durationInFrames: nextDurationFrames,
          props,
        };
      }}
    />
  );
};

registerRoot(RemotionRoot);

export default RemotionRoot;
