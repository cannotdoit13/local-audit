"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, MapPin } from "lucide-react";

interface SearchResult {
  id: number;
  name: string;
  slug: string;
  type: "locality" | "building";
  score?: number | null;
  grade?: string | null;
  lat?: number;
  lng?: number;
  locality_name?: string;
  builder_name?: string;
}

interface Props {
  onSelect: (result: SearchResult) => void;
}

export default function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => setResults(data.results || []))
        .catch(() => setResults([]));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search building, society, or locality..."
          className="w-full pl-10 pr-4 py-2.5 bg-gray-800/90 backdrop-blur-lg border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
          {results.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              className="w-full px-4 py-2.5 text-left hover:bg-gray-700 transition-colors flex items-center gap-3"
              onClick={() => {
                onSelect(result);
                setQuery(result.name);
                setIsOpen(false);
              }}
            >
              <div className="flex-shrink-0">
                {result.type === "building" ? (
                  <Building2 size={16} className="text-purple-400" />
                ) : (
                  <MapPin size={16} className="text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{result.name}</p>
                <p className="text-gray-500 text-xs truncate">
                  {result.type === "building" && result.locality_name
                    ? `${result.builder_name} • ${result.locality_name}`
                    : "Locality"
                  }
                </p>
              </div>
              {result.grade && (
                <span className="text-xs font-bold text-gray-300 flex-shrink-0">
                  {result.grade}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
