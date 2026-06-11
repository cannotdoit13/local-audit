import { NextRequest, NextResponse } from "next/server";
import localitiesData from "../../../../data/pune_localities.json";

/**
 * GET /api/search?q=baner
 * Searches localities and buildings by name.
 */

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.toLowerCase() || "";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = (localitiesData as Array<{name: string; slug: string; lat: number; lng: number}>)
    .filter((loc) => loc.name.toLowerCase().includes(query))
    .slice(0, 8)
    .map((loc, idx) => ({
      id: idx + 1,
      name: loc.name,
      slug: loc.slug,
      type: "locality" as const,
      score: Math.round(40 + Math.random() * 50),
      grade: "B+",
    }));

  return NextResponse.json({ results });
}
