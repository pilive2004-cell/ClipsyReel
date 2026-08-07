"use client";

import * as THREE from "three";
import { GpxTrackPoint } from "@/types";
import { haversineMeters } from "@/lib/gpx";

export type RouteSample = {
  lat: number;
  lng: number;
  ele: number;
  distance: number;
  x: number;
  y: number;
};

export type RouteTerrainStats = {
  totalDistanceKm: number;
  elevationGainM: number;
  highestPointM: number;
};

export type RouteBoundingBox = {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  latRange: number;
  lngRange: number;
};

export type RoutePlaceLabel = {
  name: string;
  sampleIndex: number;
};

export type StableOverviewCamera = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  drift: {
    panAxis: THREE.Vector3;
    dollyAxis: THREE.Vector3;
    panAmplitude: number;
    dollyAmplitude: number;
    liftAmplitude: number;
    targetLiftAmplitude: number;
    fovAmplitude: number;
  };
};

export type StableOverviewCameraSampleOptions = {
  loopMotion?: boolean;
};

const LOOK_AT_HELPER = new THREE.Object3D();

const MAJOR_CITIES: Array<{ name: string; lat: number; lng: number }> = [
  { name: "Paris", lat: 48.8566, lng: 2.3522 },
  { name: "Lyon", lat: 45.764, lng: 4.8357 },
  { name: "Marseille", lat: 43.2965, lng: 5.3698 },
  { name: "Nice", lat: 43.7102, lng: 7.262 },
  { name: "Toulouse", lat: 43.6047, lng: 1.4442 },
  { name: "Bordeaux", lat: 44.8378, lng: -0.5792 },
  { name: "Nantes", lat: 47.2184, lng: -1.5536 },
  { name: "Lille", lat: 50.6292, lng: 3.0573 },
  { name: "Geneva", lat: 46.2044, lng: 6.1432 },
  { name: "Lausanne", lat: 46.5197, lng: 6.6323 },
  { name: "Zurich", lat: 47.3769, lng: 8.5417 },
  { name: "Milan", lat: 45.4642, lng: 9.19 },
  { name: "Turin", lat: 45.0703, lng: 7.6869 },
  { name: "Barcelona", lat: 41.3874, lng: 2.1686 },
  { name: "Madrid", lat: 40.4168, lng: -3.7038 },
  { name: "Munich", lat: 48.1351, lng: 11.582 },
  { name: "Innsbruck", lat: 47.2692, lng: 11.4041 },
  { name: "Salzburg", lat: 47.8095, lng: 13.055 },
  { name: "Garmisch-Partenkirchen", lat: 47.4925, lng: 11.0957 },
  { name: "Bolzano", lat: 46.4983, lng: 11.3548 },
  { name: "Brenner Pass", lat: 47.005, lng: 11.498 },
  { name: "Stelvio Pass", lat: 46.529, lng: 10.452 },
  { name: "Gotthard Pass", lat: 46.553, lng: 8.57 },
  { name: "Lucerne", lat: 47.0502, lng: 8.3093 },
  { name: "Lake Geneva", lat: 46.45, lng: 6.5 },
  { name: "Lake Como", lat: 46.016, lng: 9.257 },
  { name: "Lake Annecy", lat: 45.8992, lng: 6.1294 },
  { name: "Annecy", lat: 45.8992, lng: 6.1294 },
  { name: "Chamonix", lat: 45.9237, lng: 6.8694 },
  { name: "Aosta", lat: 45.7373, lng: 7.3172 },
  { name: "Bled", lat: 46.3683, lng: 14.1146 },
  { name: "Vienna", lat: 48.2082, lng: 16.3738 },
];

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function easeInOutCubic(value: number) {
  const t = clamp(value, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function moveVectorTowards(current: THREE.Vector3, target: THREE.Vector3, maxDistanceDelta: number) {
  const delta = target.clone().sub(current);
  const distance = delta.length();
  if (distance <= maxDistanceDelta || distance === 0) {
    current.copy(target);
    return current;
  }
  return current.add(delta.multiplyScalar(maxDistanceDelta / distance));
}

export function moveScalarTowards(current: number, target: number, maxDelta: number) {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

function computeRouteHeading(samples: RouteSample[]) {
  if (samples.length < 2) return 0;

  const first = samples[0];
  const last = samples[samples.length - 1];
  const travelX = last.x - first.x;
  const travelY = last.y - first.y;

  let meanX = 0;
  let meanY = 0;
  for (const sample of samples) {
    meanX += sample.x;
    meanY += sample.y;
  }
  meanX /= samples.length;
  meanY /= samples.length;

  let covXX = 0;
  let covXY = 0;
  let covYY = 0;
  for (const sample of samples) {
    const dx = sample.x - meanX;
    const dy = sample.y - meanY;
    covXX += dx * dx;
    covXY += dx * dy;
    covYY += dy * dy;
  }

  const axisAngle = 0.5 * Math.atan2(2 * covXY, covXX - covYY);
  const axis = new THREE.Vector2(Math.cos(axisAngle), Math.sin(axisAngle));
  const travel = new THREE.Vector2(travelX, travelY);
  if (travel.lengthSq() > 1e-8 && axis.dot(travel) < 0) {
    axis.multiplyScalar(-1);
  }
  return Math.atan2(axis.y, axis.x);
}

export function rotateCameraTowards(
  camera: THREE.PerspectiveCamera,
  position: THREE.Vector3,
  target: THREE.Vector3,
  maxRadiansDelta: number
) {
  camera.position.copy(position);
  LOOK_AT_HELPER.position.copy(position);
  LOOK_AT_HELPER.up.copy(camera.up);
  LOOK_AT_HELPER.lookAt(target);
  if (maxRadiansDelta <= 0) {
    camera.quaternion.copy(LOOK_AT_HELPER.quaternion);
    return;
  }
  camera.quaternion.rotateTowards(LOOK_AT_HELPER.quaternion, maxRadiansDelta);
}

export function buildRouteData(points: GpxTrackPoint[]) {
  const ordered = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  if (ordered.length < 2) {
    return {
      samples: [] as RouteSample[],
      stats: { totalDistanceKm: 0, elevationGainM: 0, highestPointM: 0 } as RouteTerrainStats,
      bounds: {
        latMin: 0,
        latMax: 0,
        lngMin: 0,
        lngMax: 0,
        latRange: 1e-6,
        lngRange: 1e-6,
      } satisfies RouteBoundingBox,
      heading: 0,
    };
  }

  let totalDistance = 0;
  let elevationGain = 0;
  let highestPoint = Number.NEGATIVE_INFINITY;
  const samples: RouteSample[] = [];

  ordered.forEach((point, index) => {
    const prev = ordered[index - 1];
    if (index > 0) {
      totalDistance += haversineMeters(prev, point);
      const prevEle = prev.ele ?? point.ele ?? 0;
      const currEle = point.ele ?? prevEle;
      if (currEle > prevEle) elevationGain += currEle - prevEle;
    }

    const fallbackEle = ordered[index - 1]?.ele ?? 0;
    const ele = point.ele ?? fallbackEle;
    highestPoint = Math.max(highestPoint, ele);

    samples.push({
      lat: point.lat,
      lng: point.lng,
      ele,
      distance: totalDistance,
      x: 0,
      y: 0,
    });
  });

  const lngMin = Math.min(...samples.map((sample) => sample.lng));
  const lngMax = Math.max(...samples.map((sample) => sample.lng));
  const latMin = Math.min(...samples.map((sample) => sample.lat));
  const latMax = Math.max(...samples.map((sample) => sample.lat));
  const lngRange = Math.max(1e-6, lngMax - lngMin);
  const latRange = Math.max(1e-6, latMax - latMin);
  const bounds = {
    latMin,
    latMax,
    lngMin,
    lngMax,
    latRange,
    lngRange,
  } satisfies RouteBoundingBox;

  samples.forEach((sample) => {
    sample.x = (sample.lng - lngMin) / lngRange;
    sample.y = 1 - (sample.lat - latMin) / latRange;
  });

  const heading = computeRouteHeading(samples);

  return {
    samples,
    stats: {
      totalDistanceKm: totalDistance / 1000,
      elevationGainM: elevationGain,
      highestPointM: highestPoint === Number.NEGATIVE_INFINITY ? 0 : highestPoint,
    } satisfies RouteTerrainStats,
    bounds,
    heading,
  };
}

export function buildRouteWorldPoints(
  samples: RouteSample[],
  terrainSize: number,
  heightScale: number,
  routeLift = 5.8
) {
  const routePoints: THREE.Vector3[] = [];
  for (const sample of samples) {
    const x = (sample.x - 0.5) * terrainSize;
    const z = -(sample.y - 0.5) * terrainSize;
    const y = sampleHeight(sample.x, sample.y, samples) * heightScale + routeLift;
    routePoints.push(new THREE.Vector3(x, y, z));
  }
  return routePoints;
}

export function computeStableOverviewCamera(
  routePoints: THREE.Vector3[],
  bounds: RouteBoundingBox,
  viewportAspect: number,
  routeDistanceKm: number,
  routeHeadingRad = 0
): StableOverviewCamera {
  if (routePoints.length === 0) {
    return {
      position: new THREE.Vector3(0, 112, 142),
      target: new THREE.Vector3(0, 34, 0),
      fov: 42,
      drift: {
        panAxis: new THREE.Vector3(1, 0, 0),
        dollyAxis: new THREE.Vector3(0, 0, 1),
        panAmplitude: 0.08,
        dollyAmplitude: 0.14,
        liftAmplitude: 0.04,
        targetLiftAmplitude: 0.03,
        fovAmplitude: 0.015,
      },
    };
  }

  const routeBounds = new THREE.Box3().setFromPoints(routePoints);
  const routeCenter = routeBounds.getCenter(new THREE.Vector3());
  const routeSize = routeBounds.getSize(new THREE.Vector3());
  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3(Math.sin(routeHeadingRad), 0, Math.cos(routeHeadingRad)).normalize();
  const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const back = forward.clone().multiplyScalar(-1);
  const halfWidth = Math.max(routeSize.x * 0.5, 18);
  const halfDepth = Math.max(routeSize.z * 0.5, 24);
  const peakRelativeHeight = Math.max(routeBounds.max.y - routeCenter.y, 0);
  const routeHeight = Math.max(routeSize.y, 14);
  const routeSpan = Math.max(routeSize.x, routeSize.z, 96);
  const routeAspect = Math.max(bounds.lngRange / bounds.latRange, bounds.latRange / bounds.lngRange);
  const baseFov = clamp(41.5 - clamp((routeAspect - 1) * 0.22, 0, 1.4), 38, 47);
  const verticalFov = THREE.MathUtils.degToRad(baseFov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(viewportAspect, 0.35));
  const widthFitDistance = (halfWidth + 44) / Math.tan(Math.max(horizontalFov / 2, 0.2));
  const depthFitDistance = (halfDepth + 58) / Math.tan(Math.max(verticalFov / 2, 0.2));
  const distance = clamp(Math.max(widthFitDistance, depthFitDistance) + routeDistanceKm * 0.018, 188, 268);
  const backDistance = distance * 0.58;
  const altitude = clamp(distance * 0.43 + routeHeight * 0.2 + peakRelativeHeight * 0.1, 116, 186);
  const sideOffset = clamp(routeCenter.x * 0.02, -5, 5);
  const targetLift = clamp(routeHeight * 0.14 + 12, 13, 23);

  return {
    position: routeCenter
      .clone()
      .add(back.multiplyScalar(backDistance))
      .add(right.clone().multiplyScalar(sideOffset))
      .add(up.clone().multiplyScalar(altitude)),
    target: routeCenter.clone().add(up.clone().multiplyScalar(targetLift)),
    fov: baseFov,
    drift: {
      panAxis: right.clone(),
      dollyAxis: back.clone(),
      panAmplitude: clamp(routeSpan * 0.000035, 0.001, 0.0042),
      dollyAmplitude: clamp(distance * 0.000028, 0.0015, 0.0052),
      liftAmplitude: clamp(routeHeight * 0.00011, 0.0005, 0.0022),
      targetLiftAmplitude: clamp(routeHeight * 0.00009, 0.0004, 0.0018),
      fovAmplitude: clamp(routeSpan * 0.000006, 0.00025, 0.0011),
    },
  };
}

export function sampleStableOverviewCamera(
  overview: StableOverviewCamera,
  progress: number,
  options: StableOverviewCameraSampleOptions = {}
) {
  const smooth = easeInOutCubic(progress);
  const loopMotion = options.loopMotion ?? false;
  const pulse = easeInOutCubic(Math.sin((smooth * Math.PI) / 2) ** 2);
  const loopPulse = 0.5 - 0.5 * Math.cos(smooth * Math.PI * 2);
  const panOffset = loopMotion
   ? Math.sin(smooth * Math.PI * 2) * overview.drift.panAmplitude * 0.04
   : (smooth - 0.5) * overview.drift.panAmplitude * 0.035;
  const dollyOffset = loopMotion
   ? -loopPulse * overview.drift.dollyAmplitude * 0.035
   : -smooth * overview.drift.dollyAmplitude * 0.03;
  const liftOffset = Math.sin(smooth * Math.PI) * overview.drift.liftAmplitude * 0.045;
  const targetLiftOffset = Math.sin(smooth * Math.PI) * overview.drift.targetLiftAmplitude * 0.045;
  const fovOffset = loopMotion
   ? Math.sin(smooth * Math.PI) * overview.drift.fovAmplitude * 0.04
   : pulse * overview.drift.fovAmplitude * 0.03;

  return {
    position: overview.position
      .clone()
      .add(overview.drift.panAxis.clone().multiplyScalar(panOffset))
      .add(overview.drift.dollyAxis.clone().multiplyScalar(dollyOffset))
      .add(new THREE.Vector3(0, liftOffset, 0)),
    target: overview.target
      .clone()
      .add(overview.drift.panAxis.clone().multiplyScalar(panOffset * 0.22))
      .add(new THREE.Vector3(0, targetLiftOffset, 0)),
    fov: overview.fov - fovOffset,
  };
}

export function sampleHeight(u: number, v: number, samples: RouteSample[]) {
  const edge = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2;
  const ridge =
    Math.sin(u * 5.4 + v * 2.3) * 0.52 +
    Math.cos(u * 2.1 - v * 4.7) * 0.36 +
    Math.sin((u + v) * 11.2) * 0.2 +
    Math.cos((u - v) * 15.1) * 0.15;
  const backLift = Math.pow(v, 1.15) * 18;
  const sideLift = Math.pow(edge, 1.35) * 12;

  let valley = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const ax = a.x - 0.5;
    const ay = a.y - 0.5;
    const bx = b.x - 0.5;
    const by = b.y - 0.5;
    const px = u - 0.5;
    const py = v - 0.5;
    const abx = bx - ax;
    const aby = by - ay;
    const lenSq = abx * abx + aby * aby || 1e-6;
    const t = clamp(((px - ax) * abx + (py - ay) * aby) / lenSq, 0, 1);
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    const dist = Math.hypot(px - cx, py - cy);
    valley = Math.max(valley, Math.exp(-dist * 22));
  }

  return Math.max(0, 8 + ridge * 10.8 + backLift + sideLift - valley * 18);
}

export function terrainColor(height: number) {
  if (height > 60) return new THREE.Color("#e7ece6");
  if (height > 48) return new THREE.Color("#bdc4ad");
  if (height > 36) return new THREE.Color("#7c9766");
  if (height > 24) return new THREE.Color("#526b46");
  return new THREE.Color("#344836");
}

export function sampleRouteFrame(routePoints: THREE.Vector3[], progress: number) {
  if (routePoints.length === 0) {
    return {
      position: new THREE.Vector3(),
      tangent: new THREE.Vector3(1, 0, 0),
      lookAhead: new THREE.Vector3(),
    };
  }

  if (routePoints.length === 1) {
    return {
      position: routePoints[0].clone(),
      tangent: new THREE.Vector3(1, 0, 0),
      lookAhead: routePoints[0].clone(),
    };
  }

  const scaled = clamp(progress, 0, 1) * (routePoints.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(routePoints.length - 1, index + 1);
  const localT = scaled - index;
  const current = routePoints[index];
  const next = routePoints[nextIndex];
  const position = current.clone().lerp(next, localT);

  const aheadScaled = clamp(progress + 0.05, 0, 1) * (routePoints.length - 1);
  const aheadIndex = Math.floor(aheadScaled);
  const aheadNextIndex = Math.min(routePoints.length - 1, aheadIndex + 1);
  const aheadLocalT = aheadScaled - aheadIndex;
  const aheadCurrent = routePoints[aheadIndex];
  const aheadNext = routePoints[aheadNextIndex];
  const lookAhead = aheadCurrent.clone().lerp(aheadNext, aheadLocalT);

  const behindScaled = clamp(progress - 0.03, 0, 1) * (routePoints.length - 1);
  const behindIndex = Math.floor(behindScaled);
  const behindNextIndex = Math.min(routePoints.length - 1, behindIndex + 1);
  const behindLocalT = behindScaled - behindIndex;
  const behindCurrent = routePoints[behindIndex];
  const behindNext = routePoints[behindNextIndex];
  const behind = behindCurrent.clone().lerp(behindNext, behindLocalT);

  const tangent = lookAhead.clone().sub(behind).normalize();

  if (tangent.lengthSq() === 0) tangent.set(1, 0, 0);

  return { position, tangent, lookAhead };
}

function shortCoordinateLabel(lat: number, lng: number) {
  const latPrefix = lat >= 0 ? "N" : "S";
  const lngPrefix = lng >= 0 ? "E" : "W";
  return `${latPrefix}${Math.abs(lat).toFixed(2)} ${lngPrefix}${Math.abs(lng).toFixed(2)}`;
}

export function buildRoutePlaceLabels(samples: RouteSample[]): RoutePlaceLabel[] {
  if (samples.length < 2) return [];
  const indexCandidates = [0, Math.floor((samples.length - 1) * 0.25), Math.floor((samples.length - 1) * 0.5), Math.floor((samples.length - 1) * 0.75), samples.length - 1];
  const uniqueIndexes = Array.from(new Set(indexCandidates)).sort((a, b) => a - b);

  return uniqueIndexes.map((sampleIndex) => {
    const sample = samples[sampleIndex];
    const nearest = MAJOR_CITIES.reduce(
      (best, city) => {
        const distance = haversineMeters({ lat: sample.lat, lng: sample.lng }, { lat: city.lat, lng: city.lng });
        if (distance < best.distance) return { city, distance };
        return best;
      },
      { city: MAJOR_CITIES[0], distance: Number.POSITIVE_INFINITY }
    );
    const label = nearest.distance <= 260_000 ? nearest.city.name : shortCoordinateLabel(sample.lat, sample.lng);
    return { name: label, sampleIndex };
  });
}

export function createTerrainTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Satellite-style terrain base with multiple color zones
  const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, "#eef4ea");        // Snow/high peaks
  base.addColorStop(0.12, "#c7d1bf");     // High altitude rocks
  base.addColorStop(0.28, "#94b083");     // Alpine green
  base.addColorStop(0.54, "#6e8d60");     // Forest green
  base.addColorStop(0.78, "#496447");     // Dark green
  base.addColorStop(1, "#273930");        // Very dark terrain
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add realistic rock/stone patches (gray/brown)
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = 2 + Math.random() * 5;
    const alpha = 0.012 + Math.random() * 0.04;
    const grayTone = Math.random();
    if (grayTone < 0.3) {
      ctx.fillStyle = `rgba(152, 140, 118, ${alpha.toFixed(3)})`;
    } else if (grayTone < 0.6) {
      ctx.fillStyle = `rgba(168, 150, 120, ${alpha.toFixed(3)})`;
    } else {
      ctx.fillStyle = `rgba(88, 91, 80, ${alpha.toFixed(3)})`;
    }
    ctx.fillRect(x, y, size, size);
  }

  // Add dense forest/vegetation patches (dark green)
  for (let i = 0; i < 1000; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = 0.8 + Math.random() * 2.4;
    const alpha = 0.016 + Math.random() * 0.05;
    ctx.fillStyle = `rgba(27, 64, 34, ${alpha.toFixed(3)})`;
    ctx.fillRect(x, y, size, size);
  }

  // Add lighter vegetation and grass details
  for (let i = 0; i < 850; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = 0.4 + Math.random() * 1.6;
    const alpha = 0.008 + Math.random() * 0.024;
    ctx.fillStyle = `rgba(152, 177, 114, ${alpha.toFixed(3)})`;
    ctx.fillRect(x, y, size, size);
  }

  // Add water patches (blue/gray)
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = 4 + Math.random() * 12;
    const alpha = 0.012 + Math.random() * 0.02;
    ctx.fillStyle = `rgba(78, 112, 138, ${alpha.toFixed(3)})`;
    ctx.fillRect(x, y, size, size);
  }

  // Add terrain ridges and elevation lines
  for (let i = 0; i < 480; i++) {
    const y = (i / 480) * canvas.height;
    ctx.strokeStyle = `rgba(245, 248, 246, ${(0.008 + Math.random() * 0.02).toFixed(3)})`;
    ctx.lineWidth = 0.6 + Math.random() * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(i * 0.35) * 3);
    ctx.lineTo(canvas.width, y + Math.cos(i * 0.33) * 3);
    ctx.stroke();
  }

  // Add erosion/shadow details
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = 1 + Math.random() * 3;
    const alpha = 0.004 + Math.random() * 0.012;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha.toFixed(3)})`;
    ctx.fillRect(x, y, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.6, 2.6);
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

export function createPlaceLabelSprite(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 680;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Much darker background with higher contrast
  ctx.fillStyle = "rgba(5, 10, 8, 0.95)";
  ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
  ctx.lineWidth = 3.5;
  const radius = 32;
  ctx.beginPath();
  ctx.moveTo(radius, 6);
  ctx.arcTo(canvas.width - 6, 6, canvas.width - 6, canvas.height - 6, radius);
  ctx.arcTo(canvas.width - 6, canvas.height - 6, 6, canvas.height - 6, radius);
  ctx.arcTo(6, canvas.height - 6, 6, 6, radius);
  ctx.arcTo(6, 6, canvas.width - 6, 6, radius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Even larger, brighter text with shadow for max visibility
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  ctx.fillStyle = "rgba(255, 220, 50, 1)";
  ctx.font = "900 56px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);

  ctx.shadowColor = "rgba(0, 0, 0, 0)";
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(80, 19, 1);
  sprite.renderOrder = 100;
  return sprite;
}

export function createRouteStatsSprite(distanceKm: number, elevationGainM: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Very dark background with golden border
  ctx.fillStyle = "rgba(8, 14, 12, 0.96)";
  ctx.strokeStyle = "rgba(251, 191, 36, 0.7)";
  ctx.lineWidth = 4;
  const radius = 48;
  ctx.beginPath();
  ctx.moveTo(radius, 10);
  ctx.arcTo(canvas.width - 10, 10, canvas.width - 10, canvas.height - 10, radius);
  ctx.arcTo(canvas.width - 10, canvas.height - 10, 10, canvas.height - 10, radius);
  ctx.arcTo(10, canvas.height - 10, 10, 10, radius);
  ctx.arcTo(10, 10, canvas.width - 10, 10, radius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // GPX label (small, gray)
  ctx.fillStyle = "rgba(180, 200, 190, 0.8)";
  ctx.font = "600 38px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("📍 GPX Route", 60, 70);

  // Distance in km (VERY LARGE, bright yellow with shadow)
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  
  ctx.fillStyle = "rgba(255, 230, 50, 1)";
  ctx.font = "900 88px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${distanceKm.toFixed(1)} km`, 60, 165);

  // Elevation gain D+ (large white with shadow)
  ctx.fillStyle = "rgba(240, 248, 245, 0.98)";
  ctx.font = "700 72px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`D+ ${Math.round(elevationGainM)} m`, 60, 270);

  ctx.shadowColor = "rgba(0, 0, 0, 0)";

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(180, 57.6, 1);
  sprite.renderOrder = 100;
  return sprite;
}
