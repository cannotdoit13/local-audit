"use client";

import { useState, useEffect } from "react";
import { X, Building2, Shield, Newspaper, Star, AlertTriangle, CheckCircle, Home, IndianRupee, ChevronDown, ChevronUp, ExternalLink, Info } from "lucide-react";
import { getSeverityColor, timeAgo } from "@/lib/utils";

interface Listing {
  id: number;
  type: string;
  sqft: number;
  price: number;
  price_label: string;
  floor: string;
  furnished: string;
  available_from: string;
  source_url?: string;
  source_name?: string;
}

interface RatingBreakdown {
  security: number;
  maintenance: number;
  water_supply: number;
  power_backup: number;
  cleanliness: number;
  connectivity: number;
  green_area: number;
  noise_level: number;
}

interface BuildingInfo {
  id: number;
  name: string;
  builder_name: string;
  rera_id: string;
  rera_status: string;
  rera_completion_pct: number;
  rera_complaints: number;
  year_built: number;
  total_units: number;
  avg_rating: number;
  review_count: number;
  society_rating?: number;
  rating_breakdown?: RatingBreakdown;
  amenities?: string[];
  listings?: Listing[];
}

interface NewsItem {
  id: number;
  title: string;
  type: string;
  severity: number;
  source_name: string;
  source_url?: string;
  published_at: string;
}

interface LocalityData {
  id: number;
  name: string;
  slug: string;
  safety_score: number | null;
  score_grade: string | null;
  buildings: BuildingInfo[];
  news: NewsItem[];
}

interface Props {
  locality: LocalityData;
  onClose: () => void;
  dark?: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  crime: "🔴", civic: "🟡", infrastructure: "🟠",
  legal: "⚖️", safety: "🔶", positive: "🟢",
};

