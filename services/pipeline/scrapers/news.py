"""
News scraper pipeline: RSS ingestion → article extraction → AI classification → geocoding → storage
"""

import asyncio
import logging
from datetime import datetime, timezone

import feedparser
import httpx
from trafilatura import extract

logger = logging.getLogger(__name__)

PUNE_RSS_FEEDS = [
    {"name": "Times of India Pune", "url": "https://timesofindia.indiatimes.com/rssfeeds/2950987.cms"},
    {"name": "Indian Express Pune", "url": "https://indianexpress.com/section/cities/pune/feed/"},
    {"name": "Hindustan Times Pune", "url": "https://www.hindustantimes.com/feeds/rss/cities/pune/rssfeed.xml"},
    {"name": "Pune Mirror", "url": "https://punemirror.com/rss/pune-news.xml"},
    {"name": "Free Press Journal Pune", "url": "https://www.freepressjournal.in/pune/rss"},
]


async def fetch_feed(client: httpx.AsyncClient, feed: dict) -> list[dict]:
    """Fetch and parse a single RSS feed."""
    try:
        response = await client.get(feed["url"], timeout=15.0)
        parsed = feedparser.parse(response.text)
        articles = []
        for entry in parsed.entries[:20]:
            articles.append({
                "title": entry.get("title", ""),
                "url": entry.get("link", ""),
                "published": entry.get("published", ""),
                "source_name": feed["name"],
                "summary": entry.get("summary", ""),
            })
        return articles
    except Exception as e:
        logger.warning(f"Failed to fetch {feed['name']}: {e}")
        return []


async def extract_article_text(client: httpx.AsyncClient, url: str) -> str:
    """Download and extract main text content from article URL."""
    try:
        response = await client.get(url, timeout=15.0, follow_redirects=True)
        text = extract(response.text)
        return text[:2000] if text else ""
    except Exception as e:
        logger.warning(f"Failed to extract article {url}: {e}")
        return ""


async def fetch_all_feeds() -> list[dict]:
    """Fetch all RSS feeds concurrently."""
    async with httpx.AsyncClient(
        headers={"User-Agent": "LocalityAudit/1.0 (news aggregator)"}
    ) as client:
        tasks = [fetch_feed(client, feed) for feed in PUNE_RSS_FEEDS]
        results = await asyncio.gather(*tasks)
        all_articles = []
        for articles in results:
            all_articles.extend(articles)
        return all_articles


async def run_news_pipeline():
    """Main pipeline: fetch → extract → classify → geocode → store."""
    from ai.classifier import classify_article
    from db.database import get_session

    logger.info("Starting news pipeline...")
    articles = await fetch_all_feeds()
    logger.info(f"Fetched {len(articles)} articles from {len(PUNE_RSS_FEEDS)} feeds")

    async with httpx.AsyncClient() as client:
        for article in articles:
            try:
                body = await extract_article_text(client, article["url"])
                if not body:
                    continue

                classification = await classify_article(
                    title=article["title"],
                    body=body,
                    source=article["source_name"],
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
                                "title": article["title"],
                                "summary": classification.get("summary", ""),
                                "type": classification["type"],
                                "severity": classification["severity"],
                                "locality_name": classification.get("locality", ""),
                                "lat": classification.get("latitude", 18.52),
                                "lng": classification.get("longitude", 73.85),
                                "source_url": article["url"],
                                "source_name": article["source_name"],
                                "published_at": datetime.now(timezone.utc),
                            },
                        )
            except Exception as e:
                logger.error(f"Error processing article '{article['title']}': {e}")
                continue

    logger.info("News pipeline complete.")
