"""
Safety score computation engine.
Uses time-decay weighting so recent events have more impact.
"""

import math
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def time_decay(days_ago: float, half_life_days: float = 30.0) -> float:
    """Exponential decay: event from today = 1.0, half_life days ago = 0.5."""
    return math.exp(-0.693 * days_ago / half_life_days)


def normalize_score(raw: float, max_expected: float) -> float:
    """Normalize a raw accumulated score to 0-100 range using sigmoid-like function."""
    if max_expected == 0:
        return 100.0
    ratio = raw / max_expected
    return max(0.0, min(100.0, 100.0 * (1.0 - ratio)))


def compute_grade(score: float) -> str:
    """Convert numeric score to letter grade."""
    if score >= 90:
        return "A+"
    elif score >= 80:
        return "A"
    elif score >= 70:
        return "B+"
    elif score >= 60:
        return "B"
    elif score >= 50:
        return "C"
    elif score >= 40:
        return "D"
    else:
        return "F"


async def compute_locality_score(locality_id: int) -> dict:
    """
    Compute safety score for a locality.
    Returns dict with overall score, grade, and component breakdown.
    """
    from db.database import get_session
    from sqlalchemy import text

    now = datetime.now(timezone.utc)

    async with get_session() as session:
        # Fetch crime incidents (last 90 days)
        result = await session.execute(
            text("""
                SELECT severity, published_at
                FROM news_incidents
                WHERE locality_id = :lid AND type = 'crime'
                  AND published_at > NOW() - INTERVAL '90 days'
            """),
            {"lid": locality_id},
        )
        crime_raw = 0.0
        for row in result.mappings():
            days = (now - row["published_at"].replace(tzinfo=timezone.utc)).total_seconds() / 86400
            crime_raw += row["severity"] * time_decay(days)

        # Fetch civic complaints
        result = await session.execute(
            text("""
                SELECT severity, published_at
                FROM news_incidents
                WHERE locality_id = :lid AND type IN ('civic', 'infrastructure')
                  AND published_at > NOW() - INTERVAL '90 days'
            """),
            {"lid": locality_id},
        )
        civic_raw = 0.0
        for row in result.mappings():
            days = (now - row["published_at"].replace(tzinfo=timezone.utc)).total_seconds() / 86400
            civic_raw += row["severity"] * time_decay(days)

        # Fetch review sentiment for security theme
        result = await session.execute(
            text("""
                SELECT AVG(sentiment_score) as avg_sentiment
                FROM reviews r
                JOIN buildings b ON r.building_id = b.id
                WHERE b.locality_id = :lid
                  AND r.themes::text LIKE '%security%'
            """),
            {"lid": locality_id},
        )
        row = result.mappings().first()
        review_sentiment = float(row["avg_sentiment"]) if row and row["avg_sentiment"] else 0.5

    # Sub-scores (0-100, higher = safer)
    crime_score = normalize_score(crime_raw, max_expected=25.0)
    civic_score = normalize_score(civic_raw, max_expected=15.0)
    review_score = review_sentiment * 100  # 0 to 1 → 0 to 100

    # Weighted composite
    weights = {"crime": 0.40, "civic": 0.25, "reviews": 0.20, "trend": 0.15}
    trend_score = 60.0  # Default neutral, computed from historical comparison

    final_score = (
        weights["crime"] * crime_score
        + weights["civic"] * civic_score
        + weights["reviews"] * review_score
        + weights["trend"] * trend_score
    )

    return {
        "score": round(final_score, 1),
        "grade": compute_grade(final_score),
        "components": {
            "crime": round(crime_score, 1),
            "civic": round(civic_score, 1),
            "reviews": round(review_score, 1),
            "trend": round(trend_score, 1),
        },
        "weights": weights,
    }


async def recompute_all_scores():
    """Recompute safety scores for all localities."""
    from db.database import get_session
    from sqlalchemy import text

    logger.info("Recomputing all locality scores...")

    async with get_session() as session:
        result = await session.execute(text("SELECT id, name FROM localities"))
        localities = result.mappings().all()

    for locality in localities:
        try:
            score_data = await compute_locality_score(locality["id"])

            async with get_session() as session:
                await session.execute(
                    text("""
                        UPDATE localities
                        SET safety_score = :score,
                            score_grade = :grade,
                            score_components = :components,
                            updated_at = NOW()
                        WHERE id = :lid
                    """),
                    {
                        "score": score_data["score"],
                        "grade": score_data["grade"],
                        "components": str(score_data["components"]),
                        "lid": locality["id"],
                    },
                )

                # Store in history for trend analysis
                await session.execute(
                    text("""
                        INSERT INTO score_history (locality_id, score, score_components)
                        VALUES (:lid, :score, :components)
                    """),
                    {
                        "lid": locality["id"],
                        "score": score_data["score"],
                        "components": str(score_data["components"]),
                    },
                )

            logger.info(f"  {locality['name']}: {score_data['grade']} ({score_data['score']})")
        except Exception as e:
            logger.error(f"  Failed for {locality['name']}: {e}")

    logger.info("Score recomputation complete.")
