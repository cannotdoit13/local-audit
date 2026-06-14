"""
Twitter/X scraper: Fetches tweets mentioning Pune civic handles for
real-time complaint and incident tracking.

Uses Twitter API v2 free tier (requires TWITTER_BEARER_TOKEN in .env).
Falls back to scraping Nitter if no token is available.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

TWITTER_BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN", "")

# Pune civic and safety handles people complain to
PUNE_HANDLES = [
    "@PMCPune",
    "@PuneCityPolice",
    "@CPPuneCity",
    "@SmartPune",
    "@PuneTrafficPol",
    "@puaboregion",
]

SEARCH_QUERIES = [
    "pune crime -is:retweet lang:en",
    "pune safety -is:retweet lang:en",
    "pune water supply -is:retweet lang:en",
    "pune traffic accident -is:retweet lang:en",
    "pune builder fraud RERA -is:retweet lang:en",
    "(to:PMCPune OR to:PuneCityPolice) -is:retweet",
    "pune pothole OR waterlogging OR power cut -is:retweet lang:en",
]


async def fetch_tweets_api(
    client: httpx.AsyncClient,
    query: str,
    max_results: int = 10,
) -> list[dict]:
    """Fetch tweets using Twitter API v2."""
    if not TWITTER_BEARER_TOKEN:
        return []

    try:
        response = await client.get(
            "https://api.twitter.com/2/tweets/search/recent",
            params={
                "query": query,
                "max_results": min(max_results, 100),
                "tweet.fields": "created_at,public_metrics,text,author_id",
            },
            headers={
                "Authorization": f"Bearer {TWITTER_BEARER_TOKEN}",
                "User-Agent": "LocalityAudit/1.0",
            },
            timeout=15.0,
        )

        if response.status_code != 200:
            logger.warning(f"Twitter API returned {response.status_code} for query: {query[:50]}")
            return []

        data = response.json()
        tweets = []
        for tweet in data.get("data", []):
            metrics = tweet.get("public_metrics", {})
            tweets.append({
                "title": tweet["text"][:120],
                "body": tweet["text"],
                "url": f"https://twitter.com/i/web/status/{tweet['id']}",
                "source_name": "Twitter/X",
                "created_at": tweet.get("created_at", ""),
                "likes": metrics.get("like_count", 0),
                "retweets": metrics.get("retweet_count", 0),
                "replies": metrics.get("reply_count", 0),
            })

        return tweets

    except Exception as e:
        logger.warning(f"Twitter API error for '{query[:50]}': {e}")
        return []


async def fetch_nitter_fallback(
    client: httpx.AsyncClient,
    query: str,
) -> list[dict]:
    """Fallback: search Nitter instance for tweets (no API key needed)."""
    nitter_instances = [
        "https://nitter.net",
        "https://nitter.privacydev.net",
    ]

    for instance in nitter_instances:
        try:
            response = await client.get(
                f"{instance}/search",
                params={"f": "tweets", "q": query},
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=10.0,
                follow_redirects=True,
            )
            if response.status_code == 200:
                # Basic extraction from Nitter HTML
                from trafilatura import extract
                text = extract(response.text)
                if text:
                    lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 30]
                    return [
                        {
                            "title": line[:120],
                            "body": line,
                            "url": f"{instance}/search?q={query}",
                            "source_name": "Twitter/X (via Nitter)",
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "likes": 0,
                            "retweets": 0,
                            "replies": 0,
                        }
                        for line in lines[:5]
                    ]
        except Exception:
            continue

    return []


async def fetch_all_tweets() -> list[dict]:
    """Fetch tweets from all queries."""
    async with httpx.AsyncClient() as client:
        all_tweets: list[dict] = []
        seen_urls: set[str] = set()

        for query in SEARCH_QUERIES:
            if TWITTER_BEARER_TOKEN:
                tweets = await fetch_tweets_api(client, query, max_results=10)
            else:
                tweets = await fetch_nitter_fallback(client, query)

            for tweet in tweets:
                if tweet["url"] not in seen_urls:
                    seen_urls.add(tweet["url"])
                    all_tweets.append(tweet)

            await asyncio.sleep(2)

        return all_tweets


async def run_twitter_pipeline():
    """Main pipeline: fetch tweets -> classify -> store."""
    from ai.classifier import classify_article
    from db.database import get_session

    logger.info("Starting Twitter pipeline...")
    tweets = await fetch_all_tweets()
    logger.info(f"Fetched {len(tweets)} unique tweets")

    for tweet in tweets:
        try:
            if len(tweet["body"].strip()) < 30:
                continue

            classification = await classify_article(
                title=tweet["title"],
                body=tweet["body"],
                source=tweet["source_name"],
            )

            if classification and classification.get("type") != "other":
                from sqlalchemy import text as sql_text

                async with get_session() as session:
                    await session.execute(
                        sql_text("""
                            INSERT INTO news_incidents
                                (title, summary, type, severity, locality_name,
                                 latitude, longitude, location, source_url, source_name, published_at)
                            VALUES
                                (:title, :summary, :type, :severity, :locality_name,
                                 :lat, :lng, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
                                 :source_url, :source_name, :published_at)
                            ON CONFLICT DO NOTHING
                        """),
                        {
                            "title": tweet["title"],
                            "summary": classification.get("summary", ""),
                            "type": classification["type"],
                            "severity": classification["severity"],
                            "locality_name": classification.get("locality", ""),
                            "lat": classification.get("latitude", 18.52),
                            "lng": classification.get("longitude", 73.85),
                            "source_url": tweet["url"],
                            "source_name": tweet["source_name"],
                            "published_at": datetime.now(timezone.utc),
                        },
                    )
        except Exception as e:
            logger.error(f"Error processing tweet '{tweet['title'][:50]}': {e}")
            continue

    logger.info("Twitter pipeline complete.")
