/**
 * Stub replacements for `@mediapipe/face_mesh` and `@mediapipe/face_detection`.
 *
 * Both real packages are UMD/globals-style bundles (not real ESM modules),
 * which breaks Turbopack/webpack production builds the moment anything in
 * the dependency graph statically imports them — even though this app never
 * actually uses the "mediapipe" runtime (see `runtime: "tfjs"` in
 * `ml-detection.ts`, which loads face detection/landmarks purely through
 * TensorFlow.js, no MediaPipe WASM assets involved).
 *
 * Aliased in `next.config.ts` (`turbopack.resolveAlias`) so the bundler
 * resolves these two package names to this harmless stub instead. The
 * classes below are never instantiated at runtime — they only need to exist
 * so the static `import { FaceMesh } from "@mediapipe/face_mesh"` (and the
 * `FaceDetection` equivalent) resolve successfully at build time.
 */

/* eslint-disable @typescript-eslint/no-unused-vars -- stub methods intentionally ignore their args; they're never called */

export class FaceMesh {
  constructor(_config?: unknown) {}
  setOptions(_options: unknown) {}
  onResults(_callback: unknown) {}
  send(_input: unknown): Promise<void> {
    return Promise.resolve();
  }
  close(): void {}
}

export class FaceDetection {
  constructor(_config?: unknown) {}
  setOptions(_options: unknown) {}
  onResults(_callback: unknown) {}
  send(_input: unknown): Promise<void> {
    return Promise.resolve();
  }
  close(): void {}
}
