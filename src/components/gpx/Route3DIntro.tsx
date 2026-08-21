"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import * as THREE from "three";
import { GpxRouteStats, GpxTrackPoint } from "@/types";
import {
  buildRouteData,
  buildRoutePlaceLabels,
  buildRouteWorldPoints,
  clamp,
  computeStableOverviewCamera,
  createPlaceLabelSprite,
  createTerrainTexture,
  easeInOutCubic,
  moveScalarTowards,
  moveVectorTowards,
  sampleHeight,
  sampleRouteFrame,
  sampleStableOverviewCamera,
  rotateCameraTowards,
  terrainColor,
} from "@/lib/terrain-3d";

export interface RouteIntroClip {
  file: File;
  url: string;
  durationSeconds: number;
}

interface Route3DIntroProps {
  points: GpxTrackPoint[];
  routeStats?: GpxRouteStats | null;
  onClipReady: (clip: RouteIntroClip | null) => void;
  onStatusChange?: (status: "idle" | "rendering" | "ready" | "error") => void;
  hideUi?: boolean;
}

const CLIP_DURATION_SECONDS = 8.5;
const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 1280;

function readBlobDuration(blob: Blob, fallbackSeconds: number) {
  return new Promise<number>((resolve) => {
    const probeUrl = URL.createObjectURL(blob);
    const video = document.createElement("video");
    const finalize = (value: number) => {
      URL.revokeObjectURL(probeUrl);
      resolve(Number.isFinite(value) && value > 0 ? value : fallbackSeconds);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => finalize(video.duration);
    video.onerror = () => finalize(fallbackSeconds);
    video.src = probeUrl;
  });
}

function pickMimeType() {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

export default function Route3DIntro({ points, routeStats, onClipReady, onStatusChange, hideUi = false }: Route3DIntroProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cleanupUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const { samples, stats, bounds, heading } = useMemo(() => buildRouteData(points), [points]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    onClipReady(null);
    const renderingTimeout = window.setTimeout(() => setStatus("rendering"), 0);
    const markError = () => window.setTimeout(() => setStatus("error"), 0);

    if (!hostRef.current || samples.length < 2) {
      window.clearTimeout(renderingTimeout);
      markError();
      return;
    }

    const mimeType = pickMimeType();
    if (!mimeType) {
      window.clearTimeout(renderingTimeout);
      markError();
      return;
    }

    const host = hostRef.current;
    const scene = new THREE.Scene();
    const skyColor = 0x7f96a0;
    scene.background = new THREE.Color(skyColor);

    const camera = new THREE.PerspectiveCamera(42, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 1400);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.setClearColor(skyColor, 1);
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const heightScale = 1.24;
    const terrainSize = 260;
    const segments = 160;
    const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    const positions = terrainGeometry.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const u = x / terrainSize + 0.5;
      const v = y / terrainSize + 0.5;
      const heightValue = sampleHeight(u, v, samples) * heightScale;
      positions.setZ(i, heightValue);

      const color = terrainColor(heightValue).lerp(new THREE.Color("#eef4ef"), clamp((heightValue - 18) / 120, 0, 0.14));
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    terrainGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    terrainGeometry.computeVertexNormals();
    terrainGeometry.rotateX(-Math.PI / 2);

    const terrainTexture = createTerrainTexture();
    const terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      roughness: 0.9,
      metalness: 0,
      map: terrainTexture ?? undefined,
      bumpMap: terrainTexture ?? undefined,
      bumpScale: 0.68,
    });
    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    group.add(terrain);

    const routePoints = buildRouteWorldPoints(samples, terrainSize, heightScale);
    const routeDistanceKm = routeStats?.distanceKm ?? stats.totalDistanceKm;
    const stableOverview = computeStableOverviewCamera(routePoints, bounds, CANVAS_WIDTH / CANVAS_HEIGHT, routeDistanceKm, heading);

    const routeCurve = new THREE.CatmullRomCurve3(routePoints);
    const routeRadius = clamp(stableOverview.position.distanceTo(stableOverview.target) * 0.006, 1.02, 1.42);
    const routeGlowGeometry = new THREE.TubeGeometry(routeCurve, Math.max(140, routePoints.length * 7), routeRadius * 1.65, 8, false);
    const routeGlowMaterial = new THREE.MeshBasicMaterial({ color: 0xff8b62, transparent: true, opacity: 0.28 });
    const routeGlow = new THREE.Mesh(routeGlowGeometry, routeGlowMaterial);
    group.add(routeGlow);

    const routeGeometry = new THREE.TubeGeometry(routeCurve, Math.max(140, routePoints.length * 7), routeRadius, 10, false);
    const routeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4d2f,
      emissive: 0x8f1d10,
      emissiveIntensity: 1,
      roughness: 0.25,
      metalness: 0.08,
      transparent: true,
      opacity: 0.92,
    });
    const routeLine = new THREE.Mesh(routeGeometry, routeMaterial);
    group.add(routeLine);

    const revealedRouteGeometry = new THREE.BufferGeometry().setFromPoints(routePoints);
    const revealedRouteMaterial = new THREE.LineBasicMaterial({ color: 0xff7a45, transparent: true, opacity: 1 });
    const revealedRoute = new THREE.Line(revealedRouteGeometry, revealedRouteMaterial);
    revealedRouteGeometry.setDrawRange(0, 2);
    group.add(revealedRoute);

    const revealedGlowGeometry = new THREE.BufferGeometry().setFromPoints(routePoints);
    const revealedGlowMaterial = new THREE.LineBasicMaterial({ color: 0xffd0b8, transparent: true, opacity: 0.5 });
    const revealedGlow = new THREE.Line(revealedGlowGeometry, revealedGlowMaterial);
    revealedGlowGeometry.setDrawRange(0, 2);
    group.add(revealedGlow);

    const placeSprites: THREE.Sprite[] = [];
    const placeLabels = buildRoutePlaceLabels(samples);
    for (const place of placeLabels) {
      const sample = samples[place.sampleIndex];
      if (!sample) continue;
      const markerLabel =
        place.sampleIndex === 0
          ? `Départ · ${place.name}`
          : place.sampleIndex === samples.length - 1
            ? `Arrivée · ${place.name}`
            : `Point clé · ${place.name}`;
      const sprite = createPlaceLabelSprite(markerLabel);
      if (!sprite) continue;
      sprite.position.set(
        (sample.x - 0.5) * terrainSize,
        sampleHeight(sample.x, sample.y, samples) * heightScale + 16,
        -(sample.y - 0.5) * terrainSize
      );
      placeSprites.push(sprite);
      group.add(sprite);
    }

    const markerGeometry = new THREE.SphereGeometry(3.2, 20, 20);
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: 0x34f0ff,
      emissive: 0x0d5f66,
      emissiveIntensity: 1.4,
      roughness: 0.35,
      metalness: 0.08,
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    group.add(marker);

    const ringGeometry = new THREE.TorusGeometry(5.5, 0.65, 10, 30);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x60f3ff, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const contourMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 });
    const contourGeometries: THREE.BufferGeometry[] = [];
    const contourLines: THREE.Line[] = [];
    for (let band = 0; band < 7; band++) {
      const linePts: THREE.Vector3[] = [];
      const bandY = -terrainSize / 2 + ((band + 1) / 8) * terrainSize;
      for (let i = 0; i <= 88; i++) {
        const x = -terrainSize / 2 + (i / 88) * terrainSize;
        const u = x / terrainSize + 0.5;
        const v = (bandY + terrainSize / 2) / terrainSize;
        const y = sampleHeight(u, v, samples) * heightScale + 0.8;
        linePts.push(new THREE.Vector3(x, y, -(v - 0.5) * terrainSize));
      }
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePts);
      contourGeometries.push(lineGeometry);
      const line = new THREE.Line(lineGeometry, contourMaterial);
      contourLines.push(line);
      group.add(line);
    }

    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-0.55, 1.1, 0.3);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0xcad8ff, 0.22);
    fill.position.set(1.1, 0.2, -0.5);
    scene.add(fill);

    const ambient = new THREE.AmbientLight(0xffffff, 0.26);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xf7faf9, 0x24302b, 0.18);
    scene.add(hemi);

    let captureStartTime = performance.now();
    camera.fov = stableOverview.fov;
    camera.updateProjectionMatrix();
    camera.position.copy(stableOverview.position);
    camera.lookAt(stableOverview.target);
    renderer.render(scene, camera);

    const stream = renderer.domElement.captureStream(24);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    let raf = 0;
    let kickoffRaf = 0;
    let stopped = false;
    let finalized = false;
    let captureStarted = false;
    let warmupFrames = 0;

    const finish = (error?: Error) => {
      if (stopped) return;
      stopped = true;
      window.cancelAnimationFrame(kickoffRaf);
      window.cancelAnimationFrame(raf);
      if (captureStarted && recorder.state !== "inactive") {
        recorder.stop();
      }
      if (error && !finalized) {
        finalized = true;
        setStatus("error");
        onClipReady(null);
      }
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onerror = () => {
      finish(new Error("Route intro recording failed."));
    };

    recorder.onstop = () => {
      if (finalized) return;
      finalized = true;
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size === 0) {
        setStatus("error");
        onClipReady(null);
        return;
      }
      void readBlobDuration(blob, CLIP_DURATION_SECONDS).then((durationSeconds) => {
        const file = new File([blob], "route-intro.webm", { type: mimeType });
        const url = URL.createObjectURL(blob);
        cleanupUrlRef.current = url;
        setStatus("ready");
        onClipReady({ file, url, durationSeconds });
      });
    };

    const renderFrame = () => {
      const now = performance.now();
      const elapsed = (now - captureStartTime) / 1000;
      const introHoldSeconds = 0.2;
      const outroHoldSeconds = 0.5;
      const motionDuration = Math.max(0.1, CLIP_DURATION_SECONDS - introHoldSeconds - outroHoldSeconds);
      const rawProgress = clamp((elapsed - introHoldSeconds) / motionDuration, 0, 1);
      const progress = easeInOutCubic(rawProgress);
      const cameraFrame = sampleStableOverviewCamera(stableOverview, progress, { loopMotion: false });
      moveVectorTowards(camera.position, cameraFrame.position, 0.18);
      camera.fov = moveScalarTowards(camera.fov, cameraFrame.fov, 0.02);
      camera.updateProjectionMatrix();
      rotateCameraTowards(camera, camera.position, cameraFrame.target, THREE.MathUtils.degToRad(2) / 24);
      const { position } = sampleRouteFrame(routePoints, progress);
      const revealVertexCount = Math.max(2, Math.min(routePoints.length, Math.ceil(progress * (routePoints.length - 1)) + 1));

      marker.position.set(position.x, position.y + 0.35, position.z);
      ring.position.copy(marker.position);
      ring.scale.setScalar(1 + Math.sin(elapsed * 1.4) * 0.035);
      revealedRouteGeometry.setDrawRange(0, revealVertexCount);
      revealedGlowGeometry.setDrawRange(0, revealVertexCount);

      renderer.render(scene, camera);

      if (elapsed >= CLIP_DURATION_SECONDS) {
        finish();
        return;
      }
      raf = window.requestAnimationFrame(renderFrame);
    };

    const primeAndStart = () => {
      if (stopped) return;
      renderer.render(scene, camera);
      warmupFrames += 1;
      if (warmupFrames < 4) {
        kickoffRaf = window.requestAnimationFrame(primeAndStart);
        return;
      }
      if (stopped) return;
      captureStarted = true;
      captureStartTime = performance.now();
      recorder.start(250);
      raf = window.requestAnimationFrame(renderFrame);
    };

    kickoffRaf = window.requestAnimationFrame(primeAndStart);

    return () => {
      window.clearTimeout(renderingTimeout);
      finish();
      contourLines.forEach((line) => group.remove(line));
      contourGeometries.forEach((geometry) => geometry.dispose());
      terrainGeometry.dispose();
      terrainMaterial.dispose();
      routeGlowGeometry.dispose();
      routeGlowMaterial.dispose();
      routeGeometry.dispose();
      routeMaterial.dispose();
      revealedRouteGeometry.dispose();
      revealedRouteMaterial.dispose();
      revealedGlowGeometry.dispose();
      revealedGlowMaterial.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      contourMaterial.dispose();
      terrainTexture?.dispose();
      placeSprites.forEach((sprite) => {
        group.remove(sprite);
        sprite.material.map?.dispose();
        sprite.material.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
      if (cleanupUrlRef.current) {
        URL.revokeObjectURL(cleanupUrlRef.current);
        cleanupUrlRef.current = null;
      }
    };
  }, [bounds, heading, onClipReady, routeStats, samples, stats.elevationGainM, stats.totalDistanceKm]);

  if (hideUi) {
    return <div ref={hostRef} className="fixed left-0 top-0 h-[1280px] w-[720px] pointer-events-none opacity-0" aria-hidden="true" />;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-white/75">Terrain 3D GPX</p>
          <p className="mt-1 text-[11px] text-white/45">Capture du flyover depuis la scène terrain 3D interne, stabilisée pour le montage.</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
          {status === "rendering" && <Loader2 className="h-3 w-3 animate-spin text-emerald-300" />}
          {status === "ready" && <CheckCircle2 className="h-3 w-3 text-emerald-300" />}
          {status === "error" && <TriangleAlert className="h-3 w-3 text-rose-300" />}
          <span>{status === "rendering" ? "Rendering" : status === "ready" ? "Ready" : status === "error" ? "Error" : "Idle"}</span>
        </div>
      </div>

      {status === "rendering" && <div className="h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-400/70" /></div>}
      {status === "ready" && (
        <p className="text-xs text-emerald-200/80">
          Intro 3D prête pour le montage final · labels et relief vérifiés
        </p>
      )}
      {status === "error" && <p className="text-xs text-rose-200/75">Impossible de générer l’intro 3D sur ce navigateur.</p>}

      <div ref={hostRef} className="fixed left-0 top-0 h-[1280px] w-[720px] pointer-events-none opacity-0" aria-hidden="true" />
    </div>
  );
}
