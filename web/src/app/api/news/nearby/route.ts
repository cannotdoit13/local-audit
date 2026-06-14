import { NextRequest, NextResponse } from "next/server";
import { fetchRSSNews } from "@/lib/scraper";

/**
 * GET /api/news/nearby?lat=18.52&lng=73.85&locality=Baner&limit=20
 * Returns real scraped news incidents from RSS feeds and Reddit.
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const locality = searchParams.get("locality") || "";
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const allArticles = await fetchRSSNews();

    let filtered = allArticles;
    if (locality) {
      filtered = allArticles.filter(
        (a) =>
          a.locality_name.toLowerCase() === locality.toLowerCase() ||
          a.title.toLowerCase().includes(locality.toLowerCase()) ||
          a.locality_name === "Pune"
      );
    }

    return NextResponse.json({
      incidents: filtered.slice(0, limit),
      total: filtered.length,
      source: "live",
    });
  } catch (error) {
    console.error("News fetch error:", error);
    return NextResponse.json({ incidents: [], total: 0, source: "error" });
  }
}
