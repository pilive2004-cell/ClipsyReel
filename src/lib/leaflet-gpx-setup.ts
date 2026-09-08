import L from "leaflet";

/**
 * `leaflet-gpx` predates ES modules and expects a global `L` (like the old
 * `<script src="leaflet.js">` era) rather than importing `leaflet` itself.
 * We attach the bundled `leaflet` instance to `window.L` here so that the
 * side-effect `import "leaflet-gpx"` (which must be imported *after* this
 * module) can find `L.FeatureGroup` to extend. This file has no exports —
 * it exists purely to guarantee import/execution order.
 */
if (typeof window !== "undefined") {
  (window as typeof window & { L?: typeof L }).L = L;
}

export {};
