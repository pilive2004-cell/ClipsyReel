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
  durationSeconds: 1,
  title: "",
  titleStyle: null,
  hookText: "",
  overlayTexts: [],
  titleWindow: null,
  overlayWindows: [],
  transitionMarkers: [],
};

const RemotionRoot = () => {
  return (
    <Composition
      id={VIRAL_REMOTION_COMPOSITION_ID}
      component={ViralExportComposition}
      width={VIRAL_REMOTION_WIDTH}
      height={VIRAL_REMOTION_HEIGHT}
      fps={VIRAL_REMOTION_FPS}
      durationInFrames={VIRAL_REMOTION_FPS}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({
        fps: VIRAL_REMOTION_FPS,
        width: VIRAL_REMOTION_WIDTH,
        height: VIRAL_REMOTION_HEIGHT,
        durationInFrames: Math.max(1, Math.ceil(props.durationSeconds * VIRAL_REMOTION_FPS)),
        props,
      })}
    />
  );
};

registerRoot(RemotionRoot);

export default RemotionRoot;
