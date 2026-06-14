"use client";

import { useEffect, useState, useRef } from "react";
import { Shield, Newspaper, Building2, Home, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ViewportStats {
  level: "city" | "zone" | "locality";
  label: string;
  locality_count: number;
  safety_score: number;
  score_grade: string;
  breakdown: {
    crime_index: number;
    civic_score: number;
    review_score: number;
    trend: number;
  };
  news_summary: {
    total: number;
    crime: number;
    civic: number;
    positive: number;
  };
  buildings: number;
  active_listings: number;
}

interface Props {
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
  zoom: number;
  dark?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

export default function ViewportStatsBar({ bounds, zoom, dark = true }: Props) {
  const [stats, setStats] = useState<ViewportStats | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!bounds) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams({
        minLat: bounds.minLat.toFixed(4),
        maxLat: bounds.maxLat.toFixed(4),
        minLng: bounds.minLng.toFixed(4),
        maxLng: bounds.maxLng.toFixed(4),
        zoom: zoom.toFixed(1),
      });

      fetch(`/api/localities/viewport?${params}`)
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [bounds, zoom]);

  if (!stats || !stats.locality_count) return null;

  const bg = dark ? "bg-gray-900/85" : "bg-white/90";
  const border = dark ? "border-gray-700" : "border-gray-300";
  const text = dark ? "text-white" : "text-gray-900";
  const textSec = dark ? "text-gray-400" : "text-gray-600";

  const scoreColor = getScoreColor(stats.safety_score);
  const trend = stats.breakdown.trend;
  const TrendIcon = trend >= 55 ? TrendingUp : trend <= 45 ? TrendingDown : Minus;
  const trendColor = trend >= 55 ? "text-green-400" : trend <= 45 ? "text-red-400" : "text-gray-400";

  return (
    <div className={`${bg} backdrop-blur-lg border ${border} rounded-xl px-3 py-2 flex items-center gap-3 text-xs shadow-lg max-w-[600px]`}>
      {/* Score badge */}
      <div className="flex items-center gap-1.5 pr-3 border-r border-gray-600/50">
        <Shield size={14} style={{ color: scoreColor }} />
        <div>
          <span className={`${text} font-bold text-sm`} style={{ color: scoreColor }}>
            {stats.score_grade}
          </span>
          <span className={`${textSec} ml-1`}>{stats.safety_score}/100</span>
        </div>
        <TrendIcon size={12} className={trendColor} />
      </div>

      {/* Label */}
      <div className="pr-3 border-r border-gray-600/50">
        <p className={`${text} font-medium text-[11px] leading-tight`}>{stats.label}</p>
        <p className={`${textSec} text-[10px]`}>
          {stats.level === "city" ? "All localities" :
           stats.level === "zone" ? `${stats.locality_count} areas` :
           `${stats.locality_count} area${stats.locality_count > 1 ? "s" : ""}`}
        </p>
      </div>

      {/* News */}
      <div className="flex items-center gap-1 pr-3 border-r border-gray-600/50">
        <Newspaper size={12} className="text-cyan-400" />
        <div>
          <span className={text}>{stats.news_summary.total}</span>
          <span className={`${textSec} ml-0.5`}>news</span>
        </div>
      </div>

      {/* Buildings */}
      <div className="flex items-center gap-1 pr-3 border-r border-gray-600/50">
        <Building2 size={12} className="text-purple-400" />
        <span className={text}>{stats.buildings}</span>
      </div>

      {/* Listings */}
      <div className="flex items-center gap-1">
        <Home size={12} className="text-emerald-400" />
        <span className={text}>{stats.active_listings}</span>
        <span className={textSec}>listings</span>
      </div>
    </div>
  );
}
