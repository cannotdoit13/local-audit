import { NextRequest, NextResponse } from "next/server";
import localitiesData from "../../../../../data/pune_localities.json";

/**
 * GET /api/localities/viewport?minLat=18.4&maxLat=18.6&minLng=73.7&maxLng=73.9
 *
 * Returns aggregated stats for all localities within the given bounding box.
 * Useful for showing summary when zoomed out.
 */

interface Locality {
  name: string;
  slug: string;
  lat: number;
  lng: number;
}

const ZONES: Record<string, { label: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  "west-pune": { label: "West Pune", minLat: 18.45, maxLat: 18.56, minLng: 73.74, maxLng: 73.82 },
  "east-pune": { label: "East Pune", minLat: 18.50, maxLat: 18.60, minLng: 73.88, maxLng: 73.98 },
  "north-pune": { label: "North Pune (PCMC)", minLat: 18.58, maxLat: 18.66, minLng: 73.74, maxLng: 73.84 },
  "central-pune": { label: "Central Pune", minLat: 18.50, maxLat: 18.54, minLng: 73.82, maxLng: 73.90 },
  "south-pune": { label: "South Pune", minLat: 18.44, maxLat: 18.50, minLng: 73.83, maxLng: 73.92 },
  "hinjewadi-belt": { label: "Hinjewadi IT Belt", minLat: 18.55, maxLat: 18.62, minLng: 73.72, maxLng: 73.78 },
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function getLocalitiesInBounds(minLat: number, maxLat: number, minLng: number, maxLng: number) {
  return (localitiesData as Locality[]).filter(
    (loc) => loc.lat >= minLat && loc.lat <= maxLat && loc.lng >= minLng && loc.lng <= maxLng
  );
}

function generateStableScore(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.round((35 + seededRandom(Math.abs(hash)) * 55) * 10) / 10;
}

function getGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
}

function aggregateLocalities(localities: Locality[]) {
  if (localities.length === 0) return null;

  const scores = localities.map((l) => generateStableScore(l.name));
  const avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;

  const crimeCount = localities.reduce((sum, l) => sum + Math.floor(seededRandom(l.name.length * 7) * 5), 0);
  const civicCount = localities.reduce((sum, l) => sum + Math.floor(seededRandom(l.name.length * 13) * 4), 0);
  const positiveCount = localities.reduce((sum, l) => sum + Math.floor(seededRandom(l.name.length * 19) * 3), 0);

  const totalBuildings = localities.reduce((sum, l) => sum + 3 + Math.floor(seededRandom(l.name.length * 31) * 5), 0);
  const totalListings = localities.reduce((sum, l) => sum + Math.floor(seededRandom(l.name.length * 37) * 4), 0);

  const breakdown = {
    crime_index: Math.round((40 + seededRandom(avgScore * 3) * 50) * 10) / 10,
    civic_score: Math.round((50 + seededRandom(avgScore * 5) * 40) * 10) / 10,
    review_score: Math.round((45 + seededRandom(avgScore * 7) * 45) * 10) / 10,
    trend: Math.round((40 + seededRandom(avgScore * 11) * 50) * 10) / 10,
  };

  return {
    locality_count: localities.length,
    localities: localities.map((l) => l.name),
    safety_score: avgScore,
    score_grade: getGrade(avgScore),
    breakdown,
    news_summary: {
      total: crimeCount + civicCount + positiveCount,
      crime: crimeCount,
      civic: civicCount,
      positive: positiveCount,
    },
    buildings: totalBuildings,
    active_listings: totalListings,
    center: {
      lat: localities.reduce((s, l) => s + l.lat, 0) / localities.length,
      lng: localities.reduce((s, l) => s + l.lng, 0) / localities.length,
    },
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const minLat = parseFloat(params.get("minLat") || "18.4");
  const maxLat = parseFloat(params.get("maxLat") || "18.7");
  const minLng = parseFloat(params.get("minLng") || "73.7");
  const maxLng = parseFloat(params.get("maxLng") || "74.0");
  const zoom = parseFloat(params.get("zoom") || "12");

  const visibleLocalities = getLocalitiesInBounds(minLat, maxLat, minLng, maxLng);

  // City-level aggregation (zoomed out)
  if (zoom < 12) {
    const allLocalities = localitiesData as Locality[];
    const aggregated = aggregateLocalities(allLocalities);
    return NextResponse.json({
      level: "city",
      label: "Pune",
      ...aggregated,
      zones: Object.entries(ZONES).map(([slug, zone]) => {
        const zoneLocs = getLocalitiesInBounds(zone.minLat, zone.maxLat, zone.minLng, zone.maxLng);
        return {
          slug,
          label: zone.label,
          ...aggregateLocalities(zoneLocs),
        };
      }).filter((z) => (z.locality_count ?? 0) > 0),
    });
  }

  // Zone-level (medium zoom)
  if (zoom < 14) {
    const matchedZones = Object.entries(ZONES)
      .filter(([, z]) =>
        z.minLat < maxLat && z.maxLat > minLat && z.minLng < maxLng && z.maxLng > minLng
      )
      .map(([slug, zone]) => {
        const zoneLocs = getLocalitiesInBounds(
          Math.max(zone.minLat, minLat), Math.min(zone.maxLat, maxLat),
          Math.max(zone.minLng, minLng), Math.min(zone.maxLng, maxLng)
        );
        return { slug, label: zone.label, ...aggregateLocalities(zoneLocs) };
      })
      .filter((z) => (z.locality_count ?? 0) > 0);

    return NextResponse.json({
      level: "zone",
      label: `${visibleLocalities.length} localities in view`,
      ...aggregateLocalities(visibleLocalities),
      zones: matchedZones,
    });
  }

  // Locality-level (zoomed in)
  return NextResponse.json({
    level: "locality",
    label: visibleLocalities.length === 1
      ? visibleLocalities[0].name
      : `${visibleLocalities.length} localities`,
    ...aggregateLocalities(visibleLocalities),
  });
}
