import type L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { VideoRouteMatch } from "@/types";

interface VideoMarkerLayerProps {
  matches: VideoRouteMatch[];
  iconFor: (status: "gps" | "timestamp") => L.DivIcon;
}

/** Renders one map marker per uploaded video that was successfully matched to a route point (GPS or timestamp-based). Videos with "unknown" location render no marker. */
export default function VideoMarkerLayer({ matches, iconFor }: VideoMarkerLayerProps) {
  return (
    <>
      {matches
        .filter((m): m is VideoRouteMatch & { point: NonNullable<VideoRouteMatch["point"]>; status: "gps" | "timestamp" } => Boolean(m.point) && m.status !== "unknown")
        .map((m) => (
          <Marker key={m.videoId} position={[m.point.lat, m.point.lng]} icon={iconFor(m.status)}>
            <Popup>
              <span className="font-medium">{m.name}</span>
              <br />
              {m.status === "gps" ? "Located via GPS metadata" : "Matched via capture timestamp"}
            </Popup>
          </Marker>
        ))}
    </>
  );
}
