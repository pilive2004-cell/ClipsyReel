/**
 * Core domain types for ClipsyReel.
 *
 * IMPORTANT (future backend integration):
 * These types describe the shape of data that will eventually be produced by:
 * - A real video analysis pipeline (FFmpeg + scene detection + ML scoring)
 * - A real GPX parsing service (e.g. gpx-parser / togeojson on the backend)
 * - A real LLM call for hook/caption/hashtag generation
 * - Stripe subscription objects for plan/billing state
 *
 * For the MVP, all data conforming to these types is produced by
 * `src/data/mock.ts` instead of real processing.
 */

export type PlanId = "free" | "creator" | "business";

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // EUR / month, 0 for free
  tagline: string;
  features: string[];
  lockedFeatures?: string[];
  highlight?: boolean;
  badge?: string;
}

export type ReelStyle =
  | "viral"
  | "adventure"
  | "cinematic"
  | "travel"
  | "sport"
  | "luxury";

export interface StyleDefinition {
  id: ReelStyle;
  label: string;
  description: string;
  emoji: string;
  gradient: string; // tailwind gradient classes
  proOnly?: boolean;
}

export interface BestMoment {
  id: string;
  timestampLabel: string; // e.g. "00:12 - 00:18"
  startSeconds: number;
  endSeconds: number;
  confidence: number; // 0-100
  reason: string;
  /** Index into the uploaded videos array this moment was detected in (multi-video montages). */
  sourceIndex: number;
  /** 0-1 sub-scores that were weighted together to produce `confidence` — surfaced for debugging/transparency, not required by the UI. */
  scoreBreakdown?: {
    retention: number;
    motion: number;
    visualImpact: number;
    clarity: number;
    gpxContext: number;
    emotion: number;
    subjectFocus?: number;
    targetSubject?: number;
    /** 0-1, MobileNet scene-classifier boost for frames containing a recognizable landmark/scenic vista (castle, cliff, volcano, etc.). */
    landmark?: number;
  };
}

export interface HookVariant {
  id: string;
  text: string;
}

export interface CaptionVariant {
  id: string;
  text: string;
}

export type ReelTitleFont =
  | "cinematic"
  | "modern"
  | "classic"
  | "bold"
  | "minimal"
  | "handwritten"
  | "elegant"
  | "impact"
  | "mono"
  | "rounded";
export type ReelTitleSize = "sm" | "md" | "lg";
export type ReelTitleColor =
  | "white"
  | "gold"
  | "coral"
  | "cyan"
  | "lime"
  | "violet"
  | "pink"
  | "red"
  | "blue"
  | "emerald"
  | "peach"
  | "silver";

export interface MusicSuggestion {
  genre: string;
  mood: string;
  bpm: number;
  reference: string; // e.g. "Similar to: Lo-fi road trip beats"
}

export interface AnalysisStep {
  id: string;
  label: string;
  durationMs: number;
}

export interface ReelAnalysisResult {
  videoName: string;
  durationLabel: string;
  style: ReelStyle;
  overallScore: number; // 0-100 "virality" style score
  bestMoments: BestMoment[];
  emotionalStory: EmotionalStoryTimeline;
  hooks: HookVariant[];
  captions: CaptionVariant[];
  hashtags: string[];
  music: MusicSuggestion;
}

export type EmotionalStoryRole =
  | "opening-hook"
  | "context"
  | "journey"
  | "discovery"
  | "peak-moment"
  | "emotional-ending"
  | "thumbnail-moment";

export interface EmotionalStoryBeat {
  role: EmotionalStoryRole;
  intensity: number;
  targetEmotion: string;
  startSeconds: number;
  endSeconds: number;
  startTime: string;
  endTime: string;
  duration: number;
  sourceIndex?: number;
  momentId?: string;
}

export interface EmotionalStoryTimeline {
  openingHook: EmotionalStoryBeat;
  contextSection: EmotionalStoryBeat;
  journeySection: EmotionalStoryBeat;
  discoverySection: EmotionalStoryBeat;
  peakMoment: EmotionalStoryBeat;
  emotionalEnding: EmotionalStoryBeat;
  thumbnailMoment: EmotionalStoryBeat | null;
  emotionalCurve: EmotionalStoryBeat[];
  reelScore: number;
}

