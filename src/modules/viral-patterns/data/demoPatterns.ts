/**
 * Manually authored demo patterns for the ViralPatternLibrary MVP.
 *
 * These are NOT copies of any real video. Each pattern is an abstract
 * editing recipe (rhythm, energy, transition vocabulary, emotional shape)
 * inspired by *generic, well-known viral editing conventions* — the same
 * kind of structural knowledge you'd find described in an editing tutorial.
 * No footage, audio, or brand content from any platform is stored here.
 */
import { EmotionalCurve, MontagePattern } from "../types";

/** Builds an emotional curve scaled to a reference duration, split into the
 * classic hook → orientation → build_up → surprise → climax → breathing →
 * premium_ending progression (some phases are optional per pattern). */
function curve(curveType: string, refDuration: number, shape: Array<[EmotionalCurve["segments"][number]["phase"], number, number]>): EmotionalCurve {
  return {
    curveType,
    segments: shape.map(([phase, startRatio, energy]) => ({
      phase,
      start: Math.round(startRatio * refDuration * 10) / 10,
      end: 0, // filled in below
      energy,
    })),
  } as EmotionalCurve;
}

/** Fills in each segment's `end` from the next segment's `start` (last segment ends at refDuration). */
function finalize(c: EmotionalCurve, refDuration: number): EmotionalCurve {
  const segments = c.segments.map((seg, i) => ({
    ...seg,
    end: i < c.segments.length - 1 ? c.segments[i + 1].start : refDuration,
  }));
  return { ...c, segments };
}

