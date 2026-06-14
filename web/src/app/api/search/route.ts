import { NextRequest, NextResponse } from "next/server";
import localitiesData from "../../../../data/pune_localities.json";

const BUILDERS = [
  "Kolte-Patil Developers", "Godrej Properties", "Shapoorji Pallonji",
  "Panchshil Realty", "Kumar Properties", "Pride Purple Group",
  "Paranjape Schemes", "DSK Group", "Nyati Group", "VTP Realty",
  "Sobha Limited", "Lodha Group", "Brigade Group", "Mahindra Lifespaces",
];

const BUILDING_SUFFIXES = ["Heights", "Residency", "Park", "Towers", "Gardens", "Vista", "Enclave", "Greens", "Villas"];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

interface BuildingResult {
  id: number;
  name: string;
  slug: string;
  type: "building";
  score: number;
  grade: string;
  lat: number;
  lng: number;
  locality_name: string;
  builder_name: string;
}

function generateBuildingResults(): BuildingResult[] {
  const buildings: BuildingResult[] = [];
  let id = 1;

  (localitiesData as Array<{ name: string; slug: string; lat: number; lng: number }>).forEach((loc, locIdx) => {
    const rand = seededRandom(locIdx * 1000);
    const count = 3 + Math.floor(rand() * 5);

    for (let i = 0; i < count; i++) {
      const builder = BUILDERS[Math.floor(rand() * BUILDERS.length)];
      const suffix = BUILDING_SUFFIXES[Math.floor(rand() * BUILDING_SUFFIXES.length)];
      const score = Math.round(40 + rand() * 50);

      buildings.push({
        id: id++,
        name: `${builder.split(" ")[0]} ${suffix}`,
        slug: `${builder.split(" ")[0].toLowerCase()}-${suffix.toLowerCase()}-${loc.slug}`,
        type: "building",
        score,
        grade: score >= 80 ? "A" : score >= 70 ? "B+" : score >= 60 ? "B" : score >= 50 ? "C" : "D",
        lat: loc.lat + (rand() - 0.5) * 0.012,
        lng: loc.lng + (rand() - 0.5) * 0.012,
        locality_name: loc.name,
        builder_name: builder,
      });
    }
  });

  return buildings;
}

const ALL_BUILDINGS = generateBuildingResults();

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.toLowerCase() || "";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Search localities
  const localityResults = (localitiesData as Array<{ name: string; slug: string; lat: number; lng: number }>)
    .filter((loc) => loc.name.toLowerCase().includes(query))
    .slice(0, 5)
    .map((loc, idx) => ({
      id: idx + 1,
      name: loc.name,
      slug: loc.slug,
      type: "locality" as const,
      score: Math.round(40 + Math.random() * 50),
      grade: "B+",
      lat: loc.lat,
      lng: loc.lng,
    }));

  // Search buildings (by name, builder, or locality)
  const buildingResults = ALL_BUILDINGS
    .filter((b) =>
      b.name.toLowerCase().includes(query) ||
      b.builder_name.toLowerCase().includes(query) ||
      b.locality_name.toLowerCase().includes(query)
    )
    .slice(0, 5);

  const results = [...localityResults, ...buildingResults].slice(0, 10);

  return NextResponse.json({ results });
}
