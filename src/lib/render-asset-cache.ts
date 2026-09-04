"use client";

export type RenderCacheKeyPart = string | number | boolean | null | undefined;

type CachedBinaryAsset = {
  data: Uint8Array;
  bytes: number;
  mimeType: string;
  createdAt: number;
  lastUsedAt: number;
};

const MAX_CACHE_BYTES = 96 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 24;

const binaryAssetCache = new Map<string, CachedBinaryAsset>();
let binaryAssetBytes = 0;

function normalizePart(part: RenderCacheKeyPart): string {
  if (part === null) return "null";
  if (part === undefined) return "undefined";
  if (typeof part === "boolean") return part ? "true" : "false";
  if (typeof part === "number") return Number.isFinite(part) ? part.toFixed(6) : String(part);
  return part.replace(/\s+/g, " ").trim();
}

function simpleFallbackHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function digestText(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return simpleFallbackHash(input);

  const digest = await subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildRenderCacheKey(namespace: string, parts: RenderCacheKeyPart[]): Promise<string> {
  return digestText([namespace, ...parts.map(normalizePart)].join("||"));
}

export function fingerprintFile(file: File): string {
  return [file.name, file.size, file.type, file.lastModified].join("|");
}

function evictIfNeeded(extraBytes = 0) {
  if (binaryAssetCache.size === 0) return;

  while (
    binaryAssetCache.size >= MAX_CACHE_ENTRIES ||
    binaryAssetBytes + extraBytes > MAX_CACHE_BYTES
  ) {
    let oldestKey: string | null = null;
    let oldestSeen = Number.POSITIVE_INFINITY;

    for (const [key, asset] of binaryAssetCache.entries()) {
      if (asset.lastUsedAt < oldestSeen) {
        oldestSeen = asset.lastUsedAt;
        oldestKey = key;
      }
    }

    if (!oldestKey) break;
    const removed = binaryAssetCache.get(oldestKey);
    if (removed) binaryAssetBytes -= removed.bytes;
    binaryAssetCache.delete(oldestKey);
  }
}

export function getCachedBinaryAsset(key: string): Uint8Array | null {
  const entry = binaryAssetCache.get(key);
  if (!entry) return null;
  entry.lastUsedAt = Date.now();
  return entry.data;
}

export function putCachedBinaryAsset(key: string, data: Uint8Array, mimeType = "application/octet-stream"): void {
  if (!(data instanceof Uint8Array) || data.byteLength === 0) return;

  const bytes = data.slice();
  const existing = binaryAssetCache.get(key);
  if (existing) {
    binaryAssetBytes -= existing.bytes;
    binaryAssetCache.delete(key);
  }

  evictIfNeeded(bytes.byteLength);

  binaryAssetCache.set(key, {
    data: bytes,
    bytes: bytes.byteLength,
    mimeType,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  });
  binaryAssetBytes += bytes.byteLength;
}

export function clearBinaryAssetCache() {
  binaryAssetCache.clear();
  binaryAssetBytes = 0;
}
