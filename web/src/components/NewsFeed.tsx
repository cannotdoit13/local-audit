"use client";

import { useEffect, useState } from "react";
import { getSeverityColor, timeAgo, formatDistance } from "@/lib/utils";

interface NewsIncident {
  id: number;
  title: string;
  summary: string;
  type: string;
  severity: number;
  source_url: string;
  published_at: string;
  locality_name: string;
  distance_meters: number;
}

interface Props {
  lat: number | null;
  lng: number | null;
  locality?: string;
  score?: number | null;
  grade?: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  crime: "🔴",
  civic: "🟡",
  infrastructure: "🟠",
  legal: "⚖️",
  safety: "🔶",
  positive: "🟢",
  other: "⚪",
};

export default function NewsFeed({ lat, lng, locality, score, grade }: Props) {
  const [incidents, setIncidents] = useState<NewsIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!lat || !lng) return;

    setLoading(true);
    fetch(`/api/news/nearby?lat=${lat}&lng=${lng}&radius=2000&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        setIncidents(data.incidents || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lat, lng]);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-lg border-t border-gray-700 transition-all duration-300 z-50 ${
        expanded ? "h-[70vh]" : "h-[200px]"
      }`}
    >
      {/* Drag handle */}
      <button
        className="w-full flex justify-center pt-2 pb-1 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        aria-label="Toggle news feed"
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full" />
      </button>

      {/* Header */}
      <div className="px-4 pb-2 flex items-center justify-between">
        <div>
          {locality && (
            <p className="text-white text-sm font-medium">
              📍 {locality}
              {score !== null && grade && (
                <span
                  className="ml-2 px-2 py-0.5 rounded text-xs font-bold"
                  style={{ backgroundColor: getSeverityColor((score ?? 50) >= 60 ? 1 : (score ?? 50) >= 40 ? 3 : 5) + "33", color: getSeverityColor((score ?? 50) >= 60 ? 1 : (score ?? 50) >= 40 ? 3 : 5) }}
                >
                  {grade} ({score}/100)
                </span>
              )}
            </p>
          )}
          {!locality && (
            <p className="text-gray-400 text-sm">
              Enable location to see nearby incidents
            </p>
          )}
        </div>
        <span className="text-gray-500 text-xs">
          {incidents.length} incidents nearby
        </span>
      </div>

      {/* Incident list */}
      <div className="overflow-y-auto px-4 pb-4" style={{ maxHeight: expanded ? "calc(70vh - 80px)" : "120px" }}>
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
            <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
            Loading nearby incidents...
          </div>
        )}

        {!loading && incidents.length === 0 && lat && (
          <p className="text-gray-500 text-sm py-4">
            No recent incidents in this area. Looking good!
          </p>
        )}

        {incidents.map((incident) => (
          <a
            key={incident.id}
            href={incident.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-2.5 border-b border-gray-800 hover:bg-gray-800/50 rounded px-2 -mx-2 transition-colors"
          >
            <div className="flex items-start gap-2">
              <span
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ backgroundColor: getSeverityColor(incident.severity) }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm leading-tight truncate">
                  {TYPE_ICONS[incident.type] || "⚪"}{" "}
                  {incident.summary || incident.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-gray-500 text-xs">
                    {timeAgo(incident.published_at)}
                  </span>
                  {incident.distance_meters > 0 && (
                    <span className="text-gray-600 text-xs">
                      • {formatDistance(incident.distance_meters)} away
                    </span>
                  )}
                  <span className="text-gray-600 text-xs">
                    • {incident.type}
                  </span>
                </div>
              </div>
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                style={{
                  backgroundColor: getSeverityColor(incident.severity) + "22",
                  color: getSeverityColor(incident.severity),
                }}
              >
                {incident.severity}/5
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
