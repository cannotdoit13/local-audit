from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from db.database import init_db
from scrapers.news import run_news_pipeline
from scrapers.reddit import run_reddit_pipeline
from scrapers.google_reviews import run_google_reviews_pipeline
from scrapers.twitter import run_twitter_pipeline
from ai.scorer import recompute_all_scores

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    # News RSS feeds — every 6 hours
    scheduler.add_job(run_news_pipeline, "interval", hours=6, id="news_pipeline")

    # Reddit posts — every 8 hours
    scheduler.add_job(run_reddit_pipeline, "interval", hours=8, id="reddit_pipeline")

    # Google Reviews — once daily (limited free API calls)
    scheduler.add_job(run_google_reviews_pipeline, "interval", hours=24, id="google_reviews_pipeline")

    # Twitter/X — every 6 hours
    scheduler.add_job(run_twitter_pipeline, "interval", hours=6, id="twitter_pipeline")

    # Recompute scores — every 12 hours
    scheduler.add_job(recompute_all_scores, "interval", hours=12, id="score_recompute")

    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="Locality Audit Pipeline", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/pipelines/run")
async def trigger_pipelines():
    """Manually trigger all pipelines (for dev/testing)."""
    import asyncio
    results = {}
    for name, fn in [
        ("news", run_news_pipeline),
        ("reddit", run_reddit_pipeline),
        ("twitter", run_twitter_pipeline),
        ("google_reviews", run_google_reviews_pipeline),
    ]:
        try:
            await fn()
            results[name] = "ok"
        except Exception as e:
            results[name] = f"error: {e}"
    return results


@app.get("/api/localities")
async def get_localities():
    """Return all localities with their scores and GeoJSON polygons."""
    from db.database import get_session
    from sqlalchemy import text

    async with get_session() as session:
        result = await session.execute(
            text("""
                SELECT id, name, slug, safety_score, score_grade,
                       ST_AsGeoJSON(boundary)::json as geometry
                FROM localities
                WHERE boundary IS NOT NULL
                ORDER BY name
            """)
        )
        localities = []
        for row in result.mappings():
            localities.append({
                "type": "Feature",
                "properties": {
                    "id": row["id"],
                    "name": row["name"],
                    "slug": row["slug"],
                    "safety_score": float(row["safety_score"]) if row["safety_score"] else None,
                    "score_grade": row["score_grade"],
                },
                "geometry": row["geometry"],
            })
        return {"type": "FeatureCollection", "features": localities}


@app.get("/api/buildings")
async def get_buildings(min_lat: float = 0, min_lng: float = 0, max_lat: float = 90, max_lng: float = 180):
    """Return buildings within map viewport bounds."""
    from db.database import get_session
    from sqlalchemy import text

    async with get_session() as session:
        result = await session.execute(
            text("""
                SELECT id, name, slug, score, score_grade, latitude, longitude,
                       rera_id, builder_name
                FROM buildings
                WHERE latitude BETWEEN :min_lat AND :max_lat
                  AND longitude BETWEEN :min_lng AND :max_lng
                LIMIT 500
            """),
            {"min_lat": min_lat, "min_lng": min_lng, "max_lat": max_lat, "max_lng": max_lng},
        )
        buildings = []
        for row in result.mappings():
            buildings.append({
                "type": "Feature",
                "properties": {
                    "id": row["id"],
                    "name": row["name"],
                    "slug": row["slug"],
                    "score": float(row["score"]) if row["score"] else None,
                    "score_grade": row["score_grade"],
                    "rera_id": row["rera_id"],
                    "builder_name": row["builder_name"],
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row["longitude"]), float(row["latitude"])],
                },
            })
        return {"type": "FeatureCollection", "features": buildings}


@app.get("/api/news/nearby")
async def get_news_nearby(lat: float, lng: float, radius: int = 2000, limit: int = 20):
    """Return news incidents within radius (meters) of a point."""
    from db.database import get_session
    from sqlalchemy import text

    async with get_session() as session:
        result = await session.execute(
            text("""
                SELECT id, title, summary, type, severity, source_url,
                       published_at, locality_name,
                       ST_Distance(
                           location::geography,
                           ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                       ) as distance_meters
                FROM news_incidents
                WHERE ST_DWithin(
                    location::geography,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                    :radius
                )
                ORDER BY published_at DESC
                LIMIT :limit
            """),
            {"lat": lat, "lng": lng, "radius": radius, "limit": limit},
        )
        incidents = []
        for row in result.mappings():
            incidents.append({
                "id": row["id"],
                "title": row["title"],
                "summary": row["summary"],
                "type": row["type"],
                "severity": row["severity"],
                "source_url": row["source_url"],
                "published_at": row["published_at"].isoformat() if row["published_at"] else None,
                "locality_name": row["locality_name"],
                "distance_meters": round(row["distance_meters"]),
            })
        return {"incidents": incidents}
