import * as THREE from "three";
import type { VehicleKind } from "./types";

/** Shared "premium glow" material factory — a bright emissive accent color plus a subtle metallic body, echoing the BMW/DJI "brushed metal + neon accent" language called for in the design brief. */
function glowMaterial(color: number, emissiveIntensity = 1.4) {
  return new THREE.MeshStandardMaterial({ color: 0x111318, emissive: color, emissiveIntensity, metalness: 0.65, roughness: 0.35 });
}

function bodyMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.75, roughness: 0.25 });
}

/** Low-poly, dependency-free procedural silhouette for each vehicle kind — deliberately simple/iconic (no external GLTF assets to fetch/license) but readable at the small on-map scale a route marker is actually seen at. */
function buildMotorcycle(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 2.6, 4, 8), bodyMaterial());
  body.rotation.z = Math.PI / 2;
  body.position.y = 1.1;
  group.add(body);
  const wheelGeo = new THREE.TorusGeometry(1, 0.22, 8, 16);
  const front = new THREE.Mesh(wheelGeo, glowMaterial(0x38bdf8, 1.1));
  front.rotation.y = Math.PI / 2;
  front.position.set(1.9, 0.9, 0);
  const rear = front.clone();
  rear.position.set(-1.9, 0.9, 0);
  group.add(front, rear);
  return group;
}

function buildCar(): THREE.Group {
  const group = new THREE.Group();
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.1, 2.2), bodyMaterial());
  chassis.position.y = 1;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.9), bodyMaterial());
  cabin.position.set(-0.2, 1.75, 0);
  group.add(chassis, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 16);
  const positions: [number, number][] = [
    [1.6, 1.2],
    [1.6, -1.2],
    [-1.6, 1.2],
    [-1.6, -1.2],
  ];
  for (const [x, z] of positions) {
    const wheel = new THREE.Mesh(wheelGeo, glowMaterial(0xf97316, 0.9));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.55, z);
    group.add(wheel);
  }
  return group;
}

function buildBicycle(): THREE.Group {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 2.6, 4, 8), glowMaterial(0x34d399, 1.2));
  frame.rotation.z = Math.PI / 2.4;
  frame.position.y = 1.3;
  group.add(frame);
  const wheelGeo = new THREE.TorusGeometry(1.05, 0.1, 8, 20);
  const front = new THREE.Mesh(wheelGeo, bodyMaterial());
  front.rotation.y = Math.PI / 2;
  front.position.set(1.6, 1.05, 0);
  const rear = front.clone();
  rear.position.set(-1.6, 1.05, 0);
  group.add(front, rear);
  return group;
}

function buildHiker(): THREE.Group {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.4, 4, 8), bodyMaterial());
  torso.position.y = 1.9;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), bodyMaterial());
  head.position.y = 2.9;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.4), glowMaterial(0xf59e0b, 1.1));
  pack.position.set(-0.35, 2, -0.3);
  group.add(torso, head, pack);
  return group;
}

/** A soft, pulsing ground-halo under the vehicle — the "premium glow" reveal that reads clearly even at a wide, zoomed-out camera framing. */
function buildGroundHalo(color: number): THREE.Mesh {
  const geo = new THREE.RingGeometry(1.6, 3.2, 32);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.name = "groundHalo";
  return mesh;
}

const HALO_COLOR_BY_VEHICLE: Record<VehicleKind, number> = {
  motorcycle: 0x38bdf8,
  car: 0xf97316,
  bicycle: 0x34d399,
  hiking: 0xf59e0b,
};

/** Builds the full vehicle-marker group (body + ground halo) for a given kind — the single factory `MapCustomVehicleLayer` calls when the user switches vehicle type. */
export function buildVehicleGroup(kind: VehicleKind): THREE.Group {
  const group = new THREE.Group();
  const body = kind === "motorcycle" ? buildMotorcycle() : kind === "car" ? buildCar() : kind === "bicycle" ? buildBicycle() : buildHiker();
  group.add(body);
  group.add(buildGroundHalo(HALO_COLOR_BY_VEHICLE[kind]));
  return group;
}
