import type L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { VideoRouteMatch } from "@/types";

interface VideoMarkerLayerProps {
  matches: VideoRouteMatch[];
  iconFor: (status: "gps") => L.DivIcon;
}

/** Renders one marker per video that passed the real GPS-vs-route validation. */
export default function VideoMarkerLayer({ matches, iconFor }: VideoMarkerLayerProps) {
  return (
    <>
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
    </>
  );
}
