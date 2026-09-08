import type { GpxTrackPoint } from "@/types";
import { haversineMeters } from "@/lib/gpx";
import type {
  GpxDifficultSection,
  GpxInterestingMoment,
  GpxInterestingMomentKind,
  GpxSignalSample,
  GpxSignalsResult,
  GpxStopSection,
  GpxViewpoint,
} from "./types";
import { clamp, roundScore } from "./timeline-helpers";

export const DEFAULT_GPX_FALLBACK_INTERVAL_SECONDS = 1;
export const DEFAULT_HEADING_VARIANCE_WINDOW = 2;
export const DEFAULT_VIEWPOINT_WINDOW = 3;
export const DEFAULT_VIEWPOINT_MIN_PROMINENCE_METERS = 18;
export const DEFAULT_VIEWPOINT_MAX_SPEED_MPS = 3.2;
export const DEFAULT_STOP_SPEED_THRESHOLD_MPS = 0.7;
export const DEFAULT_STOP_MIN_DURATION_SECONDS = 8;
export const DEFAULT_DIFFICULT_SECTION_MIN_SLOPE_PERCENT = 8;
export const DEFAULT_DIFFICULT_SECTION_MIN_HEADING_VARIANCE_DEG = 24;
export const DEFAULT_INTERESTING_MOMENT_MIN_GAP_SECONDS = 10;
export const DEFAULT_INTERESTING_MOMENT_THRESHOLD = 0.68;

function toSeconds(time: Date | null | undefined): number | null {
  return time instanceof Date && Number.isFinite(time.getTime()) ? time.getTime() / 1000 : null;
}

