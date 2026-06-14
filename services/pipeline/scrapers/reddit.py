"""
Reddit scraper: Fetches posts from Pune-related subreddits,
classifies them using the AI pipeline, and stores as news incidents.

Uses Reddit's public JSON endpoints (no API key needed for read-only).
For higher rate limits, set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SUBREDDITS = [
    {"name": "pune", "search_terms": ["safety", "crime", "society", "builder", "RERA", "water", "traffic", "pollution"]},
    {"name": "IndianRealEstate", "search_terms": ["pune", "baner", "kothrud", "hinjewadi", "wakad", "hadapsar"]},
    {"name": "india", "search_terms": ["pune crime", "pune safety", "pune builder fraud"]},
]

REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")

USER_AGENT = "LocalityAudit/1.0 (pune safety aggregator)"


async def get_oauth_token(client: httpx.AsyncClient) -> str | None:
    """Get Reddit OAuth token if credentials are configured."""
    if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
        return None

    try:
        response = await client.post(
            "https://www.reddit.com/api/v1/access_token",
            data={"grant_type": "client_credentials"},
            auth=(REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET),
            headers={"User-Agent": USER_AGENT},
        )
        if response.status_code == 200:
            return response.json().get("access_token")
    except Exception as e:
        logger.warning(f"OAuth failed, falling back to public API: {e}")
    return None


async def fetch_subreddit_posts(
    client: httpx.AsyncClient,
    subreddit: str,
    search_term: str,
    token: str | None = None,
    limit: int = 10,
) -> list[dict]:
    """Fetch posts from a subreddit matching a search term."""
    try:
        if token:
            base_url = "https://oauth.reddit.com"
            headers = {"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT}
        else:
            base_url = "https://www.reddit.com"
            headers = {"User-Agent": USER_AGENT}

        url = f"{base_url}/r/{subreddit}/search.json"
        params = {
            "q": search_term,
            "restrict_sr": "on",
            "sort": "new",
            "t": "week",
            "limit": limit,
        }

        response = await client.get(url, params=params, headers=headers, timeout=15.0)
        if response.status_code != 200:
            logger.warning(f"Reddit returned {response.status_code} for r/{subreddit} q={search_term}")
            return []

        data = response.json()
        posts = []
        for child in data.get("data", {}).get("children", []):
            post = child.get("data", {})
            if not post.get("title"):
                continue

            posts.append({
                "title": post["title"],
                "body": (post.get("selftext") or "")[:2000],
                "url": f"https://reddit.com{post.get('permalink', '')}",
                "subreddit": subreddit,
                "author": post.get("author", ""),
                "score": post.get("score", 0),
                "num_comments": post.get("num_comments", 0),
                "created_utc": post.get("created_utc", 0),
                "source_name": f"r/{subreddit}",
            })

        return posts

    except Exception as e:
        logger.warning(f"Failed to fetch r/{subreddit} q={search_term}: {e}")
        return []


async def fetch_all_reddit_posts() -> list[dict]:
    """Fetch posts from all configured subreddits."""
    async with httpx.AsyncClient() as client:
        token = await get_oauth_token(client)
        if token:
            logger.info("Using Reddit OAuth API")
        else:
            logger.info("Using Reddit public JSON API (no auth)")

        tasks = []
        for sub in SUBREDDITS:
            for term in sub["search_terms"]:
                tasks.append(fetch_subreddit_posts(client, sub["name"], term, token, limit=10))
                # Rate limit: Reddit public API allows ~10 req/min
                await asyncio.sleep(1.5 if not token else 0.5)

        results = await asyncio.gather(*tasks)

        # Deduplicate by URL
        seen_urls: set[str] = set()
        all_posts: list[dict] = []
        for posts in results:
            for post in posts:
                if post["url"] not in seen_urls:
                    seen_urls.add(post["url"])
                    all_posts.append(post)

        return all_posts


async def run_reddit_pipeline():
    """Main pipeline: fetch Reddit posts -> classify -> store."""
    from ai.classifier import classify_article
    from db.database import get_session

    logger.info("Starting Reddit pipeline...")
    posts = await fetch_all_reddit_posts()
    logger.info(f"Fetched {len(posts)} unique Reddit posts")

    for post in posts:
        try:
            text_content = f"{post['title']}\n\n{post['body']}"
            if len(text_content.strip()) < 30:
                continue

            classification = await classify_article(
                title=post["title"],
                body=text_content,
                source=post["source_name"],
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
                            "title": post["title"],
                            "summary": classification.get("summary", ""),
                            "type": classification["type"],
                            "severity": classification["severity"],
                            "locality_name": classification.get("locality", ""),
                            "lat": classification.get("latitude", 18.52),
                            "lng": classification.get("longitude", 73.85),
                            "source_url": post["url"],
                            "source_name": post["source_name"],
                            "published_at": datetime.fromtimestamp(
                                post["created_utc"], tz=timezone.utc
                            ) if post["created_utc"] else datetime.now(timezone.utc),
                        },
                    )
        except Exception as e:
            logger.error(f"Error processing Reddit post '{post['title'][:50]}': {e}")
            continue

    logger.info("Reddit pipeline complete.")
