import { GpxTrackPoint, ManualLocation, UploadedVideo, VideoGeoMetadata, VideoLocationConfidence, VideoLocationMatch, VideoRouteMatch } from "@/types";
import { haversineMeters } from "./gpx";

const ROUTE_MATCH_MAX_DISTANCE_METERS = 25_000;
const BBOX_PADDING_DEGREES = 0.2;

export interface RouteMatchSummary {
  matches: VideoRouteMatch[];
  warning: string | null;
}

function nearestPointByDistance(target: { lat: number; lng: number }, points: GpxTrackPoint[]) {
  let best = points[0];
  let bestDist = Infinity;
  for (const p of points) {
    const d = haversineMeters(target, p);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return { point: best, distanceMeters: bestDist };
}

function computeBounds(points: GpxTrackPoint[]) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

function isInsideExpandedBounds(gps: { lat: number; lng: number }, points: GpxTrackPoint[]) {
  const bounds = computeBounds(points);
  return (
    gps.lat >= bounds.minLat - BBOX_PADDING_DEGREES &&
    gps.lat <= bounds.maxLat + BBOX_PADDING_DEGREES &&
    gps.lng >= bounds.minLng - BBOX_PADDING_DEGREES &&
    gps.lng <= bounds.maxLng + BBOX_PADDING_DEGREES
  );
}

// ─── Manual location CRUD ─────────────────────────────────────────────────────

export function createManualLocation(overrides: Partial<ManualLocation> = {}): ManualLocation {
  return {
    id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    locationName: "",
    latitude: null,
    longitude: null,
    optionalTimestamp: "",
    note: "",
    ...overrides,
  };
}

export function updateManualLocation(
  locations: ManualLocation[],
  id: string,
  patch: Partial<ManualLocation>
): ManualLocation[] {
  return locations.map((loc) => (loc.id === id ? { ...loc, ...patch } : loc));
}

export function deleteManualLocation(locations: ManualLocation[], id: string): ManualLocation[] {
  return locations.filter((loc) => loc.id !== id);
}

/** Converts a saved manual location into a GpxTrackPoint-like object for map marker rendering. */
export function convertManualLocationToMapMarker(
  loc: ManualLocation
): { lat: number; lng: number; label: string } | null {
  if (loc.latitude === null || loc.longitude === null) return null;
  if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return null;
  return { lat: loc.latitude, lng: loc.longitude, label: loc.locationName || "Manual location" };
}

// ─── Core detection logic ─────────────────────────────────────────────────────

/**
 * Honest GPX/video validation:
 * - Only genuine embedded GPS can auto-place a video on the route.
 * - Timestamp-only metadata is informative but not trustworthy enough to infer
 *   geography, so those videos stay "location unknown" until the user places
 *   them manually.
 * - GPS that sits far outside the GPX route/bounds is flagged as a mismatch
 *   and is never snapped onto the route (Georgia videos must not appear on an
 *   Italy GPX track).
 */
export function matchVideosToRoute(videos: VideoGeoMetadata[], points: GpxTrackPoint[]): RouteMatchSummary {
  const matches: VideoRouteMatch[] = videos.map((video) => {
    if (!video.gps || points.length === 0) {
      return {
        videoId: video.videoId,
        name: video.name,
        status: "unknown",
        point: null,
        reason: video.technicalReason ?? "Location unknown — no embedded GPS metadata was found in the video file.",
        metadata: video,
      };
    }

    const insideBounds = isInsideExpandedBounds(video.gps, points);
    const nearest = nearestPointByDistance(video.gps, points);
    const withinDistance = nearest.distanceMeters <= ROUTE_MATCH_MAX_DISTANCE_METERS;

    if (!insideBounds || !withinDistance) {
      return {
        videoId: video.videoId,
        name: video.name,
        status: "mismatch",
        point: null,
        reason: `Video GPS is ${Math.round(nearest.distanceMeters / 1000)} km away from the GPX route — automatic placement disabled.`,
        metadata: video,
      };
    }

    return {
      videoId: video.videoId,
      name: video.name,
      status: "gps",
      point: nearest.point,
      reason: `Matched via embedded GPS (${Math.round(nearest.distanceMeters)} m from the route).`,
      metadata: video,
    };
  });

  const hasMismatch = matches.some((match) => match.status === "mismatch");
  const warning = hasMismatch
    ? "The uploaded videos do not match the GPX route location. Videos will not be automatically placed on the route."
    : null;

  if (process.env.NODE_ENV !== "production") {
    console.info("[video-route-match]", matches.map((match) => ({
      video: match.name,
      status: match.status,
      gps: match.metadata.gps,
      reason: match.reason,
    })));
  }

  return { matches, warning };
}

export async function matchVideosToGPX(videos: UploadedVideo[], points: GpxTrackPoint[]): Promise<VideoLocationMatch[]> {
  const matches = matchVideosToRoute(videos.map((video) => video.metadata), points).matches;
  return matches.map((match, index) => {
    const video = videos[index];
    const status = match.status === "gps" ? "gps_detected" : match.metadata.gps ? "timestamp_detected" : "metadata_missing";
    const confidence: VideoLocationConfidence = status === "gps_detected" ? "High" : status === "timestamp_detected" ? "Medium" : "Low";
    return {
      videoId: match.videoId,
      fileName: video?.name ?? match.name,
      detectionLevel: status === "gps_detected" ? 1 : status === "timestamp_detected" ? 2 : 3,
      status,
      confidence,
      gpsCoordinates: match.metadata.gps,
      creationTimestamp: match.metadata.capturedAt,
      matchedGPXPoint: match.point,
      manualLocations: [],
      message: match.reason,
    };
  });
}

export const VIDEO_ROUTE_DEBUG_SCENARIOS = [
  {
    name: "Italy GPX + Georgia videos",
    expected: "mismatch",
    note: "GPS exists but is far away — videos must not be snapped onto the route.",
  },
  {
    name: "GPX + videos without GPS",
    expected: "unknown",
    note: "No embedded location data — user must place them manually if desired.",
  },
  {
    name: "Matching GPX and video GPS",
    expected: "gps",
    note: "Embedded GPS is close enough to the route to snap to the nearest track point.",
  },
];