function bearingDegrees(from: GpxTrackPoint, to: GpxTrackPoint): number {
  const phi1 = (from.lat * Math.PI) / 180;
  const phi2 = (to.lat * Math.PI) / 180;
  const lambda1 = (from.lng * Math.PI) / 180;
  const lambda2 = (to.lng * Math.PI) / 180;
  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

function normalizedAngleDelta(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeSampleSeries(points: GpxTrackPoint[]): GpxSignalSample[] {
  if (points.length === 0) return [];
  const firstTime = toSeconds(points[0].time);
  let totalDistanceMeters = 0;
  let previousSpeed = 0;

  return points.map((point, index) => {
    const previous = points[index - 1] ?? point;
    const next = points[index + 1] ?? point;
    const distanceDeltaMeters = index === 0 ? 0 : haversineMeters(previous, point);
    totalDistanceMeters += distanceDeltaMeters;

    const previousSeconds = toSeconds(previous.time);
    const currentSeconds = toSeconds(point.time);
    const deltaTimeSeconds =
      index === 0
        ? DEFAULT_GPX_FALLBACK_INTERVAL_SECONDS
        : Math.max(
            DEFAULT_GPX_FALLBACK_INTERVAL_SECONDS,
            currentSeconds !== null && previousSeconds !== null ? currentSeconds - previousSeconds : DEFAULT_GPX_FALLBACK_INTERVAL_SECONDS
          );

    const speedMps = distanceDeltaMeters <= 0 ? 0 : distanceDeltaMeters / deltaTimeSeconds;
    const headingDeg = index === 0 ? (points.length > 1 ? bearingDegrees(point, next) : 0) : bearingDegrees(previous, point);
    const previousAltitude = previous.ele ?? point.ele;
    const currentAltitude = point.ele;
    const slopePercent =
      index === 0 || previousAltitude === null || currentAltitude === null || distanceDeltaMeters < 0.5
        ? 0
        : ((currentAltitude - previousAltitude) / distanceDeltaMeters) * 100;
    const accelerationMps2 = index === 0 ? 0 : (speedMps - previousSpeed) / deltaTimeSeconds;
    previousSpeed = speedMps;

    const elapsedSeconds =
      firstTime !== null && currentSeconds !== null
        ? Math.max(0, currentSeconds - firstTime)
        : index * DEFAULT_GPX_FALLBACK_INTERVAL_SECONDS;

    return {
      pointIndex: index,
      elapsedSeconds,
      timestamp: point.time,
      distanceFromStartMeters: totalDistanceMeters,
      speedMps,
      headingDeg,
      altitudeM: currentAltitude,
      slopePercent,
      accelerationMps2,
      headingVarianceDeg: 0,
    } satisfies GpxSignalSample;
  });
}

function addHeadingVariance(samples: GpxSignalSample[]): GpxSignalSample[] {
  return samples.map((sample, index) => {
    const start = Math.max(0, index - DEFAULT_HEADING_VARIANCE_WINDOW);
    const end = Math.min(samples.length - 1, index + DEFAULT_HEADING_VARIANCE_WINDOW);
    const angles: number[] = [];
    for (let cursor = start + 1; cursor <= end; cursor++) {
      angles.push(normalizedAngleDelta(samples[cursor - 1].headingDeg, samples[cursor].headingDeg));
    }
    return {
      ...sample,
      headingVarianceDeg: average(angles),
    } satisfies GpxSignalSample;
  });
}

function detectViewpoints(samples: readonly GpxSignalSample[]): GpxViewpoint[] {
  const viewpoints: GpxViewpoint[] = [];
  for (let index = DEFAULT_VIEWPOINT_WINDOW; index < samples.length - DEFAULT_VIEWPOINT_WINDOW; index++) {
    const sample = samples[index];
    if (sample.altitudeM === null) continue;
    const neighborhood = samples.slice(index - DEFAULT_VIEWPOINT_WINDOW, index + DEFAULT_VIEWPOINT_WINDOW + 1);
    const highestNeighbor = Math.max(...neighborhood.map((entry) => entry.altitudeM ?? Number.NEGATIVE_INFINITY));
    const lowestNeighbor = Math.min(...neighborhood.map((entry) => entry.altitudeM ?? Number.POSITIVE_INFINITY));
    const prominenceM = sample.altitudeM - lowestNeighbor;
    const lowSpeed = sample.speedMps <= DEFAULT_VIEWPOINT_MAX_SPEED_MPS;
    const isLocalMax = sample.altitudeM >= highestNeighbor;
    if (!isLocalMax || !lowSpeed || prominenceM < DEFAULT_VIEWPOINT_MIN_PROMINENCE_METERS) continue;
    const scenicScore = roundScore(
      clamp((prominenceM / 60) * 60 + (1 - Math.min(sample.speedMps / DEFAULT_VIEWPOINT_MAX_SPEED_MPS, 1)) * 20 + (1 - sample.headingVarianceDeg / 90) * 20, 0, 100)
    );
    viewpoints.push({
      pointIndex: sample.pointIndex,
      elapsedSeconds: sample.elapsedSeconds,
      timestamp: sample.timestamp,
      altitudeM: sample.altitudeM,
      prominenceM: roundScore(prominenceM),
      scenicScore,
    });
  }
  return viewpoints;
}

function detectStops(samples: readonly GpxSignalSample[]): GpxStopSection[] {
  const stops: GpxStopSection[] = [];
  let startIndex: number | null = null;
  for (let index = 0; index < samples.length; index++) {
    const isSlow = samples[index].speedMps <= DEFAULT_STOP_SPEED_THRESHOLD_MPS;
    if (isSlow && startIndex === null) startIndex = index;
    const isEndingRun = startIndex !== null && (!isSlow || index === samples.length - 1);
    if (!isEndingRun || startIndex === null) continue;

    const endIndex = isSlow && index === samples.length - 1 ? index : index - 1;
    const durationSeconds = samples[endIndex].elapsedSeconds - samples[startIndex].elapsedSeconds;
    if (durationSeconds >= DEFAULT_STOP_MIN_DURATION_SECONDS) {
      const speeds = samples.slice(startIndex, endIndex + 1).map((sample) => sample.speedMps);
      stops.push({
        startPointIndex: samples[startIndex].pointIndex,
        endPointIndex: samples[endIndex].pointIndex,
        startElapsedSeconds: samples[startIndex].elapsedSeconds,
        endElapsedSeconds: samples[endIndex].elapsedSeconds,
        durationSeconds: roundScore(durationSeconds),
        averageSpeedMps: roundScore(average(speeds)),
      });
    }
    startIndex = isSlow ? index : null;
  }
  return stops;
}

function detectDifficultSections(samples: readonly GpxSignalSample[]): GpxDifficultSection[] {
  const sections: GpxDifficultSection[] = [];
  let startIndex: number | null = null;
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index];
    const difficult = Math.abs(sample.slopePercent) >= DEFAULT_DIFFICULT_SECTION_MIN_SLOPE_PERCENT && sample.headingVarianceDeg >= DEFAULT_DIFFICULT_SECTION_MIN_HEADING_VARIANCE_DEG;
    if (difficult && startIndex === null) startIndex = index;
    const endsSection = startIndex !== null && (!difficult || index === samples.length - 1);
    if (!endsSection || startIndex === null) continue;
    const endIndex = difficult && index === samples.length - 1 ? index : index - 1;
    const slice = samples.slice(startIndex, endIndex + 1);
    sections.push({
      startPointIndex: samples[startIndex].pointIndex,
      endPointIndex: samples[endIndex].pointIndex,
      startElapsedSeconds: samples[startIndex].elapsedSeconds,
      endElapsedSeconds: samples[endIndex].elapsedSeconds,
      averageSlopePercent: roundScore(average(slice.map((entry) => Math.abs(entry.slopePercent)))),
      averageHeadingVarianceDeg: roundScore(average(slice.map((entry) => entry.headingVarianceDeg))),
      severity: roundScore(clamp(average(slice.map((entry) => Math.abs(entry.slopePercent) * 4 + entry.headingVarianceDeg)) / 5, 0, 100)),
    });
    startIndex = difficult ? index : null;
  }
  return sections;
}

