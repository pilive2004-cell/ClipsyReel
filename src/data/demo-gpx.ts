/**
 * A tiny bundled demo GPX track (a short ride near the Alps) used purely to
 * render an illustrative, blurred route preview for Free-plan users so the
 * upgrade prompt shows a real map instead of a static image. Pro users never
 * see this — their own uploaded .gpx file is parsed and rendered instead.
 */
export const DEMO_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ClipsyReel">
  <trk>
    <name>Demo ride</name>
    <trkseg>
      <trkpt lat="45.7597" lon="4.8422"><ele>168</ele><time>2024-06-01T07:00:00Z</time></trkpt>
      <trkpt lat="45.7712" lon="4.8601"><ele>210</ele><time>2024-06-01T07:08:00Z</time></trkpt>
      <trkpt lat="45.7885" lon="4.8790"><ele>295</ele><time>2024-06-01T07:19:00Z</time></trkpt>
      <trkpt lat="45.8021" lon="4.9034"><ele>352</ele><time>2024-06-01T07:31:00Z</time></trkpt>
      <trkpt lat="45.8190" lon="4.9288"><ele>410</ele><time>2024-06-01T07:44:00Z</time></trkpt>
      <trkpt lat="45.8365" lon="4.9502"><ele>388</ele><time>2024-06-01T07:56:00Z</time></trkpt>
      <trkpt lat="45.8502" lon="4.9741"><ele>301</ele><time>2024-06-01T08:07:00Z</time></trkpt>
      <trkpt lat="45.8640" lon="4.9955"><ele>245</ele><time>2024-06-01T08:18:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;
