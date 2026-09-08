import { TransitionContext } from "@/transitions/transition.types";
import { CameraMode } from "@/camera/CameraModes";
import { VisualStyleId } from "@/types/style.types";

/** Shared factory so each test only has to override the signals it actually cares about. */
export function makeContext(overrides: Partial<TransitionContext> & { selectedStyle: VisualStyleId }): TransitionContext {
  return {
    speedKmh: 40,
    gradientPercent: 3,
    elevationChange: 20,
    turnSharpness: 0.3,
    terrainDrama: 0.3,
    cameraMode: "wideEstablishing" as CameraMode,
    musicBeatStrength: 0.2,
    previousTransitionId: null,
    isScenicMoment: false,
    isActionMoment: false,
    performanceProfile: "high",
    ...overrides,
  };
}