function buildInterestingMoment(kind: GpxInterestingMomentKind, sample: GpxSignalSample, intensity: number, label: string): GpxInterestingMoment {
  return {
    kind,
    pointIndex: sample.pointIndex,
    elapsedSeconds: sample.elapsedSeconds,
    timestamp: sample.timestamp,
    intensity: roundScore(clamp(intensity, 0, 100)),
    label,
  };
}

function pickLocalPeaks(
  samples: readonly GpxSignalSample[],
  scorer: (sample: GpxSignalSample) => number,
  threshold: number,
  kind: GpxInterestingMomentKind,
  label: string
): GpxInterestingMoment[] {
  const peaks: GpxInterestingMoment[] = [];
  let lastAcceptedSeconds = Number.NEGATIVE_INFINITY;
  for (let index = 1; index < samples.length - 1; index++) {
    const previousScore = scorer(samples[index - 1]);
    const currentScore = scorer(samples[index]);
    const nextScore = scorer(samples[index + 1]);
    if (currentScore < threshold || currentScore < previousScore || currentScore < nextScore) continue;
    if (samples[index].elapsedSeconds - lastAcceptedSeconds < DEFAULT_INTERESTING_MOMENT_MIN_GAP_SECONDS) continue;
    peaks.push(buildInterestingMoment(kind, samples[index], currentScore * 100, label));
    lastAcceptedSeconds = samples[index].elapsedSeconds;
  }
  return peaks;
}

