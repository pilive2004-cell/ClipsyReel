import type L from "leaflet";
import { GpxRouteStats, GpxTrackPoint } from "@/types";

/** Great-circle distance between two lat/lng points, in meters. */
export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Formats a millisecond duration as a short "Xh Ym" (or "Ym") label; falls back to "—" when unknown. */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return "—";
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** A `leaflet-gpx`-parsed track point: real `L.LatLng` plus the `.meta` (time/elevation/…) it attaches to every point. */
interface GpxLatLng extends L.LatLng {
  meta?: { time: Date | null; ele: number | null };
}

/** Recursively flattens `Polyline.getLatLngs()` (which can nest for multi-segment tracks) into a flat point list. */
function flattenLatLngs(latlngs: L.LatLng[] | L.LatLng[][] | L.LatLng[][][]): GpxLatLng[] {
  const out: GpxLatLng[] = [];
  const visit = (v: L.LatLng | L.LatLng[] | L.LatLng[][] | L.LatLng[][][]) => {
    if (Array.isArray(v)) {
      v.forEach(visit);
    } else {
      out.push(v as GpxLatLng);
    }
  };
  visit(latlngs);
  return out;
}

/**
 * Extracts a flat, chronologically-ordered list of real track points from a
 * loaded `leaflet-gpx` layer (an `L.GPX` FeatureGroup, after its `loaded`
 * event has fired). Each point keeps the elevation/time `leaflet-gpx`
 * parsed from the file — this is what powers both `RouteStatsCard` and the
 * video-to-route matching in `video-location-matcher.ts`.
 *
 * NOTE: `leaflet-gpx` wraps its parsed track/markers in a *nested*
 * `L.FeatureGroup` (one level under the outer `L.GPX` group) whenever a
 * file has more than one child layer (e.g. a polyline + start/end
 * markers) — so we must recurse into any sub-groups, not just do a single
 * `eachLayer` pass, or the polyline is silently never found.
 */
export function extractTrackPoints(gpxLayer: L.Layer): GpxTrackPoint[] {
  const points: GpxTrackPoint[] = [];

  const visit = (layer: L.Layer) => {
    const poly = layer as L.Polyline;
    if (typeof poly.getLatLngs === "function") {
      const flat = flattenLatLngs(poly.getLatLngs() as L.LatLng[] | L.LatLng[][] | L.LatLng[][][]);
      for (const ll of flat) {
        points.push({
          lat: ll.lat,
          lng: ll.lng,
          ele: ll.meta?.ele ?? null,
          time: ll.meta?.time instanceof Date && !Number.isNaN(ll.meta.time.getTime()) ? ll.meta.time : null,
        });
      }
      return;
    }
    const group = layer as L.LayerGroup;
    if (typeof group.eachLayer === "function") {
      group.eachLayer(visit);
    }
  };

  visit(gpxLayer);
  return points;
}

/** Computes distance/elevation/duration stats directly from the extracted points — a pure fallback that doesn't depend on the `L.GPX` instance still being alive. */
export function computeRouteStatsFromPoints(points: GpxTrackPoint[]): GpxRouteStats {
  let distanceM = 0;
  let elevationGainM = 0;
  let highestPointM: number | null = null;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.ele !== null) highestPointM = highestPointM === null ? p.ele : Math.max(highestPointM, p.ele);
    if (i > 0) {
      distanceM += haversineMeters(points[i - 1], p);
      if (p.ele !== null && points[i - 1].ele !== null) {
        const delta = p.ele - (points[i - 1].ele as number);
        if (delta > 0) elevationGainM += delta;
      }
    }
  }

  const times = points.map((p) => p.time).filter((t): t is Date => t instanceof Date);
  const durationMs = times.length >= 2 ? times[times.length - 1].getTime() - times[0].getTime() : null;

  return {
    distanceKm: Math.round((distanceM / 1000) * 10) / 10,
    durationLabel: formatDuration(durationMs),
    elevationGainM: Math.round(elevationGainM),
    highestPointM: highestPointM !== null ? Math.round(highestPointM) : null,
  };
}

/** Parses GPX track points directly from GPX XML text without rendering a map. */
export function parseGpxPointsFromText(gpxText: string): GpxTrackPoint[] {
  const doc = new DOMParser().parseFromString(gpxText, "application/xml");
  if (doc.querySelector("parsererror")) return [];

  const points: GpxTrackPoint[] = [];
  const trkpts = Array.from(doc.getElementsByTagName("trkpt"));

  for (const trkpt of trkpts) {
    const lat = Number(trkpt.getAttribute("lat"));
    const lng = Number(trkpt.getAttribute("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const eleNode = trkpt.getElementsByTagName("ele")[0];
    const timeNode = trkpt.getElementsByTagName("time")[0];
    const ele = eleNode ? Number(eleNode.textContent ?? "") : null;
    const time = timeNode ? new Date(timeNode.textContent ?? "") : null;

    points.push({
      lat,
      lng,
      ele: Number.isFinite(ele) ? (ele as number) : null,
      time: time instanceof Date && !Number.isNaN(time.getTime()) ? time : null,
    });
  }

  return points;
}
