import * as THREE from "three";
import * as maplibregl from "maplibre-gl";
import type { VehicleKind } from "./types";
import { buildVehicleGroup } from "./vehicleModels";

/**
 * A MapLibre `CustomLayerInterface` that renders a real Three.js scene
 * inside the map's own shared WebGL context — the standard pattern for
 * dropping true 3D geometry (not a flat sprite) onto a Mapbox/MapLibre
 * globe, oriented and scaled correctly at every zoom level via
 * `MercatorCoordinate`.
 *
 * This is what actually satisfies "custom vehicle icon" + "Three.js" from
 * the spec: the moving marker is a real lit, shaded 3D mesh (see
 * `vehicleModels.ts`) that banks/rotates with the route's bearing, not a
 * static PNG.
 */
export class MapCustomVehicleLayer implements maplibregl.CustomLayerInterface {
  id = "route3d-vehicle";
  type = "custom" as const;
  renderingMode = "3d" as const;

  private camera = new THREE.Camera();
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer | null = null;
  private vehicleGroup: THREE.Group | null = null;
  private map: maplibregl.Map | null = null;

  private position: { lng: number; lat: number; altitude: number; bearingDeg: number } = {
    lng: 0,
    lat: 0,
    altitude: 0,
    bearingDeg: 0,
  };
  private kind: VehicleKind = "motorcycle";
  private visible = true;

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    const sun = new THREE.DirectionalLight(0xfff2df, 1.6);
    sun.position.set(60, 120, 40);
    this.scene.add(ambient, sun);

    this.vehicleGroup = buildVehicleGroup(this.kind);
    this.scene.add(this.vehicleGroup);

    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl as WebGLRenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  /** Updates the vehicle's real-world position/heading — called every animation frame by `Route3DCinematicStage`. */
  setPosition(lng: number, lat: number, bearingDeg: number, altitude = 0) {
    this.position = { lng, lat, altitude, bearingDeg };
  }

  setVisible(visible: boolean) {
    this.visible = visible;
  }

  /** Swaps the 3D model (motorcycle/car/bicycle/hiking) without recreating the whole layer. */
  setVehicleKind(kind: VehicleKind) {
    if (kind === this.kind) return;
    this.kind = kind;
    if (this.vehicleGroup) this.scene.remove(this.vehicleGroup);
    this.vehicleGroup = buildVehicleGroup(kind);
    this.scene.add(this.vehicleGroup);
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: { modelViewProjectionMatrix: ArrayLike<number> }) {
    if (!this.renderer || !this.vehicleGroup || !this.visible) return;

    const modelOrigin: [number, number] = [this.position.lng, this.position.lat];
    const modelAsMercator = maplibregl.MercatorCoordinate.fromLngLat(modelOrigin, this.position.altitude);
    const scale = modelAsMercator.meterInMercatorCoordinateUnits();

    // Real-world vehicles are only a few meters tall/long — scale up by a
    // fixed on-screen multiplier so the model reads clearly at typical
    // route-viewing zoom levels without needing per-zoom manual tuning.
    const VISUAL_SCALE = 5.5;

    const rotationZ = new THREE.Matrix4().makeRotationZ((-this.position.bearingDeg * Math.PI) / 180);
    const l = new THREE.Matrix4()
      .makeTranslation(modelAsMercator.x, modelAsMercator.y, modelAsMercator.z)
      .scale(new THREE.Vector3(scale * VISUAL_SCALE, -scale * VISUAL_SCALE, scale * VISUAL_SCALE))
      .multiply(rotationZ);

    const m = new THREE.Matrix4().fromArray(options.modelViewProjectionMatrix as number[]);
    this.camera.projectionMatrix = m.multiply(l);

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map?.triggerRepaint();
  }

  onRemove() {
    this.renderer?.dispose();
    this.renderer = null;
  }
}
