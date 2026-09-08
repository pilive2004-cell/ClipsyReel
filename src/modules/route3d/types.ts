import type { GpxTrackPoint } from "@/types";
import type { GpxSignalsResult } from "@/modules/editing-intelligence/types";

/**
 * Camera modes for the Route Story Player:
 * - "overview"  : fits the full route in view, static, used before/after playback
 * - "follow"    : North-up, centers on the vehicle, zoom adapts to speed — labels stay readable
 * - "cinematic" : follows vehicle bearing with slight pitch, more dramatic feel
 */
export type CameraMode = "overview" | "follow" | "cinematic";

/** Available playback speed multipliers. */
export type PlaybackSpeed = 0.5 | 1 | 2 | 4 | 8;

/** Which icon/silhouette rides along the animated route line. */
export type VehicleKind = "motorcycle" | "car" | "bicycle" | "hiking";

export type StoryChapterKind =
  | "highestAltitude"
  | "longestDistance"
  | "fastestSection"
  | "mostScenicViewpoint"
  | "longestStop";

/**
 * One auto-generated "Travel Story" chapter — the Relive-style highlight
 * reel of a GPX track: a labeled, timestamped beat the player can jump to,
 * each anchored to a real point on the route (not an arbitrary guess).
 */
export interface StoryChapter {
  kind: StoryChapterKind;
  /** Human-readable title shown in the chapter list / chapter card. */
  title: string;
  /** One-line supporting detail (e.g. "2,340 m — the highest point of the ride"). */
  detail: string;
  /** Index into the (possibly downsampled) point array driving the 3D stage. */
  pointIndex: number;
  /** Normalized [0,1] position along the whole route — what the player scrubber/camera actually uses. */
  progress: number;
  /** Seconds elapsed since the route start, when known from GPX timestamps. */
  elapsedSeconds: number | null;
}

/** Everything the 3D stage/player needs, derived once from the raw GPX points. */
export interface RouteMetrics {
  /** Route points, each carrying its cumulative distance/speed/bearing (see `routeMetrics.ts`). */
  points: EnrichedRoutePoint[];
  totalDistanceMeters: number;
  totalDurationSeconds: number | null;
  maxSpeedKmh: number;
  highestAltitudeM: number | null;
  elevationGainM: number;
  chapters: StoryChapter[];
  /** The full underlying signal analysis (viewpoints/stops/etc.) — kept around for advanced HUD/debug use. */
  signals: GpxSignalsResult;
}

export interface EnrichedRoutePoint extends GpxTrackPoint {
  /** Cumulative distance from the route start, in meters. */
  distanceFromStartM: number;
  /** Instantaneous speed at this point, in km/h (0 when unknown/first point). */
  speedKmh: number;
  /** Compass bearing (0-360) toward the NEXT point — used to orient the vehicle marker and follow-camera. */
  bearingDeg: number;
  /** Normalized [0,1] position of this point along the whole route. */
  progress: number;
}