/** A single parsed GPX track point (real lat/lng, via `leaflet-gpx`). */
export interface GpxTrackPoint {
  lat: number;
  lng: number;
  ele: number | null;
  time: Date | null;
}

/** Real route statistics computed from the parsed GPX track (see `src/lib/gpx.ts`). */
export interface GpxRouteStats {
  distanceKm: number;
  durationLabel: string;
  elevationGainM: number;
  highestPointM: number | null;
}

export interface SportTelemetry {
  distanceKm: number;
  durationLabel: string;
  elevationGainM: number;
  highestPointM: number | null;
  maxSpeedKmh: number | null;
}

export type AdventureEquipmentCategory = "motorcycle" | "helmet" | "camera" | "drone" | "luggage" | "tires";

export type PartnerStatus = "standard" | "verified_partner" | "featured_partner";

export interface AdventureVisibility {
  visibleInReel: boolean;
  visibleInReport: boolean;
}

export interface AdventureEquipmentItem extends AdventureVisibility {
  category: AdventureEquipmentCategory;
  brand: string;
  model: string;
  customInput: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  affiliateUrl: string | null;
  partnerStatus: PartnerStatus;
  userRecommendation: string;
  rating: number | null;
  usageCount: number | null;
}

export interface AdventureNavigationApp extends AdventureVisibility {
  category: "navigation";
  name: string;
  customName: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  affiliateUrl: string | null;
  partnerStatus: PartnerStatus;
  userRecommendation: string;
  rating: number | null;
  usageCount: number | null;
}

export interface OffroadExperience extends AdventureVisibility {
  level: number;
  label: string;
}

export interface AdventureSetup {
  motorcycle: AdventureEquipmentItem | null;
  helmet: AdventureEquipmentItem | null;
  camera: AdventureEquipmentItem | null;
  drone: AdventureEquipmentItem | null;
  luggage: AdventureEquipmentItem | null;
  navigationApp: AdventureNavigationApp | null;
  tires: AdventureEquipmentItem | null;
  offroadExperience: OffroadExperience | null;
}

export interface AdventureCatalogOption {
  brand: string;
  models: string[];
  logoUrl?: string | null;
  websiteUrl?: string | null;
  affiliateUrl?: string | null;
  partnerStatus?: PartnerStatus;
  usageCount?: number | null;
  rating?: number | null;
}

export interface AdventureCommunityInsight {
  title: string;
  items: string[];
}

export interface AdventureReportData {
  routeTitle: string;
  distanceLabel: string | null;
  elevationLabel: string | null;
  highestPointLabel: string | null;
  countriesOrRegion: string | null;
  bestMomentLabel: string;
  thumbnailLabel: string;
  rideScore: number | null;
  suggestedCaption: string;
  suggestedHashtags: string[];
  setup: AdventureSetup;
  routePoints: { lat: number; lng: number }[] | null;
}

export interface AdventureReelOverlay {
  title: string;
  lines: string[];
}

export interface AdventureSetupDraftRecord {
  sessionKey: string;
  routeLabel: string | null;
  videoFingerprints: string[];
  setup: AdventureSetup;
  updatedAt: string;
}

/**
 * A labelled city, town, village or landmark positioned along the GPX route.
 *
 * Pre-filled automatically by `detectRouteLabels()` (see `src/lib/route-service.ts`)
 * and then editable by the user before the map intro is rendered.
 *
 * `progress` is normalised 0–1 along the route arc-length, used to:
 *   - Sort labels from start to end
 *   - Reveal labels progressively during the animation
 *   - Trigger the dynamic zoom-in when the drawing head is nearby
 */
export interface RouteLabel {
  name: string;
  lat: number;
  lng: number;
   region?: string | null;
   country?: string | null;
   verified?: boolean;
  /** Normalised arc-length position along the route (0 = start, 1 = end). */
  progress: number;
  /** "major" = city / town / borough — displayed larger; "minor" = village / hamlet. */
  priority: "major" | "minor";
  isStart?: boolean;
  isEnd?: boolean;
}

/** GPS coordinates embedded in the video container metadata, when present. */
export interface VideoGpsMetadata {
  lat: number;
  lng: number;
}

