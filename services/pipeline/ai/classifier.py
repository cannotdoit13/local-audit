"""
AI classification pipeline: Classify news articles by type, severity, and locality.
Uses GPT-4o-mini for cost-efficient structured extraction.
"""

import json
import os
import logging

from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

PUNE_LOCALITIES = [
    "Kothrud", "Baner", "Hinjewadi", "Wakad", "Kharadi", "Viman Nagar",
    "Hadapsar", "Magarpatta", "Koregaon Park", "Aundh", "Pashan", "Bavdhan",
    "Pimple Saudagar", "Ravet", "PCMC", "Shivajinagar", "Deccan",
    "Sinhagad Road", "Warje", "Undri", "NIBM Road", "Kondhwa", "Wanowrie",
    "Kalyani Nagar", "Yerawada", "Wagholi", "Tathawade", "Balewadi",
    "Vishrantwadi", "Sus", "Ambegaon", "Dhankawadi", "Katraj", "Bibwewadi",
    "Camp", "Boat Club Road", "Prabhat Road", "Law College Road", "FC Road",
    "JM Road", "Senapati Bapat Road", "Karve Road", "Pune Station",
    "Shaniwar Peth", "Swargate", "Khadki", "Dapodi", "Chinchwad",
    "Pimpri", "Akurdi", "Hinjewadi Phase 1", "Hinjewadi Phase 2",
    "Hinjewadi Phase 3", "Baner-Balewadi", "Keshav Nagar", "Mundhwa",
    "Lohegaon", "Dhanori", "Chandan Nagar", "Vadgaon Budruk", "Narhe",
]

CLASSIFICATION_PROMPT = """You are a Pune local news classifier. Given this news article, extract structured information.

ARTICLE:
Title: {title}
Source: {source}
Body (first 1500 chars): {body}

INSTRUCTIONS:
1. Determine the type of incident/news
2. Rate severity from 1 (minor/informational) to 5 (critical/dangerous)
3. Identify which Pune locality this relates to (from the provided list)
4. Write a one-line summary (max 15 words)
5. Estimate approximate coordinates if possible

LOCALITY OPTIONS: {localities}

Respond ONLY with valid JSON in this exact format:
{{
    "type": "crime" | "civic" | "infrastructure" | "legal" | "safety" | "positive" | "other",
    "severity": 1-5,
    "locality": "locality name from list or Unknown",
    "summary": "one-line summary, max 15 words",
    "latitude": 18.52,
    "longitude": 73.85
}}

SEVERITY GUIDE:
1 = Informational, positive news, minor civic update
2 = Minor complaint, resolved issue, small disruption
3 = Moderate issue (theft, water cut, road damage)
4 = Serious (assault, major infrastructure failure, large-scale complaint)
5 = Critical (murder, building collapse, major disaster)

TYPE GUIDE:
- crime: theft, robbery, assault, murder, fraud, cybercrime
- civic: water supply, garbage, noise, encroachment, municipal complaints
- infrastructure: road damage, power outage, construction collapse, traffic
- legal: court cases, RERA complaints, builder disputes, evictions
- safety: fire, flooding, gas leak, structural danger
- positive: new amenities, safety improvements, civic improvements
- other: doesn't fit above categories"""


async def classify_article(title: str, body: str, source: str) -> dict | None:
    """Classify a news article using GPT-4o-mini."""
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a precise news classifier. Always respond with valid JSON only.",
                },
                {
                    "role": "user",
                    "content": CLASSIFICATION_PROMPT.format(
                        title=title,
                        source=source,
                        body=body[:1500],
                        localities=", ".join(PUNE_LOCALITIES),
                    ),
                },
            ],
            temperature=0.1,
            max_tokens=200,
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)

        if result.get("type") and result.get("severity"):
            result["severity"] = max(1, min(5, int(result["severity"])))
            return result

        return None

    except Exception as e:
        logger.error(f"Classification failed for '{title}': {e}")
        return None
