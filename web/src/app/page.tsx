"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import { Sun, Moon } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import LocalityDetail from "@/components/LocalityDetail";
import ViewportStatsBar from "@/components/ViewportStatsBar";

const SafetyMap = dynamic(() => import("@/components/SafetyMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading map...</p>
      </div>
    </div>
  ),
});

interface LocalityData {
  id: number;
  name: string;
  slug: string;
  safety_score: number | null;
  score_grade: string | null;
  buildings: Array<{
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
    amenities?: string[];
    listings?: Array<{
      id: number;
      type: string;
      sqft: number;
      price: number;
      price_label: string;
      floor: string;
      furnished: string;
      available_from: string;
    }>;
  }>;
  news: Array<{
    id: number;
    title: string;
    type: string;
    severity: number;
    source_name: string;
    published_at: string;
  }>;
}

export default function Home() {
  const [selectedLocality, setSelectedLocality] = useState<LocalityData | null>(null);
  const [selectedSociety, setSelectedSociety] = useState<Record<string, unknown> | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [nearbyBuilding, setNearbyBuilding] = useState<Record<string, unknown> | null>(null);
  const [dark, setDark] = useState(true);
  const [societyBreakdownOpen, setSocietyBreakdownOpen] = useState(false);
  const [viewportBounds, setViewportBounds] = useState<{ minLat: number; maxLat: number; minLng: number; maxLng: number } | null>(null);
  const [viewportZoom, setViewportZoom] = useState(12);

  const handleLocalityClick = useCallback((locality: LocalityData) => {
    setSelectedSociety(null);
    setSelectedLocality(locality);
  }, []);

  const handleSocietyClick = useCallback((society: Record<string, unknown>) => {
    setSelectedLocality(null);
    setSelectedSociety(society);
    setSocietyBreakdownOpen(false);
  }, []);

  const handleLocationDetected = useCallback((lat: number, lng: number) => {
    fetch(`/api/buildings/nearest?lat=${lat}&lng=${lng}&radius=500`)
      .then((r) => r.json())
      .then((data) => {
        if (data.nearest) {
          setNearbyBuilding(data.nearest);
        }
      })
      .catch(() => {});
  }, []);

  const handleViewportChange = useCallback(
    (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }, zoom: number) => {
      setViewportBounds(bounds);
      setViewportZoom(zoom);
    },
    []
  );

  const handleSearch = useCallback(
    (result: { name: string; type: string; lat?: number; lng?: number }) => {
      if (result.lat && result.lng) {
        setFlyTo({ lat: result.lat, lng: result.lng, zoom: result.type === "building" ? 17 : 15 });
      }
    },
    []
  );

  const legendBg = dark ? "bg-gray-900/80" : "bg-white/90";
  const legendBorder = dark ? "border-gray-700" : "border-gray-300";
  const legendText = dark ? "text-gray-300" : "text-gray-700";
  const legendLabel = dark ? "text-gray-300" : "text-gray-600";

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-gray-900">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <SafetyMap
          onLocalityClick={handleLocalityClick}
          onSocietyClick={handleSocietyClick}
          onLocationDetected={handleLocationDetected}
          onViewportChange={handleViewportChange}
          flyTo={flyTo}
          dark={dark}
        />
      </div>

      {/* Search overlay (top center) */}
      <div className="absolute top-4 left-4 right-4 z-40 flex flex-col items-center gap-2">
        <SearchBar onSelect={handleSearch} />
        <ViewportStatsBar bounds={viewportBounds} zoom={viewportZoom} dark={dark} />
      </div>

      {/* Dark/Light Mode Toggle (top-left) */}
      <div className="absolute top-4 left-4 z-40">
        <button
          onClick={() => setDark(!dark)}
          className={`p-2.5 rounded-xl border shadow-lg transition-all ${
            dark
              ? "bg-gray-800/90 border-gray-700 text-yellow-400 hover:bg-gray-700"
              : "bg-white/90 border-gray-300 text-gray-700 hover:bg-gray-100"
          }`}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Nearby building card (bottom right) */}
      {nearbyBuilding && !selectedLocality && (
        <div className={`absolute bottom-6 right-4 z-30 ${dark ? "bg-gray-900/90 border-gray-700" : "bg-white/90 border-gray-300"} backdrop-blur-lg border rounded-lg p-3 max-w-[260px]`}>
          <p className={`${dark ? "text-gray-400" : "text-gray-500"} text-[10px] uppercase tracking-wide mb-1`}>You are near</p>
          <p className={`${dark ? "text-white" : "text-gray-900"} text-sm font-semibold`}>{nearbyBuilding.name as string}</p>
          <p className={`${dark ? "text-gray-400" : "text-gray-600"} text-xs mt-0.5`}>
            {nearbyBuilding.builder_name as string} • {nearbyBuilding.locality_name as string}
          </p>
          <p className={`${dark ? "text-gray-500" : "text-gray-500"} text-xs mt-0.5`}>
            {nearbyBuilding.distance_meters as number}m away
          </p>
        </div>
      )}

      {/* Legend (bottom left) */}
      <div className={`absolute bottom-6 left-4 z-30 ${legendBg} backdrop-blur-sm border ${legendBorder} rounded-lg p-2.5 text-xs`}>
        <p className={`${legendText} font-medium mb-1.5 text-[11px] uppercase tracking-wide`}>Safety Rating</p>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-3 h-3 rounded-sm bg-green-500 opacity-70" />
          <span className={legendLabel}>Safe (80+)</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-3 h-3 rounded-sm bg-yellow-500 opacity-70" />
          <span className={legendLabel}>Moderate (60-79)</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-3 h-3 rounded-sm bg-orange-500 opacity-70" />
          <span className={legendLabel}>Caution (40-59)</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-3 h-3 rounded-sm bg-red-500 opacity-70" />
          <span className={legendLabel}>Unsafe (&lt;40)</span>
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-3 h-3 rounded-sm bg-gray-500 opacity-70" />
          <span className={legendLabel}>No data</span>
        </div>
        <div className={`border-t ${legendBorder} pt-1.5 mt-1`}>
          <p className={`${legendText} font-medium mb-1 text-[11px] uppercase tracking-wide`}>Markers</p>
          <div className="flex items-center gap-1.5 mb-1">
            <svg width="12" height="14" viewBox="0 0 32 40"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#6b7280" stroke="#fff" strokeWidth="2"/></svg>
            <span className={legendLabel}>Locality</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4" fill="#6b7280" stroke="#fff" strokeWidth="2"/></svg>
            <span className={legendLabel}>Society (zoom in)</span>
          </div>
        </div>
      </div>

      {/* Locality Detail Panel */}
      {selectedLocality && (
        <LocalityDetail
          locality={selectedLocality}
          onClose={() => setSelectedLocality(null)}
          dark={dark}
        />
      )}

      {/* Society Detail Panel */}
      {selectedSociety && (() => {
        const cardBgS = dark ? "bg-gray-800/60" : "bg-gray-50";
        const textS = dark ? "text-white" : "text-gray-900";
        const textSecS = dark ? "text-gray-400" : "text-gray-600";
        const textTerS = dark ? "text-gray-500" : "text-gray-500";
        const borderCardS = dark ? "border-gray-800" : "border-gray-100";
        const rb = selectedSociety.rating_breakdown as Record<string, number> | undefined;

        return (
        <div className={`fixed right-0 top-0 bottom-0 w-[400px] max-w-[90vw] ${dark ? "bg-gray-900/95" : "bg-white/95"} backdrop-blur-xl border-l ${dark ? "border-gray-700" : "border-gray-200"} z-50 overflow-y-auto shadow-2xl`}>
          <div className={`sticky top-0 ${dark ? "bg-gray-900/95" : "bg-white/95"} backdrop-blur-xl border-b ${dark ? "border-gray-800" : "border-gray-100"} p-4 flex items-start justify-between z-10`}>
            <div>
              <h2 className={`${textS} text-lg font-bold`}>{selectedSociety.name as string}</h2>
              <p className={`${textSecS} text-xs mt-0.5`}>
                by {selectedSociety.builder_name as string} • {selectedSociety.locality_name as string}
              </p>
            </div>
            <button onClick={() => setSelectedSociety(null)} className={`p-1.5 hover:bg-gray-800/50 rounded-lg ${textSecS}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Society Rating + Breakdown */}
            <div className={`${cardBgS} rounded-lg p-3`}>
              <div className="flex items-center justify-between">
                <span className={`${textSecS} text-sm`}>Society Rating</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < Math.round(selectedSociety.society_rating as number || 3) ? "#facc15" : dark ? "#374151" : "#d1d5db"} stroke="none">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                  <span className={`${textS} text-sm font-bold ml-1`}>{selectedSociety.society_rating as number}/5</span>
                  <button
                    onClick={() => setSocietyBreakdownOpen(!societyBreakdownOpen)}
                    className={`ml-1 p-0.5 rounded-full border ${societyBreakdownOpen ? "bg-blue-500/20 border-blue-400 text-blue-400" : `${dark ? "border-gray-500 hover:border-gray-300 text-gray-400 hover:text-gray-200" : "border-gray-400 hover:border-gray-600 text-gray-500 hover:text-gray-700"}`} transition-colors`}
                    title="How is this rating calculated?"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                  </button>
                </div>
              </div>

              {societyBreakdownOpen && (
                <div className={`mt-3 pt-3 border-t ${borderCardS} space-y-1.5`}>
                  <p className={`${textTerS} text-[10px] font-medium uppercase tracking-wide mb-2`}>Rating based on</p>
                  {rb ? (
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
                      ]).map((item) => {
                        const val = rb[item.key] ?? 3;
                        const pct = (val / 5) * 100;
                        return (
                          <div key={item.key} className="flex items-center gap-2">
                            <span className="text-[12px] w-5 text-center">{item.icon}</span>
                            <span className={`${textSecS} text-[12px] w-28 flex-shrink-0`}>{item.label}</span>
                            <div className={`flex-1 h-2 ${dark ? "bg-gray-600" : "bg-gray-200"} rounded-full overflow-hidden`}>
                              <div className="h-full rounded-full" style={{
                                width: `${pct}%`,
                                backgroundColor: val >= 4 ? "#22c55e" : val >= 3 ? "#eab308" : val >= 2 ? "#f97316" : "#ef4444",
                              }} />
                            </div>
                            <span className={`${textS} text-[12px] font-medium w-7 text-right`}>{val}</span>
                          </div>
                        );
                      })}
                      <p className={`${textTerS} text-[9px] mt-2 pt-2 border-t ${borderCardS}`}>
                        Aggregated from Google Reviews, resident surveys & news analysis
                      </p>
                    </>
                  ) : (
                    <p className={`${textSecS} text-[11px]`}>
                      Based on: Security, Maintenance, Water Supply, Power Backup, Cleanliness, Connectivity, Green Area & Noise Level
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <span className={`${textSecS} text-sm`}>Google Rating</span>
                <span className={`${textS} text-sm font-bold`}>{selectedSociety.avg_rating as number}/5 ({selectedSociety.review_count as number} reviews)</span>
              </div>
            </div>

            {/* RERA Details */}
            <div className={`${cardBgS} rounded-lg p-3`}>
              <p className={`${textS} text-sm font-semibold mb-2`}>RERA Details</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className={textTerS}>RERA ID</span><p className="text-blue-400 font-mono">{selectedSociety.rera_id as string}</p></div>
                <div><span className={textTerS}>Status</span><p style={{ color: (selectedSociety.rera_status as string) === "Completed" ? "#22c55e" : "#eab308" }}>{selectedSociety.rera_status as string}</p></div>
                <div><span className={textTerS}>Year Built</span><p className={dark ? "text-gray-300" : "text-gray-700"}>{selectedSociety.year_built as number}</p></div>
                <div><span className={textTerS}>Total Units</span><p className={dark ? "text-gray-300" : "text-gray-700"}>{selectedSociety.total_units as number}</p></div>
                <div><span className={textTerS}>Completion</span><p className={dark ? "text-gray-300" : "text-gray-700"}>{selectedSociety.rera_completion_pct as number}%</p></div>
                <div><span className={textTerS}>RERA Complaints</span><p className={(selectedSociety.rera_complaints as number) > 0 ? "text-orange-400" : "text-green-400"}>{selectedSociety.rera_complaints as number}</p></div>
              </div>
            </div>

            {/* Amenities */}
            {(selectedSociety.amenities as string[])?.length > 0 && (
              <div className={`${cardBgS} rounded-lg p-3`}>
                <p className={`${textS} text-sm font-semibold mb-2`}>Amenities</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedSociety.amenities as string[]).map((a: string) => (
                    <span key={a} className={`text-xs px-2 py-1 rounded-full ${dark ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"}`}>{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Listings */}
            {(selectedSociety.listings as Array<Record<string, unknown>>)?.length > 0 && (
              <div className={`${dark ? "bg-gray-800/60" : "bg-gray-50"} rounded-lg p-3`}>
                <p className={`${dark ? "text-white" : "text-gray-900"} text-sm font-semibold mb-2`}>Available Listings</p>
                <div className="space-y-2">
                  {(selectedSociety.listings as Array<Record<string, unknown>>).map((listing, i) => (
                    <div key={i} className={`flex items-center justify-between text-xs ${dark ? "bg-gray-700/50" : "bg-gray-100"} rounded px-2.5 py-2`}>
                      <div>
                        <span className={`${dark ? "text-white" : "text-gray-900"} font-medium`}>{listing.type as string}</span>
                        <span className={`${dark ? "text-gray-400" : "text-gray-500"} ml-1.5`}>{listing.sqft as number} sqft • {listing.furnished as string}</span>
                      </div>
                      <span className="text-emerald-400 font-semibold">
                        ₹{((listing.price as number) >= 10000000 ? `${((listing.price as number) / 10000000).toFixed(1)} Cr` : `${((listing.price as number) / 100000).toFixed(0)} L`)}
                        {(listing.price_label as string) === "rent/mo" && <span className={`${dark ? "text-gray-500" : "text-gray-400"} font-normal`}>/mo</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        );
      })()}
    </main>
  );
}
