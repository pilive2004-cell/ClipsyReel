import type { EditingProfile, EditingProfileId } from "../types";
import adventure from "./adventure.json";
import cinematic from "./cinematic.json";
import luxury from "./luxury.json";
import sport from "./sport.json";
import travel from "./travel.json";
import viral from "./viral.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumberTuple(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((entry) => typeof entry === "number");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function validateEditingProfile(profile: unknown): EditingProfile {
  if (!isRecord(profile)) throw new Error("Editing profile must be an object.");
  const { id, label, pacing, transitions, cameraSelection, clipDuration, overlays, colorGrading, musicSync, storytellingStyle } = profile;
  if (typeof id !== "string" || typeof label !== "string") throw new Error("Editing profile must declare string id and label.");
  if (!isRecord(pacing) || !isNumberTuple(pacing.calmIntervalSeconds) || typeof pacing.averageClipSeconds !== "number" || typeof pacing.minClipSeconds !== "number" || typeof pacing.maxClipSeconds !== "number" || typeof pacing.curve !== "string") {
    throw new Error(`Editing profile "${id}" has invalid pacing settings.`);
  }
  if (!isRecord(transitions) || !isStringArray(transitions.preferred) || typeof transitions.avoidRepeats !== "boolean" || typeof transitions.mode !== "string" || typeof transitions.beatAligned !== "boolean") {
    throw new Error(`Editing profile "${id}" has invalid transition settings.`);
  }
  if (!isRecord(cameraSelection) || !isStringArray(cameraSelection.preferredAngles) || !isStringArray(cameraSelection.preferredSources) || typeof cameraSelection.alternateAngles !== "boolean" || typeof cameraSelection.prioritizeLandscape !== "boolean" || typeof cameraSelection.prioritizeAction !== "boolean") {
    throw new Error(`Editing profile "${id}" has invalid camera selection settings.`);
  }
  if (!isRecord(clipDuration) || typeof clipDuration.hookSeconds !== "number" || typeof clipDuration.standardSeconds !== "number" || typeof clipDuration.buildUpSeconds !== "number" || typeof clipDuration.climaxSeconds !== "number" || typeof clipDuration.breathingSeconds !== "number" || typeof clipDuration.endingSeconds !== "number" || typeof clipDuration.slowMotionRate !== "number" || typeof clipDuration.accelerationRate !== "number") {
    throw new Error(`Editing profile "${id}" has invalid clip duration settings.`);
  }
  if (!isRecord(overlays) || typeof overlays.map !== "boolean" || typeof overlays.speed !== "boolean" || typeof overlays.altitude !== "boolean" || typeof overlays.location !== "boolean" || typeof overlays.text !== "boolean") {
    throw new Error(`Editing profile "${id}" has invalid overlay settings.`);
  }
  if (!isRecord(colorGrading) || typeof colorGrading.profile !== "string" || typeof colorGrading.saturation !== "number" || typeof colorGrading.contrast !== "number" || typeof colorGrading.temperature !== "number" || typeof colorGrading.shadows !== "number" || typeof colorGrading.highlights !== "number") {
    throw new Error(`Editing profile "${id}" has invalid color grading settings.`);
  }
  if (!isRecord(musicSync) || !isNumberTuple(musicSync.preferredBpmRange) || typeof musicSync.mode !== "string" || typeof musicSync.cutNudgeSeconds !== "number" || typeof musicSync.emphasizeDrops !== "boolean") {
    throw new Error(`Editing profile "${id}" has invalid music sync settings.`);
  }
  if (!isRecord(storytellingStyle) || typeof storytellingStyle.arc !== "string" || typeof storytellingStyle.openingStrategy !== "string" || typeof storytellingStyle.climaxStrategy !== "string" || typeof storytellingStyle.endingStrategy !== "string" || typeof storytellingStyle.breathingMomentRequired !== "boolean" || typeof storytellingStyle.prioritizeEmotion !== "boolean" || typeof storytellingStyle.prioritizeLandscape !== "boolean") {
    throw new Error(`Editing profile "${id}" has invalid storytelling style settings.`);
  }
  return profile as unknown as EditingProfile;
}

const PROFILE_REGISTRY: Record<EditingProfileId, EditingProfile> = {
  viral: validateEditingProfile(viral),
  adventure: validateEditingProfile(adventure),
  cinematic: validateEditingProfile(cinematic),
  travel: validateEditingProfile(travel),
  sport: validateEditingProfile(sport),
  luxury: validateEditingProfile(luxury),
};

export const EDITING_PROFILE_IDS = Object.keys(PROFILE_REGISTRY) as EditingProfileId[];

export function loadEditingProfile(id: string): EditingProfile {
  if (!(id in PROFILE_REGISTRY)) {
    throw new Error(`Unknown editing profile \"${id}\". Expected one of: ${EDITING_PROFILE_IDS.join(", ")}.`);
  }
  const profile = PROFILE_REGISTRY[id as EditingProfileId];
  if (profile.id !== id) {
    throw new Error(`Editing profile \"${id}\" is misconfigured: embedded id is \"${profile.id}\".`);
  }
  return profile;
}
