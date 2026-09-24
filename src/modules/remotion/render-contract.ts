import type { ReelTitleColor, ReelTitleFont, ReelTitleSize } from "@/types";
import type { RemotionTransitionType } from "@/modules/remotion/utils/TransitionSelector";

export const VIRAL_REMOTION_COMPOSITION_ID = "ViralExportComposition";
export const VIRAL_REMOTION_FPS = 30;
export const VIRAL_REMOTION_WIDTH = 1080;
export const VIRAL_REMOTION_HEIGHT = 1920;

export interface RemotionTitleWindow {
  start: number;
  end: number;
}

export interface RemotionOverlayWindow {
  text: string;
  start: number;
  end: number;
}

export interface ViralRemotionTransitionMarker {
  atSeconds: number;
  type: RemotionTransitionType;
  direction: "left" | "right" | "up" | "down";
  durationFrames?: number;
}

export interface ViralRemotionTitleStyle {
  font: ReelTitleFont;
  size: ReelTitleSize;
  color: ReelTitleColor;
}

export interface ViralRemotionCompositionProps extends Record<string, unknown> {
  baseVideoSrc: string;
  durationSeconds: number;
  title?: string;
  titleStyle?: ViralRemotionTitleStyle | null;
  hookText?: string;
  overlayTexts?: string[];
  titleWindow?: RemotionTitleWindow | null;
  overlayWindows?: RemotionOverlayWindow[];
  transitionMarkers?: ViralRemotionTransitionMarker[];
}

export interface ViralRemotionRenderProps extends Record<string, unknown> {
  durationSeconds: number;
  title?: string;
  titleStyle?: ViralRemotionTitleStyle | null;
  hookText?: string;
  overlayTexts?: string[];
  titleWindow?: RemotionTitleWindow | null;
  overlayWindows?: RemotionOverlayWindow[];
  transitionMarkers?: ViralRemotionTransitionMarker[];
}
