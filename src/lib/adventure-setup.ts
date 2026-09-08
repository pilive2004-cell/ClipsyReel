import { OFFROAD_EXPERIENCE_LABELS } from "@/data/adventure-gear";
import {
  AdventureCommunityInsight,
  AdventureEquipmentCategory,
  AdventureEquipmentItem,
  AdventureNavigationApp,
  AdventureReelOverlay,
  AdventureReportData,
  AdventureSetup,
  GpxRouteStats,
  OffroadExperience,
  PartnerStatus,
  ReelAnalysisResult,
  UploadedVideo,
} from "@/types";

const DEFAULT_VISIBILITY = {
  visibleInReel: true,
  visibleInReport: true,
} as const;

export function createAdventureEquipmentItem(category: AdventureEquipmentCategory): AdventureEquipmentItem {
  return {
    category,
    brand: "",
    model: "",
    customInput: "",
    logoUrl: null,
    websiteUrl: null,
    affiliateUrl: null,
    partnerStatus: "standard",
    userRecommendation: "",
    rating: null,
    usageCount: null,
    ...DEFAULT_VISIBILITY,
  };
}

export function createAdventureNavigationApp(): AdventureNavigationApp {
  return {
    category: "navigation",
    name: "",
    customName: "",
    logoUrl: null,
    websiteUrl: null,
    affiliateUrl: null,
    partnerStatus: "standard",
    userRecommendation: "",
    rating: null,
    usageCount: null,
    ...DEFAULT_VISIBILITY,
  };
}

export function createOffroadExperience(level = 0): OffroadExperience {
  return {
    level,
    label: getOffroadExperienceLabel(level),
    ...DEFAULT_VISIBILITY,
  };
}

export function createEmptyAdventureSetup(): AdventureSetup {
  return {
    motorcycle: null,
    helmet: null,
    camera: null,
    drone: null,
    luggage: null,
    navigationApp: null,
    tires: null,
    offroadExperience: null,
  };
}

export function getOffroadExperienceLabel(level: number) {
  const sorted = [...OFFROAD_EXPERIENCE_LABELS].sort((a, b) => a.level - b.level);
  let current = sorted[0].label;
  for (const entry of sorted) {
    if (level >= entry.level) {
      current = entry.label;
    }
  }
  return current;
}

export function isAdventureEquipmentItemFilled(item: AdventureEquipmentItem | null) {
  return !!item && !![item.brand, item.model, item.customInput].find((value) => value.trim().length > 0);
}

export function isAdventureNavigationFilled(item: AdventureNavigationApp | null) {
  return !!item && !![item.name, item.customName].find((value) => value.trim().length > 0);
}

export function isAdventureSetupEmpty(setup: AdventureSetup) {
  return !(
    isAdventureEquipmentItemFilled(setup.motorcycle) ||
    isAdventureEquipmentItemFilled(setup.helmet) ||
    isAdventureEquipmentItemFilled(setup.camera) ||
    isAdventureEquipmentItemFilled(setup.drone) ||
    isAdventureEquipmentItemFilled(setup.luggage) ||
    isAdventureNavigationFilled(setup.navigationApp) ||
    isAdventureEquipmentItemFilled(setup.tires) ||
    (setup.offroadExperience && setup.offroadExperience.level > 0)
  );
}

export function getAdventureEquipmentDisplayName(item: AdventureEquipmentItem | null) {
  if (!item) return "";
  const primary = [item.brand, item.model].filter(Boolean).join(" ").trim();
  return primary || item.customInput.trim();
}

export function getAdventureNavigationDisplayName(item: AdventureNavigationApp | null) {
  if (!item) return "";
  return item.name === "Other" ? item.customName.trim() : item.name.trim() || item.customName.trim();
}

export function getPartnerStatusLabel(status: PartnerStatus) {
  switch (status) {
    case "verified_partner":
      return "Verified equipment";
    case "featured_partner":
      return "Featured equipment";
    default:
      return "Standard equipment";
  }
}

export function buildAdventureReportData({
  routeLabel,
  gpxStats,
  analysis,
  selectedCaptionText,
  hashtags,
  setup,
  routePoints,
}: {
  routeLabel: string | null;
  gpxStats: GpxRouteStats | null;
  analysis: ReelAnalysisResult | null;
  selectedCaptionText: string;
  hashtags: string[];
  setup: AdventureSetup;
  routePoints: { lat: number; lng: number }[] | null;
}): AdventureReportData {
  return {
    routeTitle: routeLabel ?? "Adventure route",
    distanceLabel: gpxStats ? `${Math.round(gpxStats.distanceKm)} km` : null,
    elevationLabel: gpxStats ? `+${Math.round(gpxStats.elevationGainM)} m` : null,
    highestPointLabel: gpxStats?.highestPointM ? `${Math.round(gpxStats.highestPointM)} m` : null,
    countriesOrRegion: inferRegionFromRouteLabel(routeLabel),
    bestMomentLabel: getBestMomentLabel(analysis),
    thumbnailLabel: getThumbnailLabel(analysis),
    rideScore: analysis?.emotionalStory.reelScore ?? analysis?.overallScore ?? null,
    suggestedCaption: selectedCaptionText.trim(),
    suggestedHashtags: hashtags,
    setup,
    routePoints,
  };
}

