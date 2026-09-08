import type { Rule } from "../types";
import { recalculateTimeline } from "../timeline-helpers";

export const DEFAULT_CAMERA_ANGLE_LOOKAHEAD = 5;

function matchesCameraSetup(a: { cameraAngle: string | null; sourceType: string | null }, b: { cameraAngle: string | null; sourceType: string | null }): boolean {
  const sameAngle = !!a.cameraAngle && a.cameraAngle === b.cameraAngle;
  const sameSourceType = !!a.sourceType && a.sourceType === b.sourceType;
  return sameAngle || sameSourceType;
}

/**
 * Alternates view perspective where metadata exists so the edit feels more
 * intentionally constructed than a run of identical POVs.
 */
export function createAlternateCameraAnglesRule(lookahead = DEFAULT_CAMERA_ANGLE_LOOKAHEAD): Rule {
  return {
    id: "alternate-camera-angles",
    description: "Alternates clip angle/source metadata when possible.",
    apply(context) {
      const clips = [...context.timeline.clips];
      let changed = false;
      for (let index = 1; index < clips.length; index++) {
        const previous = clips[index - 1];
        const current = clips[index];
        if (!matchesCameraSetup(previous, current)) continue;
        for (let candidateIndex = index + 1; candidateIndex < Math.min(clips.length, index + 1 + lookahead); candidateIndex++) {
          if (!matchesCameraSetup(previous, clips[candidateIndex])) {
            [clips[index], clips[candidateIndex]] = [clips[candidateIndex], clips[index]];
            changed = true;
            break;
          }
        }
      }
      if (!changed) return context;
      return {
        ...context,
        timeline: recalculateTimeline({ ...context.timeline, clips }),
        notes: [...context.notes, "Rule applied: alternated camera angles."],
      };
    },
  };
}

export const alternateCameraAnglesRule = createAlternateCameraAnglesRule();