/** Width/height decoded from the video stream metadata. */
export interface VideoResolution {
  width: number;
  height: number;
}

/**
 * Real metadata extracted from the uploaded video file.
 *
 * IMPORTANT:
 * - We only auto-place a video on the GPX route when genuine embedded GPS is
 *   present *and* it falls close enough to the route/bounds.
 * - Creation date / duration / resolution are useful diagnostics, but are not
 *   trustworthy enough on their own to infer a route position.
 * - When extraction fails or GPS is absent, the UI must surface that honestly
 *   instead of faking a route placement.
 */
export interface VideoGeoMetadata {
  videoId: string;
  name: string;
  /** Real GPS coordinates read from QuickTime/MP4 metadata atoms, when present. */
  gps: VideoGpsMetadata | null;
  /** Real embedded creation date, when present. */
  capturedAt: Date | null;
  /** Camera model / device model from metadata, when present. */
  cameraModel: string | null;
  /** Stream duration decoded by the browser. */
  durationSeconds: number | null;
  /** Stream resolution decoded by the browser. */
  resolution: VideoResolution | null;
  /** Human-readable technical reason when GPS/metadata could not be read. */
  technicalReason: string | null;
  /** Where the metadata came from, for debugging and UI honesty. */
  metadataSource: "quicktime" | "html-video" | "none";
}

export type VideoMatchStatus = "gps" | "mismatch" | "unknown";

/** Result of matching one uploaded video to a point on the GPX route (see `src/lib/video-location-matcher.ts`). */
export interface VideoRouteMatch {
  videoId: string;
  name: string;
  status: VideoMatchStatus;
  point: GpxTrackPoint | null;
  reason: string;
  metadata: VideoGeoMetadata;
}

// ─── Smart Video Location Matcher ────────────────────────────────────────────

/** Detection level for a given video (1 = GPS found, 2 = timestamp matched, 3 = no metadata). */
export type VideoLocationLevel = 1 | 2 | 3;

/** Richer status labels used in the Smart Video Location Matcher UI. */
export type VideoLocationStatus =
  | "gps_detected"
  | "timestamp_detected"
  | "metadata_missing"
  | "manually_placed";

/** Confidence label for Smart Video Location Matcher. */
export type VideoLocationConfidence = "High" | "Medium" | "Low" | "Manual";

/** A user-provided manual location for a Level-3 video (no GPS/timestamp found). */
export interface ManualLocation {
  id: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  optionalTimestamp: string;
  note: string;
}

/** Full result of the Smart Video Location Matcher for one video. */
export interface VideoLocationMatch {
  videoId: string;
  fileName: string;
  detectionLevel: VideoLocationLevel;
  status: VideoLocationStatus;
  confidence: VideoLocationConfidence;
  gpsCoordinates: { lat: number; lng: number } | null;
  creationTimestamp: Date | null;
  matchedGPXPoint: GpxTrackPoint | null;
  /** User-provided manual locations (Level 3 only, or when user wants to add extra context). */
  manualLocations: ManualLocation[];
  message: string;
}

export type AppStep = "upload" | "style" | "analyze" | "render" | "preview";

export interface ExportSettings {
  quality: "720p" | "1080p" | "4K";
  watermark: boolean;
  keepOriginalAudio?: boolean;
}

/** A single uploaded source clip (up to 3 can be combined into one montage). */
export interface UploadedVideo {
  name: string;
  sizeMb: number;
  previewUrl: string;
  file: File;
  durationSeconds: number;
  metadata: VideoGeoMetadata;
  keepAudio: boolean;
}

/** Result of a real, in-browser ffmpeg.wasm montage render (see `src/lib/video-engine.ts`). */
export interface MontageResult {
  url: string;
  blob: Blob;
  durationSeconds: number;
  clipCount: number;
  /** Creative Style Engine effects actually burned into this render. */
  appliedEffects: string[];
  /** Effects the style wanted but were stripped because the render wasn't on a Pro plan. */
  proLockedEffects: string[];
  /** The Editing Pattern (structural template) chosen for this render — see `src/data/editingPatterns.ts`. */
  editingPattern: { name: string; description: string };
}
