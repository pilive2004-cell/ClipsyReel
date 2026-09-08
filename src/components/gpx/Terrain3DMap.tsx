"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GpxTrackPoint } from "@/types";
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

const PREVIEW_CYCLE_DURATION_SECONDS = 22;
const PREVIEW_HOLD_SECONDS = 0.45;

function formatNumber(value: number, fractionDigits = 0) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export default function Terrain3DMap({ points }: { points: GpxTrackPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { samples, stats, bounds, heading } = useMemo(() => buildRouteData(points), [points]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || samples.length < 2) return;

    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;

    const scene = new THREE.Scene();
    const skyColor = 0x7f96a0;
    scene.background = new THREE.Color(skyColor);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1400);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.setClearColor(skyColor, 1);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const heightScale = 1.24;
    const terrainSize = 260;
    const segments = 160;
    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    const positions = geometry.attributes.position as THREE.BufferAttribute;
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

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.rotateX(-Math.PI / 2);

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

    const terrain = new THREE.Mesh(geometry, terrainMaterial);
    terrain.receiveShadow = true;
    group.add(terrain);

    const routePoints = buildRouteWorldPoints(samples, terrainSize, heightScale);
    const routeDistanceKm = stats.totalDistanceKm;
    const overview = computeStableOverviewCamera(routePoints, bounds, width / height, routeDistanceKm, heading);

    const routeCurve = new THREE.CatmullRomCurve3(routePoints);
    const routeRadius = clamp(overview.position.distanceTo(overview.target) * 0.006, 1.02, 1.42);
    const routeGlowGeometry = new THREE.TubeGeometry(routeCurve, Math.max(140, routePoints.length * 7), routeRadius * 1.65, 8, false);
    const routeGlow = new THREE.Mesh(
      routeGlowGeometry,
      new THREE.MeshBasicMaterial({ color: 0xff8b62, transparent: true, opacity: 0.28 })
    );
    group.add(routeGlow);

    const routeGeometry = new THREE.TubeGeometry(routeCurve, Math.max(140, routePoints.length * 7), routeRadius, 10, false);
    const routeLine = new THREE.Mesh(
      routeGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xff4d2f,
        emissive: 0x8f1d10,
        emissiveIntensity: 1,
        roughness: 0.25,
        metalness: 0.08,
        transparent: true,
        opacity: 0.92,
      })
    );
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
      const sprite = createPlaceLabelSprite(place.name);
      if (!sprite) continue;
      sprite.position.set(
        (sample.x - 0.5) * terrainSize,
        sampleHeight(sample.x, sample.y, samples) * heightScale + 13.5,
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

    const contourMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 });
    const contourGeometries: THREE.BufferGeometry[] = [];
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
      const contourGeometry = new THREE.BufferGeometry().setFromPoints(linePts);
      contourGeometries.push(contourGeometry);
      const line = new THREE.Line(contourGeometry, contourMat);
      group.add(line);
    }

    const startTime = performance.now();
    camera.fov = overview.fov;
    camera.updateProjectionMatrix();
    camera.position.copy(overview.position);
    camera.lookAt(overview.target);
    let raf = 0;

    const resize = () => {
      const nextWidth = container.clientWidth || 1;
      const nextHeight = container.clientHeight || 1;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const animate = () => {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      const cycleDurationSeconds = PREVIEW_CYCLE_DURATION_SECONDS;
      const holdSeconds = PREVIEW_HOLD_SECONDS;
      const cycleElapsed = elapsed % cycleDurationSeconds;
      const motionDuration = cycleDurationSeconds - holdSeconds * 2;
      const rawProgress = clamp((cycleElapsed - holdSeconds) / motionDuration, 0, 1);
      const progress = easeInOutCubic(rawProgress);
      const cameraFrame = sampleStableOverviewCamera(overview, progress, { loopMotion: true });
      moveVectorTowards(camera.position, cameraFrame.position, 0.16);
      camera.fov = moveScalarTowards(camera.fov, cameraFrame.fov, 0.02);
      camera.updateProjectionMatrix();
      rotateCameraTowards(camera, camera.position, cameraFrame.target, THREE.MathUtils.degToRad(2) / 24);
      const frame = sampleRouteFrame(routePoints, progress);
      const { position } = frame;
      const revealVertexCount = Math.max(2, Math.min(routePoints.length, Math.ceil(progress * (routePoints.length - 1)) + 1));

      marker.position.set(position.x, position.y + 0.35, position.z);
      ring.position.copy(marker.position);
      ring.scale.setScalar(1 + Math.sin(elapsed * 1.4) * 0.035);
      revealedRouteGeometry.setDrawRange(0, revealVertexCount);
      revealedGlowGeometry.setDrawRange(0, revealVertexCount);

      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };

    renderer.render(scene, camera);
    animate();

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      geometry.dispose();
      terrainMaterial.dispose();
      routeGeometry.dispose();
      routeGlowGeometry.dispose();
      routeGlow.material.dispose();
      routeLine.material.dispose();
      revealedRouteGeometry.dispose();
      revealedRouteMaterial.dispose();
      revealedGlowGeometry.dispose();
      revealedGlowMaterial.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      contourMat.dispose();
      contourGeometries.forEach((contourGeometry) => contourGeometry.dispose());
      terrainTexture?.dispose();
      placeSprites.forEach((sprite) => {
        group.remove(sprite);
        sprite.material.map?.dispose();
        sprite.material.dispose();
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [bounds, heading, samples, stats.totalDistanceKm]);

  const altitudeLabel = formatNumber(Math.max(stats.highestPointM, 0), 0);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-black">
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 16%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.08) 22%, rgba(255,255,255,0) 54%), linear-gradient(180deg, #a4b1ab 0%, #73827b 100%)",
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.01),transparent_36%,rgba(0,0,0,0.04))]" />

      <div className="pointer-events-none absolute left-4 top-4 max-w-[430px] rounded-3xl border border-white/10 bg-black/28 px-4 py-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold tracking-[-0.05em] text-white">whympr</p>
            <p className="mt-1 text-sm text-white/65">Mapbox terrain</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Terrain 3D GPX</p>
            <p className="mt-1 text-sm text-white/65">Relief incliné avec trace en volume</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2">
          <div className="rounded-2xl bg-white/8 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Altitude</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-white">
              {altitudeLabel}
              <span className="ml-1 text-sm font-medium text-white/65">m</span>
            </p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/12 bg-black/42 px-3 py-1.5 text-[11px] uppercase tracking-[0.26em] text-white/72 backdrop-blur-md">
        perspective 3D
      </div>
    </div>
  );
}
