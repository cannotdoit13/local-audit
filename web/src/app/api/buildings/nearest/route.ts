import { NextRequest, NextResponse } from "next/server";
import localitiesData from "../../../../../data/pune_localities.json";

const BUILDERS = [
  "Kolte-Patil Developers", "Godrej Properties", "Shapoorji Pallonji",
  "Panchshil Realty", "Kumar Properties", "Pride Purple Group",
  "Paranjape Schemes", "DSK Group", "Nyati Group", "VTP Realty",
  "Sobha Limited", "Lodha Group", "Brigade Group", "Mahindra Lifespaces",
];

const BUILDING_SUFFIXES = ["Heights", "Residency", "Park", "Towers", "Gardens", "Vista", "Enclave", "Greens", "Villas"];
const RERA_STATUSES = ["Registered", "Completed", "Under Construction", "Nearing Completion"];

interface MockBuilding {
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
  lat: number;
  lng: number;
  locality_name: string;
  locality_slug: string;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

function generateAllBuildings(): MockBuilding[] {
  const buildings: MockBuilding[] = [];
  let id = 1;

  (localitiesData as Array<{ name: string; slug: string; lat: number; lng: number }>).forEach((loc, locIdx) => {
    const rand = seededRandom(locIdx * 1000);
    const count = 3 + Math.floor(rand() * 5);

    for (let i = 0; i < count; i++) {
      const builder = BUILDERS[Math.floor(rand() * BUILDERS.length)];
      const suffix = BUILDING_SUFFIXES[Math.floor(rand() * BUILDING_SUFFIXES.length)];
      const reraStatus = RERA_STATUSES[Math.floor(rand() * RERA_STATUSES.length)];
      const year = 2016 + Math.floor(rand() * 9);
      const units = 50 + Math.floor(rand() * 400);
      const completionPct = reraStatus === "Completed" ? 100 : 40 + Math.floor(rand() * 55);
      const complaints = Math.floor(rand() * 8);
      const rating = 2.5 + rand() * 2.5;

      buildings.push({
        id: id++,
        name: `${builder.split(" ")[0]} ${suffix}`,
        builder_name: builder,
        rera_id: `P52100${20000 + Math.floor(rand() * 30000)}`,
        rera_status: reraStatus,
        rera_completion_pct: completionPct,
        rera_complaints: complaints,
        year_built: year,
        total_units: units,
        avg_rating: Math.round(rating * 10) / 10,
        review_count: 5 + Math.floor(rand() * 80),
        lat: loc.lat + (rand() - 0.5) * 0.012,
        lng: loc.lng + (rand() - 0.5) * 0.012,
        locality_name: loc.name,
        locality_slug: loc.slug,
      });
    }
  });

  return buildings;
}

const ALL_BUILDINGS = generateAllBuildings();

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  const lat = parseFloat(request.nextUrl.searchParams.get("lat") || "0");
  const lng = parseFloat(request.nextUrl.searchParams.get("lng") || "0");
  const radius = parseInt(request.nextUrl.searchParams.get("radius") || "500");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const nearby = ALL_BUILDINGS
    .map((b) => ({
      ...b,
      distance_meters: Math.round(haversineDistance(lat, lng, b.lat, b.lng)),
    }))
    .filter((b) => b.distance_meters <= radius)
    .sort((a, b) => a.distance_meters - b.distance_meters);

  const nearest = nearby[0] ?? null;

  return NextResponse.json({
    nearest,
    nearby: nearby.slice(0, 10),
    total_in_radius: nearby.length,
  });
}
