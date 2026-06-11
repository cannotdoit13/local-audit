"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import SearchBar from "@/components/SearchBar";
import NewsFeed from "@/components/NewsFeed";

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

export default function Home() {
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [activeLocality, setActiveLocality] = useState<{
    name: string;
    score: number | null;
    grade: string | null;
  } | null>(null);

  const handleLocationDetected = useCallback((lat: number, lng: number) => {
    setUserLocation({ lat, lng });
  }, []);

  const handleLocalityClick = useCallback(
    (locality: { name: string; safety_score: number | null; score_grade: string | null }) => {
      setActiveLocality({
        name: locality.name,
        score: locality.safety_score,
        grade: locality.score_grade,
      });
    },
    []
  );

  const handleSearch = useCallback(
    (result: { name: string; type: string; score?: number | null; grade?: string | null }) => {
      if (result.type === "locality") {
        setActiveLocality({
          name: result.name,
          score: result.score ?? null,
          grade: result.grade ?? null,
        });
      }
    },
    []
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-gray-900">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <SafetyMap
          onLocationDetected={handleLocationDetected}
          onLocalityClick={handleLocalityClick}
        />
      </div>

      {/* Search overlay (top center) */}
      <div className="absolute top-4 left-4 right-4 z-40 flex justify-center">
        <SearchBar onSelect={handleSearch} />
      </div>

      {/* Score card (top left, below search on mobile) */}
      {activeLocality && (
        <div className="absolute top-16 left-4 z-30 bg-gray-900/90 backdrop-blur-lg border border-gray-700 rounded-lg p-3 max-w-[200px]">
          <p className="text-white text-sm font-semibold">{activeLocality.name}</p>
          {activeLocality.score !== null && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-white">
                {activeLocality.grade}
              </span>
              <span className="text-gray-400 text-xs">
                {activeLocality.score}/100
              </span>
            </div>
          )}
        </div>
      )}

      {/* Legend (bottom left, above news feed) */}
      <div className="absolute bottom-[210px] left-4 z-30 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg p-2.5 text-xs">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-3 h-3 rounded-sm bg-green-500 opacity-60" />
          <span className="text-gray-300">Safe (80+)</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-3 h-3 rounded-sm bg-yellow-500 opacity-60" />
          <span className="text-gray-300">Moderate (60-79)</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-3 h-3 rounded-sm bg-orange-500 opacity-60" />
          <span className="text-gray-300">Caution (40-59)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500 opacity-60" />
          <span className="text-gray-300">Unsafe (&lt;40)</span>
        </div>
      </div>

      {/* News feed (bottom sheet) */}
      <NewsFeed
        lat={userLocation?.lat ?? null}
        lng={userLocation?.lng ?? null}
        locality={activeLocality?.name}
        score={activeLocality?.score}
        grade={activeLocality?.grade}
      />
    </main>
  );
}