export function buildCommunityInsightsPreview(setup: AdventureSetup): AdventureCommunityInsight[] {
  const motorcycle = getAdventureEquipmentDisplayName(setup.motorcycle);
  const helmet = getAdventureEquipmentDisplayName(setup.helmet);
  const navigation = getAdventureNavigationDisplayName(setup.navigationApp);
  const tires = getAdventureEquipmentDisplayName(setup.tires);

  return [
    {
      title: "Most used motorcycles",
      items: [motorcycle || "BMW R1300GS", "KTM 1290 Super Adventure", "Honda Africa Twin"],
    },
    {
      title: "Most used helmets",
      items: [helmet || "Shoei Neotec 3", "Schuberth C5", "Arai Tour-X5"],
    },
    {
      title: "Most used navigation apps",
      items: [navigation || "Kurviger", "Calimoto", "Garmin Explore"],
    },
    {
      title: "Most used tires",
      items: [tires || "Michelin Anakee Adventure", "Metzeler Karoo 4", "Continental TKC 70"],
    },
  ];
}

export function buildAdventureReelOverlay(setup: AdventureSetup): AdventureReelOverlay | null {
  // Same small emoji markers used in the in-app Adventure Card mini-preview
  // (see AdventureCardPreview.tsx) so the baked-in video end card matches it.
  const lines = [
    setup.motorcycle && isAdventureEquipmentItemFilled(setup.motorcycle) ? `🏍 ${getAdventureEquipmentDisplayName(setup.motorcycle)}` : null,
    setup.helmet && isAdventureEquipmentItemFilled(setup.helmet) ? `🪖 ${getAdventureEquipmentDisplayName(setup.helmet)}` : null,
    setup.camera && isAdventureEquipmentItemFilled(setup.camera) ? `📷 ${getAdventureEquipmentDisplayName(setup.camera)}` : null,
    setup.drone && isAdventureEquipmentItemFilled(setup.drone) ? `🚁 ${getAdventureEquipmentDisplayName(setup.drone)}` : null,
    setup.luggage && isAdventureEquipmentItemFilled(setup.luggage) ? `🎒 ${getAdventureEquipmentDisplayName(setup.luggage)}` : null,
    setup.navigationApp && isAdventureNavigationFilled(setup.navigationApp) ? `🗺 ${getAdventureNavigationDisplayName(setup.navigationApp)}` : null,
    setup.tires && isAdventureEquipmentItemFilled(setup.tires) ? `🛞 ${getAdventureEquipmentDisplayName(setup.tires)}` : null,
    setup.offroadExperience ? `★ Offroad Experience ${setup.offroadExperience.level}/10` : null,
  ].filter((item): item is string => !!item).slice(0, 4);

  if (lines.length === 0) return null;
  return { title: "My Adventure Gear", lines };
}

export function buildAdventureSetupSessionKey(videos: UploadedVideo[]) {
  if (videos.length === 0) return "";
  return videos.map((video) => `${video.name}:${Math.round(video.sizeMb * 100)}:${Math.round(video.durationSeconds * 10)}`).join("|");
}

function inferRegionFromRouteLabel(routeLabel: string | null) {
  if (!routeLabel) return null;
  if (routeLabel.includes("→")) return routeLabel;
  const normalized = routeLabel.replace(/\s+/g, " ").trim();
  if (/ to /i.test(normalized)) {
    const [from, to] = normalized.split(/ to /i);
    return `${titleCase(from)} → ${titleCase(to)}`;
  }
  return titleCase(normalized);
}

function getBestMomentLabel(analysis: ReelAnalysisResult | null) {
  const peak = analysis?.emotionalStory.peakMoment;
  if (peak) return `${peak.startTime} - ${peak.endTime} · ${peak.targetEmotion}`;
  const moment = analysis?.bestMoments[0];
  return moment ? `${moment.timestampLabel} · ${moment.reason}` : "Best moment available after analysis";
}

function getThumbnailLabel(analysis: ReelAnalysisResult | null) {
  const thumbnail = analysis?.emotionalStory.thumbnailMoment;
  if (thumbnail) return `${thumbnail.startTime} - ${thumbnail.endTime} · ${thumbnail.targetEmotion}`;
  const opening = analysis?.emotionalStory.openingHook;
  return opening ? `${opening.startTime} - ${opening.endTime} · ${opening.targetEmotion}` : "Thumbnail suggestion available after analysis";
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
