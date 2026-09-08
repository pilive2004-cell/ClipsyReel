import type L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { ManualLocation, VideoLocationMatch, VideoRouteMatch } from "@/types";
import { convertManualLocationToMapMarker } from "@/lib/video-location-matcher";

interface VideoMarkerLayerProps {
  /** Legacy VideoRouteMatch array (backward compat for demo/blurred map). */
  matches: VideoRouteMatch[];
  locationMatches?: VideoLocationMatch[];
  iconFor: (status: "gps" | "timestamp") => L.DivIcon;
}

/** Renders one marker per video that passed the real GPS-vs-route validation. */
export default function VideoMarkerLayer({ matches, locationMatches, iconFor }: VideoMarkerLayerProps) {
  return (
    <>
      {/* Legacy markers (blurred demo map) */}
      {matches
        .filter((m): m is VideoRouteMatch & { point: NonNullable<VideoRouteMatch["point"]>; status: "gps" } => Boolean(m.point) && m.status === "gps")
        .map((m) => (
          <Marker key={m.videoId} position={[m.point.lat, m.point.lng]} icon={iconFor(m.status)}>
            <Popup>
              <span className="font-medium">{m.name}</span>
              <br />
              {m.reason}
            </Popup>
          </Marker>
        ))}

      {/* Smart Location Matcher — automatic markers */}
      {locationMatches?.map((m) => {
        if (!m.matchedGPXPoint) return null;
        const status = m.status === "gps_detected" ? "gps" : "timestamp";
        if (m.status !== "gps_detected" && m.status !== "timestamp_detected") return null;
        return (
          <Marker key={m.videoId} position={[m.matchedGPXPoint.lat, m.matchedGPXPoint.lng]} icon={iconFor(status)}>
            <Popup>
              <span className="font-medium">{m.fileName}</span>
              <br />
              {m.status === "gps_detected" ? "Located via GPS metadata" : "Matched via capture timestamp"}
              <br />
              <span className="text-xs opacity-60">Confidence: {m.confidence}</span>
            </Popup>
          </Marker>
        );
      })}

      {/* Smart Location Matcher — manual markers (Level 3 user input) */}
      {locationMatches?.flatMap((m) =>
        m.manualLocations.map((loc: ManualLocation) => {
          const marker = convertManualLocationToMapMarker(loc);
          if (!marker) return null;
          return (
            <Marker
              key={loc.id}
              position={[marker.lat, marker.lng]}
            icon={iconFor("gps")}
            >
              <Popup>
                <span className="font-medium">{m.fileName}</span>
                <br />
                <span className="text-xs">{marker.label}</span>
                <br />
                <span className="text-xs opacity-60">Manually placed</span>
                {loc.note && <><br /><span className="text-xs opacity-50">{loc.note}</span></>}
              </Popup>
            </Marker>
          );
        })
      )}
    </>
  );
}
