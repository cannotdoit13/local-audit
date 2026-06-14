import { NextRequest, NextResponse } from "next/server";
import { fetchListings } from "@/lib/listings-scraper";

/**
 * GET /api/listings?locality=Baner&slug=baner
 * Returns real property listings scraped from 99acres and Housing.com
 */
export async function GET(request: NextRequest) {
  const locality = request.nextUrl.searchParams.get("locality") || "Baner";
  const slug = request.nextUrl.searchParams.get("slug") || locality.toLowerCase().replace(/\s+/g, "-");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10");

  try {
    const listings = await fetchListings(locality, slug);
    return NextResponse.json({
      listings: listings.slice(0, limit),
      total: listings.length,
      source: "live",
      locality,
    });
  } catch (error) {
    console.error("Listings fetch error:", error);
    return NextResponse.json({ listings: [], total: 0, source: "error", locality });
  }
}
