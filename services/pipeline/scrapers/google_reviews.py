"""
Google Reviews scraper: Fetches reviews for housing societies using SerpAPI.
Extracts sentiment and themes for safety scoring.

Requires SERPAPI_KEY in .env.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")

PUNE_SOCIETIES = [
    {"name": "Amanora Park Town Pune", "locality": "Hadapsar"},
    {"name": "Blue Ridge SEZ Hinjewadi Pune", "locality": "Hinjewadi"},
    {"name": "Nyati Elysia Kharadi Pune", "locality": "Kharadi"},
    {"name": "Megapolis Hinjewadi Pune", "locality": "Hinjewadi"},
    {"name": "Pride World City Charholi Pune", "locality": "PCMC"},
    {"name": "Kumar Palaash Pune", "locality": "Bavdhan"},
    {"name": "Kolte-Patil Life Republic Pune", "locality": "Hinjewadi"},
    {"name": "Godrej Infinity Keshav Nagar Pune", "locality": "Mundhwa"},
    {"name": "Panchshil Towers Kharadi Pune", "locality": "Kharadi"},
    {"name": "VTP Pegasus Kharadi Pune", "locality": "Kharadi"},
    {"name": "Bramha Skycity Baner Pune", "locality": "Baner"},
    {"name": "Marvel Arco Pune", "locality": "Undri"},
    {"name": "Goel Ganga Newtown Pune", "locality": "Dhanori"},
    {"name": "Rohan Leher Baner Pune", "locality": "Baner"},
    {"name": "Kalpataru Harmony Wakad Pune", "locality": "Wakad"},
]


async def fetch_place_reviews(
    client: httpx.AsyncClient,
    society_name: str,
    locality: str,
) -> dict | None:
    """Fetch Google Maps reviews for a society via SerpAPI."""
    if not SERPAPI_KEY:
        logger.warning("SERPAPI_KEY not set, skipping Google Reviews")
        return None

    try:
        # Step 1: Search for the place
        search_response = await client.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google_maps",
                "q": society_name,
                "type": "search",
                "api_key": SERPAPI_KEY,
            },
            timeout=20.0,
        )

        if search_response.status_code != 200:
            logger.warning(f"SerpAPI search failed for {society_name}: {search_response.status_code}")
            return None

        search_data = search_response.json()
        places = search_data.get("local_results", [])
        if not places:
            logger.info(f"No Google Maps result for {society_name}")
            return None

        place = places[0]
        data_id = place.get("data_id")
        if not data_id:
            return None

        # Step 2: Fetch reviews for this place
        reviews_response = await client.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google_maps_reviews",
                "data_id": data_id,
                "api_key": SERPAPI_KEY,
                "sort_by": "newestFirst",
                "hl": "en",
            },
            timeout=20.0,
        )

        if reviews_response.status_code != 200:
            return None

        reviews_data = reviews_response.json()
        reviews = reviews_data.get("reviews", [])

        return {
            "society_name": society_name,
            "locality": locality,
            "place_name": place.get("title", society_name),
            "rating": place.get("rating"),
            "total_reviews": place.get("reviews"),
            "gps_coordinates": place.get("gps_coordinates", {}),
            "address": place.get("address", ""),
            "reviews": [
                {
                    "author": r.get("user", {}).get("name", ""),
                    "rating": r.get("rating"),
                    "text": r.get("snippet", ""),
                    "date": r.get("date", ""),
                    "likes": r.get("likes", 0),
                }
                for r in reviews[:20]
            ],
        }

    except Exception as e:
        logger.error(f"Error fetching reviews for {society_name}: {e}")
        return None


async def classify_review_themes(review_text: str) -> dict:
    """Use AI to extract themes and sentiment from a review."""
    from ai.classifier import classify_article

    if len(review_text.strip()) < 20:
        return {"themes": [], "sentiment": 0.5}

    result = await classify_article(
        title="Google Maps Review",
        body=review_text,
        source="google_maps",
    )

    if result:
        sentiment = 1.0 - (result.get("severity", 3) - 1) / 4
        return {
            "themes": [result.get("type", "other")],
            "sentiment": round(sentiment, 2),
        }
    return {"themes": [], "sentiment": 0.5}


async def run_google_reviews_pipeline():
    """Main pipeline: fetch Google reviews -> classify -> store."""
    from db.database import get_session
    from sqlalchemy import text as sql_text

    if not SERPAPI_KEY:
        logger.warning("SERPAPI_KEY not configured, skipping Google Reviews pipeline")
        return

    logger.info("Starting Google Reviews pipeline...")

    async with httpx.AsyncClient() as client:
        for society in PUNE_SOCIETIES:
            try:
                result = await fetch_place_reviews(client, society["name"], society["locality"])
                if not result or not result.get("reviews"):
                    continue

                logger.info(f"Got {len(result['reviews'])} reviews for {result['place_name']}")

                for review in result["reviews"]:
                    if not review.get("text"):
                        continue

                    themes = await classify_review_themes(review["text"])

                    async with get_session() as session:
                        await session.execute(
                            sql_text("""
                                INSERT INTO reviews
                                    (building_id, source, author_name, rating, text,
                                     themes, sentiment_score, published_at)
                                VALUES
                                    (NULL, 'google_maps', :author, :rating, :text,
                                     :themes, :sentiment, NOW())
                                ON CONFLICT DO NOTHING
                            """),
                            {
                                "author": review["author"],
                                "rating": review["rating"],
                                "text": review["text"],
                                "themes": str(themes["themes"]),
                                "sentiment": themes["sentiment"],
                            },
                        )

                # Rate limit SerpAPI (100 searches/mo on free tier)
                await asyncio.sleep(3)

            except Exception as e:
                logger.error(f"Error processing {society['name']}: {e}")
                continue

    logger.info("Google Reviews pipeline complete.")
