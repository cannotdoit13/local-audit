import { NextResponse } from "next/server";
import localitiesData from "../../../../data/pune_localities.json";

/**
 * GET /api/localities
 * Returns all localities as GeoJSON FeatureCollection.
 * In production, this proxies to the Python backend.
 * In dev, returns mock data with random scores for demo.
 */

function generateMockPolygon(lat: number, lng: number): number[][][] {
  const offset = 0.008 + Math.random() * 0.005;
  return [
    [
      [lng - offset, lat - offset],
      [lng + offset, lat - offset],
      [lng + offset, lat + offset],
      [lng - offset, lat + offset],
      [lng - offset, lat - offset],
    ],
  ];
}

function generateMockScore(): number {
  // Weighted toward moderate scores (40-80) for realism
  const base = 35 + Math.random() * 55;
  return Math.round(base * 10) / 10;
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

export async function GET() {
  const BACKEND_URL = process.env.PIPELINE_URL;

  if (BACKEND_URL) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/localities`, {
        next: { revalidate: 3600 },
      });
      const data = await res.json();
      return NextResponse.json(data);
    } catch {
      // Fall through to mock data
    }
  }

  // Mock data for development
  const features = (localitiesData as Array<{name: string; slug: string; lat: number; lng: number}>).map((loc, idx) => {
    const score = generateMockScore();
    return {
      type: "Feature" as const,
      properties: {
        id: idx + 1,
        name: loc.name,
        slug: loc.slug,
        safety_score: score,
        score_grade: getGrade(score),
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: generateMockPolygon(loc.lat, loc.lng),
      },
    };
  });

  return NextResponse.json({
    type: "FeatureCollection",
    features,
  });
}
