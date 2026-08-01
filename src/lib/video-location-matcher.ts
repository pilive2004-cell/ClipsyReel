import { GpxTrackPoint, UploadedVideo, VideoGeoMetadata, VideoRouteMatch } from "@/types";
import { haversineMeters } from "./gpx";

/**
 * FUTURE BACKEND INTEGRATION:
 * Real per-video geolocation should be extracted server-side (video files
 * aren't safely parseable for embedded GPS/QuickTime metadata purely in the
 * browser). Recommended approach:
 *   1. `exiftool -json -GPSCoordinates -CreateDate video.mp4` (or the `exifr`
 *      npm package for a pure-JS subset) to pull `GPSCoordinates` /
 *      `CreateDate` from the video container's metadata atoms.
 *   2. If GPS is present, match the video directly to the *nearest* GPX
 *      track point (riders/drivers rarely start filming exactly on the
 *      recorded line, so snapping to the closest point keeps markers visually
 *      aligned with the drawn route).
 *   3. If GPS is absent but a creation timestamp exists, match by the GPX
 *      point with the closest recorded `<time>`.
 *   4. If neither is available, surface "location unknown" rather than
 *      guessing — silently misplacing a marker is worse than admitting we
 *      don't know.
 * For this MVP (no backend), `generateMockVideoMetadata` below fabricates
 * plausible per-video metadata so the full matching UX can be demonstrated.
 */
export function generateMockVideoMetadata(videos: UploadedVideo[], points: GpxTrackPoint[]): VideoGeoMetadata[] {
  return videos.map((video, i) => {
    // First video: pretend we found real embedded GPS, roughly a third of the way along the route.
    if (i === 0 && points.length > 0) {
      const anchor = points[Math.floor(points.length * 0.3)];
      return {
        videoId: `${video.name}-${i}`,
        name: video.name,
        gps: { lat: anchor.lat, lng: anchor.lng },
        capturedAt: null,
      };
    }
    // Second video: no GPS, but a plausible creation timestamp matching a point further along the timed track.
    if (i === 1) {
      const timedPoints = points.filter((p) => p.time);
      const anchor = timedPoints[Math.floor(timedPoints.length * 0.65)];
      return {
        videoId: `${video.name}-${i}`,
        name: video.name,
        gps: null,
        capturedAt: anchor?.time ?? null,
      };
    }
    // Any further video: no metadata at all — exercises the "location unknown" state.
    return { videoId: `${video.name}-${i}`, name: video.name, gps: null, capturedAt: null };
  });
}

function nearestPointByDistance(target: { lat: number; lng: number }, points: GpxTrackPoint[]): GpxTrackPoint {
  let best = points[0];
  let bestDist = Infinity;
  for (const p of points) {
    const d = haversineMeters(target, p);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function nearestPointByTime(target: Date, points: GpxTrackPoint[]): GpxTrackPoint | null {
  const timed = points.filter((p) => p.time);
  if (timed.length === 0) return null;
  let best = timed[0];
  let bestDelta = Infinity;
  for (const p of timed) {
    const delta = Math.abs((p.time as Date).getTime() - target.getTime());
    if (delta < bestDelta) {
      bestDelta = delta;
      best = p;
    }
  }
  return best;
}

/**
 * Places each uploaded video on the closest matching point of the parsed
 * GPX route:
 * - GPS metadata present → snap to the nearest track point by distance.
 * - No GPS, but a capture timestamp → snap to the nearest track point by time.
 * - Neither → "unknown" (no marker placed).
 */
export function matchVideosToRoute(videos: VideoGeoMetadata[], points: GpxTrackPoint[]): VideoRouteMatch[] {
  return videos.map((video) => {
    if (video.gps && points.length > 0) {
      return { videoId: video.videoId, name: video.name, status: "gps", point: nearestPointByDistance(video.gps, points) };
    }
    if (video.capturedAt) {
      const point = nearestPointByTime(video.capturedAt, points);
      if (point) return { videoId: video.videoId, name: video.name, status: "timestamp", point };
    }
    return { videoId: video.videoId, name: video.name, status: "unknown", point: null };
  });
}
