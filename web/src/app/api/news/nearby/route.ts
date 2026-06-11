import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/news/nearby?lat=18.52&lng=73.85&radius=2000&limit=20
 * Returns news incidents near a geographic point.
 * In production, proxies to Python backend PostGIS query.
 * In dev, returns mock incidents.
 */

const MOCK_INCIDENTS = [
  {
    id: 1,
    title: "Chain snatching reported on Karve Road",
    summary: "Chain snatching near Karve Road bus stop",
    type: "crime",
    severity: 4,
    source_url: "https://punemirror.com",
    published_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    locality_name: "Kothrud",
    distance_meters: 200,
  },
  {
    id: 2,
    title: "Water supply disruption in Paud Road area",
    summary: "PMC water cut for maintenance in Paud Road",
    type: "civic",
    severity: 2,
    source_url: "https://timesofindia.com",
    published_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    locality_name: "Kothrud",
    distance_meters: 500,
  },
  {
    id: 3,
    title: "New CCTV cameras installed at major junctions",
    summary: "12 new CCTV cameras near Kothrud bus depot",
    type: "positive",
    severity: 1,
    source_url: "https://indianexpress.com",
    published_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    locality_name: "Kothrud",
    distance_meters: 800,
  },
  {
    id: 4,
    title: "PMC resolves noise complaint from commercial area",
    summary: "Noise complaint resolved near Ideal Colony",
    type: "civic",
    severity: 2,
    source_url: "https://hindustantimes.com",
    published_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    locality_name: "Kothrud",
    distance_meters: 1200,
  },
  {
    id: 5,
    title: "Minor fire in electrical panel of commercial building",
    summary: "Electrical fire in Baner commercial complex, no injuries",
    type: "safety",
    severity: 3,
    source_url: "https://punemirror.com",
    published_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    locality_name: "Baner",
    distance_meters: 1500,
  },
  {
    id: 6,
    title: "Road pothole causes bike accident on DP Road",
    summary: "Biker injured due to pothole on DP Road",
    type: "infrastructure",
    severity: 3,
    source_url: "https://timesofindia.com",
    published_at: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    locality_name: "Aundh",
    distance_meters: 1800,
  },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get("lat") || "18.52");
  const lng = parseFloat(searchParams.get("lng") || "73.85");
  const radius = parseInt(searchParams.get("radius") || "2000");
  const limit = parseInt(searchParams.get("limit") || "20");

  const BACKEND_URL = process.env.PIPELINE_URL;

  if (BACKEND_URL) {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/news/nearby?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}`
      );
      const data = await res.json();
      return NextResponse.json(data);
    } catch {
      // Fall through to mock
    }
  }

  // Mock response filtered by limit
  return NextResponse.json({
    incidents: MOCK_INCIDENTS.slice(0, limit),
  });
}
