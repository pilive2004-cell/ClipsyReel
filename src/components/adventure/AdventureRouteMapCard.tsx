"use client";

import { Map } from "lucide-react";

interface AdventureRouteMapCardProps {
  routeTitle: string;
  routePoints: { lat: number; lng: number }[] | null;
}

export default function AdventureRouteMapCard({ routeTitle, routePoints }: AdventureRouteMapCardProps) {
  const normalized = routePoints && routePoints.length > 1 ? normalizePoints(routePoints) : null;
  const start = normalized?.[0];
  const end = normalized?.[normalized.length - 1];

  return (
    <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.04] via-black/30 to-black/60 p-4">
      <div className="flex items-center gap-2">
        <Map className="h-4 w-4 text-fuchsia-300" />
        <div>
          <p className="text-sm font-semibold text-white/90">GPX route map</p>
          <p className="text-xs text-white/45">{routeTitle}</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.18),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,1))] p-3">
        {normalized ? (
          <svg viewBox="0 0 100 100" className="aspect-[16/10] w-full">
            <defs>
              <linearGradient id="route-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="50%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#fde047" />
              </linearGradient>
            </defs>
            <path
              d={`M ${normalized.map((point) => `${point.x},${point.y}`).join(" L ")}`}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {normalized.map((point, index) => (
              <circle
                key={`${point.x}-${point.y}-${index}`}
                cx={point.x}
                cy={point.y}
                r={index === 0 || index === normalized.length - 1 ? 1.8 : 0.4}
                fill={index === 0 ? "#ffffff" : index === normalized.length - 1 ? "#f97316" : "#ffffff22"}
              />
            ))}
            <polyline
              fill="none"
              stroke="url(#route-gradient)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={normalized.map((point) => `${point.x},${point.y}`).join(" ")}
            />
            {start && (
              <g>
                <circle cx={start.x} cy={start.y} r="4" fill="#ffffff" fillOpacity="0.18" />
                <text x={start.x + 4} y={start.y - 4} fill="#ffffff" fontSize="4" fontWeight="600">
                  Start
                </text>
              </g>
            )}
            {end && (
              <g>
                <circle cx={end.x} cy={end.y} r="4" fill="#f97316" fillOpacity="0.18" />
                <text x={end.x - 4} y={end.y + 9} fill="#fde047" fontSize="4" fontWeight="600" textAnchor="end">
                  Finish
                </text>
              </g>
            )}
            <rect x="7" y="7" width="28" height="8" rx="4" fill="rgba(255,255,255,0.08)" />
            <text x="21" y="12.6" fill="#ffffff" fontSize="4" fontWeight="600" textAnchor="middle">
              Start → Finish
            </text>
          </svg>
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center rounded-[20px] border border-dashed border-white/10 text-center text-sm text-white/40">
            Upload a GPX file to add a route map to the Adventure Report.
          </div>
        )}
      </div>
    </div>
  );
}

function normalizePoints(points: { lat: number; lng: number }[]) {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(0.000001, maxLat - minLat);
  const lngRange = Math.max(0.000001, maxLng - minLng);

  return points.map((point) => ({
    x: 10 + ((point.lng - minLng) / lngRange) * 80,
    y: 90 - ((point.lat - minLat) / latRange) * 80,
  }));
}