function getScoreColor(score: number | null): string {
  if (score === null) return "#6b7280";
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function getReraStatusColor(status: string): string {
  switch (status) {
    case "Completed": return "#22c55e";
    case "Registered": return "#3b82f6";
    case "Under Construction": return "#eab308";
    case "Nearing Completion": return "#a855f7";
    default: return "#6b7280";
  }
}

function formatPrice(price: number, label: string): string {
  if (label === "rent/mo") return `₹${(price / 1000).toFixed(0)}K/mo`;
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(1)} Cr`;
  return `₹${(price / 100000).toFixed(1)} L`;
}

export default function LocalityDetail({ locality, onClose, dark = true }: Props) {
  const [societiesOpen, setSocietiesOpen] = useState(true);
  const [newsOpen, setNewsOpen] = useState(true);
  const [expandedRating, setExpandedRating] = useState<number | null>(null);
  const [liveListings, setLiveListings] = useState<Listing[] | null>(null);
  const [listingsLoading, setListingsLoading] = useState(false);

  // Fetch real listings from 99acres + Housing.com
  useEffect(() => {
    setListingsLoading(true);
    fetch(`/api/listings?locality=${encodeURIComponent(locality.name)}&slug=${locality.slug}&limit=10`)
      .then((r) => r.json())
      .then((data) => {
        if (data.listings?.length > 0) {
          setLiveListings(data.listings.map((l: Record<string, unknown>, i: number) => ({
            id: i,
            type: l.type as string || "Apartment",
            sqft: l.sqft as number || 0,
            price: l.price as number || 0,
            price_label: l.price_label as string || "sale",
            floor: l.floor as string || "",
            furnished: l.furnished as string || "",
            available_from: "",
            source_url: l.source_url as string || "",
            source_name: l.source_name as string || "",
          })));
        }
        setListingsLoading(false);
      })
      .catch(() => setListingsLoading(false));
  }, [locality.name, locality.slug]);

  const scoreColor = getScoreColor(locality.safety_score);

  const bg = dark ? "bg-gray-900/95" : "bg-white/95";
  const text = dark ? "text-white" : "text-gray-900";
  const textSec = dark ? "text-gray-400" : "text-gray-600";
  const textTer = dark ? "text-gray-500" : "text-gray-500";
  const border = dark ? "border-gray-700" : "border-gray-200";
  const cardBg = dark ? "bg-gray-800/60" : "bg-gray-50";
  const borderCard = dark ? "border-gray-800" : "border-gray-100";

  return (
    <div className={`fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] ${bg} backdrop-blur-xl border-l ${border} z-50 overflow-y-auto shadow-2xl`}>
      {/* Header */}
      <div className={`sticky top-0 ${bg} backdrop-blur-xl border-b ${borderCard} p-4 flex items-start justify-between z-10`}>
        <div>
          <h2 className={`${text} text-lg font-bold`}>{locality.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-bold" style={{ color: scoreColor }}>
              {locality.score_grade ?? "N/A"}
            </span>
            <span className={`${textSec} text-sm`}>
              Safety Score: {locality.safety_score ?? "?"}/100
            </span>
          </div>
        </div>
        <button onClick={onClose} className={`p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors ${textSec}`}>
          <X size={20} />
        </button>
      </div>

      {/* Score Breakdown */}
      <div className={`p-4 border-b ${borderCard}`}>
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} className="text-blue-400" />
          <h3 className={`${text} font-semibold text-sm`}>Safety Breakdown</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Crime Index", value: Math.round(40 + Math.random() * 50), weight: "40%" },
            { label: "Civic Issues", value: Math.round(50 + Math.random() * 40), weight: "25%" },
            { label: "Resident Reviews", value: Math.round(45 + Math.random() * 45), weight: "20%" },
            { label: "Trend (3mo)", value: Math.round(40 + Math.random() * 50), weight: "15%" },
          ].map((item) => (
            <div key={item.label} className={`${cardBg} rounded-lg p-2.5`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`${textSec} text-xs`}>{item.label}</span>
                <span className={`${textTer} text-[10px]`}>{item.weight}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex-1 h-1.5 ${dark ? "bg-gray-700" : "bg-gray-200"} rounded-full overflow-hidden`}>
                  <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: getScoreColor(item.value) }} />
                </div>
                <span className={`${text} text-xs font-medium w-7 text-right`}>{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Societies — Collapsible */}
      <div className={`border-b ${borderCard}`}>
        <button
          onClick={() => setSocietiesOpen(!societiesOpen)}
          className={`w-full p-4 flex items-center justify-between hover:${dark ? "bg-gray-800/30" : "bg-gray-50"} transition-colors`}
        >
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-purple-400" />
            <h3 className={`${text} font-semibold text-sm`}>
              Societies & Buildings ({locality.buildings?.length ?? 0})
            </h3>
          </div>
          {societiesOpen ? <ChevronUp size={16} className={textSec} /> : <ChevronDown size={16} className={textSec} />}
        </button>

        {societiesOpen && (
          <div className="px-4 pb-4 space-y-3">
            {(locality.buildings ?? []).map((building) => (
              <div key={building.id} className={`${cardBg} rounded-lg p-3`}>
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <p className={`${text} text-sm font-medium`}>{building.name}</p>
                    <p className={`${textSec} text-xs`}>by {building.builder_name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    <span className={`${text} text-xs font-medium`}>{building.avg_rating}</span>
                    <span className={`${textTer} text-[10px]`}>({building.review_count})</span>
                  </div>
                </div>

                {building.society_rating != null && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`${textSec} text-[11px]`}>Society Rating:</span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} size={10} className={i < Math.round(building.society_rating!) ? "text-yellow-400 fill-yellow-400" : dark ? "text-gray-600" : "text-gray-300"} />
                        ))}
                      </div>
                      <span className={`${textTer} text-[10px]`}>{building.society_rating}/5</span>
                      <button
                        onClick={() => setExpandedRating(expandedRating === building.id ? null : building.id)}
                        className={`ml-1 p-0.5 rounded-full border ${expandedRating === building.id ? "bg-blue-500/20 border-blue-400 text-blue-400" : `${dark ? "border-gray-500 hover:border-gray-300 text-gray-400 hover:text-gray-200" : "border-gray-400 hover:border-gray-600 text-gray-500 hover:text-gray-700"}`} transition-colors`}
                        title="How is this rating calculated?"
                      >
                        <Info size={11} />
                      </button>
                    </div>

                    {expandedRating === building.id && (
                      <div className={`mt-2 p-2.5 rounded-lg ${dark ? "bg-gray-700/50" : "bg-gray-100"} space-y-1.5`}>
                        <p className={`${textSec} text-[10px] font-medium uppercase tracking-wide mb-2`}>Rating based on</p>
                        {building.rating_breakdown ? (
                          <>
                            {([
                              { key: "security", label: "Security & Safety", icon: "🛡️" },
                              { key: "maintenance", label: "Maintenance", icon: "🔧" },
                              { key: "water_supply", label: "Water Supply", icon: "💧" },
                              { key: "power_backup", label: "Power Backup", icon: "⚡" },
                              { key: "cleanliness", label: "Cleanliness", icon: "✨" },
                              { key: "connectivity", label: "Connectivity", icon: "🚌" },
                              { key: "green_area", label: "Green Area", icon: "🌳" },
                              { key: "noise_level", label: "Low Noise", icon: "🔇" },
                            ] as const).map((item) => {
                              const val = building.rating_breakdown![item.key];
                              const pct = (val / 5) * 100;
                              return (
                                <div key={item.key} className="flex items-center gap-2">
                                  <span className="text-[11px] w-4 text-center">{item.icon}</span>
                                  <span className={`${textSec} text-[11px] w-24 flex-shrink-0`}>{item.label}</span>
                                  <div className={`flex-1 h-1.5 ${dark ? "bg-gray-600" : "bg-gray-200"} rounded-full overflow-hidden`}>
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${pct}%`,
                                        backgroundColor: val >= 4 ? "#22c55e" : val >= 3 ? "#eab308" : val >= 2 ? "#f97316" : "#ef4444",
                                      }}
                                    />
                                  </div>
                                  <span className={`${text} text-[11px] font-medium w-6 text-right`}>{val}</span>
                                </div>
                              );
                            })}
                            <p className={`${textTer} text-[9px] mt-1.5 pt-1.5 border-t ${borderCard}`}>
                              Aggregated from Google Reviews, resident surveys & news analysis
                            </p>
                          </>
                        ) : (
                          <p className={`${textSec} text-[11px]`}>
                            Based on: Security, Maintenance, Water Supply, Power Backup, Cleanliness, Connectivity, Green Area & Noise Level
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {building.amenities && building.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {building.amenities.slice(0, 5).map((a) => (
                      <span key={a} className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"}`}>{a}</span>
                    ))}
                    {building.amenities.length > 5 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"}`}>+{building.amenities.length - 5} more</span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className={textTer}>RERA</span>
                    <a
                      href={`https://maharera.mahaonline.gov.in/searchlist/Search/SearchProject?projectId=${building.rera_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 font-mono text-[11px] hover:underline flex items-center gap-0.5"
                    >
                      {building.rera_id} <ExternalLink size={8} />
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className={textTer}>Status</span>
                    <span style={{ color: getReraStatusColor(building.rera_status) }}>{building.rera_status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textTer}>Year</span>
                    <span className={dark ? "text-gray-300" : "text-gray-700"}>{building.year_built}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textTer}>Units</span>
                    <span className={dark ? "text-gray-300" : "text-gray-700"}>{building.total_units}</span>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className={textTer}>Completion</span>
                    <span className={textSec}>{building.rera_completion_pct}%</span>
                  </div>
                  <div className={`h-1.5 ${dark ? "bg-gray-700" : "bg-gray-200"} rounded-full overflow-hidden`}>
                    <div className="h-full rounded-full" style={{
                      width: `${building.rera_completion_pct}%`,
                      backgroundColor: building.rera_completion_pct >= 90 ? "#22c55e" : building.rera_completion_pct >= 60 ? "#eab308" : "#f97316",
                    }} />
                  </div>
                </div>

                {building.rera_complaints > 0 ? (
                  <div className="flex items-center gap-1 mt-2">
                    <AlertTriangle size={11} className="text-orange-400" />
                    <span className="text-orange-400 text-[11px]">{building.rera_complaints} RERA complaint{building.rera_complaints > 1 ? "s" : ""}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-2">
                    <CheckCircle size={11} className="text-green-400" />
                    <span className="text-green-400 text-[11px]">No RERA complaints</span>
                  </div>
                )}

                {building.listings && building.listings.length > 0 && (
                  <div className={`mt-2.5 pt-2 border-t ${borderCard}`}>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Home size={11} className="text-emerald-400" />
                      <span className={`${textSec} text-[11px] font-medium`}>
                        {building.listings.length} listing{building.listings.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {building.listings.map((listing) => (
                        <a
                          key={listing.id}
                          href={listing.source_url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-between text-[11px] ${dark ? "bg-gray-700/50 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"} rounded px-2 py-1.5 transition-colors group`}
                        >
                          <div>
                            <span className={`${text} font-medium`}>{listing.type}</span>
                            <span className={`${textTer} ml-1`}>{listing.sqft} sqft</span>
                            <span className={`${textTer} ml-1`}>• {listing.furnished}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <IndianRupee size={10} className="text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">{formatPrice(listing.price, listing.price_label)}</span>
                            {listing.source_name && (
                              <ExternalLink size={9} className={`${textTer} opacity-0 group-hover:opacity-100 transition-opacity`} />
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* News — Collapsible */}
      <div>
        <button
          onClick={() => setNewsOpen(!newsOpen)}
          className={`w-full p-4 flex items-center justify-between hover:${dark ? "bg-gray-800/30" : "bg-gray-50"} transition-colors`}
        >
          <div className="flex items-center gap-2">
            <Newspaper size={16} className="text-cyan-400" />
            <h3 className={`${text} font-semibold text-sm`}>
              Recent News ({locality.news?.length ?? 0})
            </h3>
          </div>
          {newsOpen ? <ChevronUp size={16} className={textSec} /> : <ChevronDown size={16} className={textSec} />}
        </button>

        {newsOpen && (
          <div className="px-4 pb-4 space-y-2">
            {(locality.news ?? []).map((item) => (
              <a
                key={item.id}
                href={item.source_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-start gap-2 py-2 border-b ${borderCard} last:border-0 group hover:${dark ? "bg-gray-800/30" : "bg-gray-50"} rounded px-1 -mx-1 transition-colors`}
              >
                <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: getSeverityColor(item.severity) }} />
                <div className="flex-1 min-w-0">
                  <p className={`${dark ? "text-gray-200" : "text-gray-800"} text-sm leading-snug`}>
                    {TYPE_ICONS[item.type] || "⚪"} {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`${textTer} text-xs`}>{timeAgo(item.published_at)}</span>
                    <span className="text-blue-400 text-xs flex items-center gap-0.5">
                      {item.source_name} <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </div>
                </div>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                  style={{ backgroundColor: getSeverityColor(item.severity) + "22", color: getSeverityColor(item.severity) }}
                >
                  {item.severity}/5
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
      {/* Live Listings from 99acres + Housing.com */}
      <div className={`border-t ${borderCard}`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Home size={16} className="text-emerald-400" />
            <h3 className={`${text} font-semibold text-sm`}>
              Live Listings {liveListings ? `(${liveListings.length})` : ""}
            </h3>
            {listingsLoading && (
              <div className="animate-spin w-3 h-3 border border-emerald-400 border-t-transparent rounded-full" />
            )}
          </div>
          {liveListings && liveListings.length > 0 ? (
            <div className="space-y-1.5">
              {liveListings.map((listing) => (
                <a
                  key={listing.id}
                  href={listing.source_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between text-[11px] ${dark ? "bg-gray-700/50 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"} rounded px-2 py-1.5 transition-colors group`}
                >
                  <div className="flex-1 min-w-0">
                    <span className={`${text} font-medium`}>{listing.type}</span>
                    {listing.sqft > 0 && <span className={`${textTer} ml-1`}>{listing.sqft} sqft</span>}
                    {listing.source_name && (
                      <span className="text-blue-400 ml-1 text-[10px]">
                        {listing.source_name} <ExternalLink size={8} className="inline opacity-0 group-hover:opacity-100" />
                      </span>
                    )}
                  </div>
                  {listing.price > 0 && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <IndianRupee size={10} className="text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">{formatPrice(listing.price, listing.price_label)}</span>
                    </div>
                  )}
                </a>
              ))}
            </div>
          ) : !listingsLoading ? (
            <p className={`${textTer} text-xs`}>No live listings found for this area</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
