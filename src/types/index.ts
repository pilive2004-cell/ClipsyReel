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
}

export interface HookVariant {
  id: string;
  text: string;
}

export interface CaptionVariant {
  id: string;
  text: string;
}

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
  hooks: HookVariant[];
  captions: CaptionVariant[];
  hashtags: string[];
  music: MusicSuggestion;
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

export type AppStep = "upload" | "style" | "analyze" | "render" | "preview";

export interface ExportSettings {
  quality: "720p" | "1080p" | "4K";
  watermark: boolean;
}

/** A single uploaded source clip (up to 3 can be combined into one montage). */
export interface UploadedVideo {
  name: string;
  sizeMb: number;
  previewUrl: string;
  file: File;
  durationSeconds: number;
  metadata: VideoGeoMetadata;
}

/** Result of a real, in-browser ffmpeg.wasm montage render (see `src/lib/video-engine.ts`). */
export interface MontageResult {
  url: string;
  blob: Blob;
  durationSeconds: number;
  clipCount: number;
}
