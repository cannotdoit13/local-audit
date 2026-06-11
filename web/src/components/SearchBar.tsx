"use client";

import { useState, useRef, useEffect } from "react";

interface SearchResult {
  id: number;
  name: string;
  slug: string;
  type: "locality" | "building";
  score?: number | null;
  grade?: string | null;
}

interface Props {
  onSelect: (result: SearchResult) => void;
}

export default function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative w-full max-w-md">
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
          placeholder="Search society or locality..."
          className="w-full pl-10 pr-4 py-2.5 bg-gray-800/90 backdrop-blur-lg border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
          {results.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              className="w-full px-4 py-2.5 text-left hover:bg-gray-700 transition-colors flex items-center justify-between"
              onClick={() => {
                onSelect(result);
                setQuery(result.name);
                setIsOpen(false);
              }}
            >
              <div>
                <p className="text-white text-sm font-medium">{result.name}</p>
                <p className="text-gray-500 text-xs capitalize">{result.type}</p>
              </div>
              {result.grade && (
                <span className="text-xs font-bold text-gray-300">
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
