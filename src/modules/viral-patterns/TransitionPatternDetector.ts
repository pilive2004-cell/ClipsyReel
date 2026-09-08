/**
 * TransitionPatternDetector — MVP heuristic stub.
 *
 * Real transition classification would inspect the actual frames around
 * each cut (blur, whip motion, crossfade blending, object occlusion, etc.).
 * For the MVP this module maps the abstract `CutRhythmTimeline` events to a
 * plausible transition vocabulary and returns each as an abstract
 * `TransitionPattern` (never tied to any specific footage/content).
 */
import { CutRhythmTimeline, ShotType, TimelineEventType, TransitionPattern, TransitionType } from "./types";
import { hashSeed, makeSeededRandom } from "./internal/seed";

const EVENT_TO_TRANSITION: Record<TimelineEventType, TransitionType[]> = {
  hook: ["hard_cut_on_beat", "flash_cut"],
  fast_cut: ["whip_pan", "hard_cut_on_beat", "direct_cut"],
  wide_context: ["crossfade", "zoom_transition", "drone_like_reveal"],
  surprise_motion: ["speed_ramp", "flash_cut", "whip_pan"],
  breathing_shot: ["crossfade", "direct_cut"],
  build_up: ["match_on_action", "speed_ramp", "direct_cut"],
  climax: ["whip_pan", "flash_cut", "hard_cut_on_beat"],
  premium_end: ["loopable_end", "crossfade"],
};

const SHOT_HINTS: Record<TimelineEventType, [ShotType, ShotType]> = {
  hook: ["best_motion_or_landscape", "alternating_pov_and_landscape"],
  fast_cut: ["alternating_pov_and_landscape", "human_or_subject_action"],
  wide_context: ["wide_route_or_map", "breathing_wide_shot"],
  surprise_motion: ["human_or_subject_action", "highest_scoring_moment"],
  breathing_shot: ["breathing_wide_shot", "close_up_detail"],
  build_up: ["alternating_pov_and_landscape", "highest_scoring_moment"],
  climax: ["highest_scoring_moment", "human_or_subject_action"],
  premium_end: ["hero_shot_or_arrival", "breathing_wide_shot"],
};

export function detectTransitionPatterns(file: File, rhythm: CutRhythmTimeline): TransitionPattern[] {
  const rng = makeSeededRandom(hashSeed(`transitions:${file.name}:${file.size}`));

  return rhythm.events.slice(0, -1).map((event, i) => {
    const nextEvent = rhythm.events[i + 1];
    const options = EVENT_TO_TRANSITION[event.type];
    const transitionType = options[Math.floor(rng() * options.length)];
    const [before] = SHOT_HINTS[event.type];
    const [, after] = SHOT_HINTS[nextEvent.type];

    return {
      transitionType,
      idealBeforeShot: before,
      idealAfterShot: after,
      duration: Math.round((0.15 + rng() * 0.35) * 100) / 100,
      energyImpact: Math.round(nextEvent.energy - event.energy),
      recommendedUseCase: useCaseFor(transitionType),
    };
  });
}

function useCaseFor(type: TransitionType): string {
  switch (type) {
    case "whip_pan":
      return "Fast direction change between two dynamic shots";
    case "flash_cut":
      return "Punchy accent on a beat or surprise moment";
    case "speed_ramp":
      return "Building energy into a climax";
    case "crossfade":
      return "Calm, premium bridge between context shots";
    case "zoom_transition":
      return "Reveal or emphasis on a landscape/detail";
    case "match_on_action":
      return "Seamless continuity between two related actions";
    case "object_wipe":
      return "Playful transition using a foreground object";
    case "hard_cut_on_beat":
      return "Rhythmic cut synced to the music";
    case "map_transition":
      return "Bridging a route/map shot with real footage";
    case "drone_like_reveal":
      return "Establishing a spectacular environment";
    case "pov_transition":
      return "Switching into a first-person perspective";
    case "loopable_end":
      return "Premium ending that can loop back to the hook";
    case "direct_cut":
    default:
      return "Neutral, unobtrusive cut";
  }
}