export const DEMO_PATTERNS: MontagePattern[] = [
  {
    id: "fast-adventure-hook",
    name: "Fast Adventure Hook",
    category: "Fast Adventure Hook",
    sourceType: "manual_demo",
    durationRange: [15, 30],
    idealVideoType: ["motorcycle", "offroad", "road_trip"],
    energyProfile: "extreme",
    cutRhythm: { fastCutRatio: 0.65, slowCutRatio: 0.05, hasAccelerationBeforeClimax: true },
    transitionStyle: ["hard_cut_on_beat", "whip_pan", "flash_cut", "speed_ramp"],
    hookStyle: { minHookScore: 80, preferredShot: "best_motion_or_landscape" },
    emotionalCurve: finalize(
      curve("Fast Adventure Hook", 22, [
        ["hook", 0, 95],
        ["build_up", 0.11, 80],
        ["surprise", 0.45, 90],
        ["climax", 0.64, 100],
        ["premium_ending", 0.86, 62],
      ]),
      22
    ),
    recommendedFor: ["Short high-energy clips", "GoPro/action-cam footage", "Strong single peak moment"],
    avoidWhen: ["Footage is mostly calm/static", "No clear standout highlight"],
    uniquenessScore: 78,
    premiumScore: 70,
  },
  {
    id: "cinematic-road-trip",
    name: "Cinematic Road Trip",
    category: "Cinematic Road Trip",
    sourceType: "manual_demo",
    durationRange: [30, 60],
    idealVideoType: ["road_trip", "travel", "city"],
    energyProfile: "balanced",
    cutRhythm: { fastCutRatio: 0.25, slowCutRatio: 0.35, hasAccelerationBeforeClimax: true },
    transitionStyle: ["crossfade", "match_on_action", "zoom_transition", "drone_like_reveal"],
    hookStyle: { minHookScore: 65, preferredShot: "wide_route_or_map" },
    emotionalCurve: finalize(
      curve("Cinematic Road Trip", 45, [
        ["hook", 0, 82],
        ["orientation", 0.09, 55],
        ["build_up", 0.2, 70],
        ["surprise", 0.51, 85],
        ["climax", 0.67, 96],
        ["breathing_moment", 0.8, 58],
        ["premium_ending", 0.91, 65],
      ]),
      45
    ),
    recommendedFor: ["Multi-location footage", "Longer narrative edits", "Landscape-heavy videos"],
    avoidWhen: ["Only a few seconds of usable footage", "No wide/establishing shots"],
    uniquenessScore: 74,
    premiumScore: 88,
  },
  {
    id: "motorcycle-pov-rush",
    name: "Motorcycle POV Rush",
    category: "Motorcycle POV Rush",
    sourceType: "manual_demo",
    durationRange: [15, 45],
    idealVideoType: ["motorcycle", "offroad"],
    energyProfile: "dynamic",
    cutRhythm: { fastCutRatio: 0.55, slowCutRatio: 0.1, hasAccelerationBeforeClimax: true },
    transitionStyle: ["speed_ramp", "pov_transition", "whip_pan", "hard_cut_on_beat"],
    hookStyle: { minHookScore: 75, preferredShot: "human_or_subject_action" },
    emotionalCurve: finalize(
      curve("Motorcycle POV Rush", 30, [
        ["hook", 0, 92],
        ["build_up", 0.13, 78],
        ["surprise", 0.4, 88],
        ["climax", 0.63, 100],
        ["premium_ending", 0.87, 66],
      ]),
      30
    ),
    recommendedFor: ["POV/helmet-cam clips", "Twisty roads or trails", "Alternating rider POV + bike shots"],
    avoidWhen: ["No POV angle available", "Very short single static clip"],
    uniquenessScore: 80,
    premiumScore: 76,
  },
  {
    id: "mountain-reveal",
    name: "Mountain Reveal",
    category: "Mountain Reveal",
    sourceType: "manual_demo",
    durationRange: [20, 45],
    idealVideoType: ["mountain", "drone", "offroad"],
    energyProfile: "balanced",
    cutRhythm: { fastCutRatio: 0.2, slowCutRatio: 0.4, hasAccelerationBeforeClimax: false },
    transitionStyle: ["drone_like_reveal", "crossfade", "zoom_transition"],
    hookStyle: { minHookScore: 70, preferredShot: "wide_route_or_map" },
    emotionalCurve: finalize(
      curve("Mountain Reveal", 32, [
        ["hook", 0, 85],
        ["orientation", 0.1, 50],
        ["build_up", 0.22, 68],
        ["surprise", 0.56, 92],
        ["climax", 0.72, 98],
        ["premium_ending", 0.9, 60],
      ]),
      32
    ),
    recommendedFor: ["Drone establishing shots", "Big landscape payoff moment", "Slow-build scenery"],
    avoidWhen: ["No drone/wide footage available", "Action-only footage with no scenery"],
    uniquenessScore: 72,
    premiumScore: 85,
  },
  {
    id: "before-after-journey",
    name: "Before / After Journey",
    category: "Before / After Journey",
    sourceType: "manual_demo",
    durationRange: [15, 30],
    idealVideoType: ["travel", "road_trip", "city"],
    energyProfile: "balanced",
    cutRhythm: { fastCutRatio: 0.3, slowCutRatio: 0.25, hasAccelerationBeforeClimax: true },
    transitionStyle: ["match_on_action", "object_wipe", "crossfade"],
    hookStyle: { minHookScore: 60, preferredShot: "close_up_detail" },
    emotionalCurve: finalize(
      curve("Before / After Journey", 20, [
        ["hook", 0, 78],
        ["orientation", 0.1, 52],
        ["build_up", 0.3, 74],
        ["climax", 0.65, 96],
        ["premium_ending", 0.85, 68],
      ]),
      20
    ),
    recommendedFor: ["Clear contrast moments", "Departure vs. arrival footage", "Transformation stories"],
    avoidWhen: ["Footage has no clear before/after contrast"],
    uniquenessScore: 68,
    premiumScore: 74,
  },
  {
    id: "calm-premium-travel",
    name: "Calm Premium Travel",
    category: "Calm Premium Travel",
    sourceType: "manual_demo",
    durationRange: [30, 60],
    idealVideoType: ["travel", "city", "mountain"],
    energyProfile: "calm",
    cutRhythm: { fastCutRatio: 0.08, slowCutRatio: 0.6, hasAccelerationBeforeClimax: false },
    transitionStyle: ["crossfade", "zoom_transition", "loopable_end"],
    hookStyle: { minHookScore: 55, preferredShot: "breathing_wide_shot" },
    emotionalCurve: finalize(
      curve("Calm Premium Travel", 45, [
        ["hook", 0, 68],
        ["orientation", 0.11, 48],
        ["build_up", 0.27, 58],
        ["climax", 0.62, 78],
        ["breathing_moment", 0.78, 45],
        ["premium_ending", 0.91, 55],
      ]),
      45
    ),
    recommendedFor: ["Slow, high-production footage", "Luxury/premium brand feel", "Minimal-cut aesthetics"],
    avoidWhen: ["Footage is shaky or low quality", "Content is action-heavy"],
    uniquenessScore: 66,
    premiumScore: 92,
  },
  {
    id: "high-energy-action",
    name: "High Energy Action",
    category: "High Energy Action",
    sourceType: "manual_demo",
    durationRange: [15, 30],
    idealVideoType: ["offroad", "motorcycle", "drone"],
    energyProfile: "extreme",
    cutRhythm: { fastCutRatio: 0.7, slowCutRatio: 0.03, hasAccelerationBeforeClimax: true },
    transitionStyle: ["flash_cut", "whip_pan", "speed_ramp", "hard_cut_on_beat"],
    hookStyle: { minHookScore: 85, preferredShot: "human_or_subject_action" },
    emotionalCurve: finalize(
      curve("High Energy Action", 20, [
        ["hook", 0, 98],
        ["build_up", 0.1, 85],
        ["surprise", 0.35, 92],
        ["climax", 0.55, 100],
        ["premium_ending", 0.85, 60],
      ]),
      20
    ),
    recommendedFor: ["Multiple strong action highlights", "Extreme sports style edits"],
    avoidWhen: ["Only one usable highlight", "Slow/calm footage"],
    uniquenessScore: 82,
    premiumScore: 72,
  },
  {
    id: "emotional-memory-reel",
    name: "Emotional Memory Reel",
    category: "Emotional Memory Reel",
    sourceType: "manual_demo",
    durationRange: [20, 45],
    idealVideoType: ["travel", "road_trip", "mountain"],
    energyProfile: "balanced",
    cutRhythm: { fastCutRatio: 0.15, slowCutRatio: 0.45, hasAccelerationBeforeClimax: false },
    transitionStyle: ["crossfade", "match_on_action", "loopable_end"],
    hookStyle: { minHookScore: 62, preferredShot: "human_or_subject_action" },
    emotionalCurve: finalize(
      curve("Emotional Memory Reel", 30, [
        ["hook", 0, 75],
        ["orientation", 0.13, 50],
        ["build_up", 0.3, 62],
        ["surprise", 0.55, 80],
        ["climax", 0.7, 90],
        ["breathing_moment", 0.83, 48],
        ["premium_ending", 0.93, 60],
      ]),
      30
    ),
    recommendedFor: ["People-focused footage", "Group trips", "Nostalgic/reflective tone"],
    avoidWhen: ["Footage has no human presence", "Very short clips only"],
    uniquenessScore: 70,
    premiumScore: 80,
  },
  {
    id: "map-to-real-footage",
    name: "Map To Real Footage",
    category: "Map To Real Footage",
    sourceType: "manual_demo",
    durationRange: [20, 45],
    idealVideoType: ["road_trip", "motorcycle", "travel"],
    energyProfile: "balanced",
    cutRhythm: { fastCutRatio: 0.3, slowCutRatio: 0.2, hasAccelerationBeforeClimax: true },
    transitionStyle: ["map_transition", "hard_cut_on_beat", "zoom_transition"],
    hookStyle: { minHookScore: 68, preferredShot: "wide_route_or_map" },
    emotionalCurve: finalize(
      curve("Map To Real Footage", 30, [
        ["hook", 0, 80],
        ["orientation", 0.1, 58],
        ["build_up", 0.25, 74],
        ["climax", 0.62, 96],
        ["premium_ending", 0.87, 64],
      ]),
      30
    ),
    recommendedFor: ["GPX/route data available", "Multi-stop journeys"],
    avoidWhen: ["No GPX or route context available"],
    uniquenessScore: 76,
    premiumScore: 78,
  },
  {
    id: "gear-showcase",
    name: "Gear Showcase",
    category: "Gear Showcase",
    sourceType: "manual_demo",
    durationRange: [15, 30],
    idealVideoType: ["motorcycle", "offroad", "drone"],
    energyProfile: "balanced",
    cutRhythm: { fastCutRatio: 0.35, slowCutRatio: 0.25, hasAccelerationBeforeClimax: false },
    transitionStyle: ["object_wipe", "zoom_transition", "crossfade"],
    hookStyle: { minHookScore: 60, preferredShot: "close_up_detail" },
    emotionalCurve: finalize(
      curve("Gear Showcase", 20, [
        ["hook", 0, 74],
        ["orientation", 0.12, 52],
        ["build_up", 0.3, 66],
        ["climax", 0.65, 88],
        ["premium_ending", 0.88, 58],
      ]),
      20
    ),
    recommendedFor: ["Equipment/setup close-ups", "Ride setup final card use cases"],
    avoidWhen: ["No equipment/detail shots available"],
    uniquenessScore: 64,
    premiumScore: 76,
  },
  {
    id: "route-recap",
    name: "Route Recap",
    category: "Route Recap",
    sourceType: "manual_demo",
    durationRange: [30, 60],
    idealVideoType: ["road_trip", "motorcycle", "travel"],
    energyProfile: "balanced",
    cutRhythm: { fastCutRatio: 0.28, slowCutRatio: 0.3, hasAccelerationBeforeClimax: true },
    transitionStyle: ["map_transition", "crossfade", "hard_cut_on_beat", "loopable_end"],
    hookStyle: { minHookScore: 65, preferredShot: "wide_route_or_map" },
    emotionalCurve: finalize(
      curve("Route Recap", 45, [
        ["hook", 0, 80],
        ["orientation", 0.09, 55],
        ["build_up", 0.24, 70],
        ["surprise", 0.53, 85],
        ["climax", 0.69, 95],
        ["breathing_moment", 0.82, 50],
        ["premium_ending", 0.93, 62],
      ]),
      45
    ),
    recommendedFor: ["Multi-day trips", "Several distinct highlights spread across the video"],
    avoidWhen: ["Single short clip with no variety"],
    uniquenessScore: 71,
    premiumScore: 82,
  },
  {
    id: "weekend-escape",
    name: "Weekend Escape",
    category: "Weekend Escape",
    sourceType: "manual_demo",
    durationRange: [15, 30],
    idealVideoType: ["travel", "city", "road_trip"],
    energyProfile: "dynamic",
    cutRhythm: { fastCutRatio: 0.45, slowCutRatio: 0.15, hasAccelerationBeforeClimax: true },
    transitionStyle: ["flash_cut", "crossfade", "hard_cut_on_beat"],
    hookStyle: { minHookScore: 70, preferredShot: "human_or_subject_action" },
    emotionalCurve: finalize(
      curve("Weekend Escape", 22, [
        ["hook", 0, 88],
        ["build_up", 0.14, 72],
        ["surprise", 0.45, 85],
        ["climax", 0.66, 96],
        ["premium_ending", 0.88, 64],
      ]),
      22
    ),
    recommendedFor: ["Short getaway footage", "Upbeat social-first content"],
    avoidWhen: ["Long-form multi-day content (use Route Recap instead)"],
    uniquenessScore: 73,
    premiumScore: 75,
  },
];