export function detectInterestingGpxMoments(points: GpxTrackPoint[], existingSignals?: GpxSignalsResult): GpxInterestingMoment[] {
  const signals = existingSignals ?? analyzeGpxSignals(points);
  const samples = signals.samples;
  const maxSpeed = Math.max(...samples.map((sample) => sample.speedMps), 0.0001);
  const maxSlope = Math.max(...samples.map((sample) => Math.abs(sample.slopePercent)), 0.0001);
  const maxAccel = Math.max(...samples.map((sample) => Math.abs(sample.accelerationMps2)), 0.0001);

  const speedPeaks = pickLocalPeaks(samples, (sample) => sample.speedMps / maxSpeed, DEFAULT_INTERESTING_MOMENT_THRESHOLD, "speed_peak", "Speed surge");
  const slopePeaks = pickLocalPeaks(samples, (sample) => Math.abs(sample.slopePercent) / maxSlope, DEFAULT_INTERESTING_MOMENT_THRESHOLD, "slope_peak", "Steep pitch");
  const elevationPushes = pickLocalPeaks(
    samples,
    (sample) => (Math.abs(sample.accelerationMps2) / maxAccel) * 0.35 + (Math.abs(sample.slopePercent) / maxSlope) * 0.65,
    DEFAULT_INTERESTING_MOMENT_THRESHOLD,
    "elevation_push",
    "Elevation change"
  );
  const scenicMoments = signals.viewpoints.map((viewpoint) => ({
    kind: "viewpoint",
    pointIndex: viewpoint.pointIndex,
    elapsedSeconds: viewpoint.elapsedSeconds,
    timestamp: viewpoint.timestamp,
    intensity: viewpoint.scenicScore,
    label: "Viewpoint",
  } satisfies GpxInterestingMoment));
  const technicalMoments = signals.difficultSections.map((section) => ({
    kind: "technical_section",
    pointIndex: section.startPointIndex,
    elapsedSeconds: section.startElapsedSeconds,
    timestamp: samples[section.startPointIndex]?.timestamp ?? null,
    intensity: section.severity,
    label: "Technical section",
  } satisfies GpxInterestingMoment));
  const stopMoments = signals.stops.map((stop) => ({
    kind: "stop",
    pointIndex: stop.startPointIndex,
    elapsedSeconds: stop.startElapsedSeconds,
    timestamp: samples[stop.startPointIndex]?.timestamp ?? null,
    intensity: roundScore(clamp(stop.durationSeconds * 4, 0, 100)),
    label: "Pause / overlook",
  } satisfies GpxInterestingMoment));

  return [...speedPeaks, ...slopePeaks, ...elevationPushes, ...scenicMoments, ...technicalMoments, ...stopMoments].sort(
    (a, b) => a.elapsedSeconds - b.elapsedSeconds || b.intensity - a.intensity || a.pointIndex - b.pointIndex
  );
}

/**
 * Turns raw GPX points into editorially meaningful route signals so the edit
 * can react to climbs, pauses, viewpoints, and technical sections instead of
 * only using GPX as a static map decoration.
 */
export function analyzeGpxSignals(points: GpxTrackPoint[]): GpxSignalsResult {
  const samples = addHeadingVariance(computeSampleSeries(points));
  const viewpoints = detectViewpoints(samples);
  const stops = detectStops(samples);
  const difficultSections = detectDifficultSections(samples);

  const summary = {
    totalDistanceMeters: roundScore(samples[samples.length - 1]?.distanceFromStartMeters ?? 0),
    totalDurationSeconds: roundScore(samples[samples.length - 1]?.elapsedSeconds ?? 0),
    maxSpeedMps: roundScore(Math.max(...samples.map((sample) => sample.speedMps), 0)),
    maxSlopePercent: roundScore(Math.max(...samples.map((sample) => Math.abs(sample.slopePercent)), 0)),
    highestAltitudeM: samples.reduce<number | null>((highest, sample) => {
      if (sample.altitudeM === null) return highest;
      return highest === null ? sample.altitudeM : Math.max(highest, sample.altitudeM);
    }, null),
  };

  const result: GpxSignalsResult = {
    samples,
    viewpoints,
    stops,
    difficultSections,
    interestingMoments: [],
    summary,
  };

  return {
    ...result,
    interestingMoments: detectInterestingGpxMoments(points, result),
  };
}
