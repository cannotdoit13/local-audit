import { NextResponse } from "next/server";
import localitiesData from "../../../../data/pune_localities.json";

function generateMockPolygon(lat: number, lng: number): number[][][] {
  const baseRadius = 0.008 + Math.random() * 0.004;
  const points = 8;
  const coords: number[][] = [];

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const jitter = 0.7 + Math.random() * 0.6;
    const r = baseRadius * jitter;
    coords.push([
      lng + r * Math.cos(angle),
      lat + r * Math.sin(angle),
    ]);
  }
  coords.push(coords[0]);

  return [coords];
}

function generateMockScore(): number {
  const base = 35 + Math.random() * 55;
  return Math.round(base * 10) / 10;
}

function getGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
}

const BUILDERS = [
  "Kolte-Patil Developers", "Godrej Properties", "Shapoorji Pallonji",
  "Panchshil Realty", "Kumar Properties", "Pride Purple Group",
  "Paranjape Schemes", "DSK Group", "Nyati Group", "VTP Realty",
  "Sobha Limited", "Lodha Group", "Brigade Group", "Mahindra Lifespaces",
];

const RERA_STATUSES = ["Registered", "Completed", "Under Construction", "Nearing Completion"];

const NEWS_TYPES = ["crime", "civic", "infrastructure", "safety", "positive", "legal"] as const;
const NEWS_TEMPLATES: Record<string, string[]> = {
  crime: [
    "Two-wheeler theft reported near {locality} junction",
    "Chain snatching incident near {locality} bus stop",
    "Burglary attempt foiled in {locality} society",
  ],
  civic: [
    "PMC addresses water supply issue in {locality}",
    "Garbage collection delays reported in {locality}",
    "Residents file noise complaint in {locality}",
  ],
  infrastructure: [
    "Road pothole causes accident near {locality}",
    "Street lights non-functional in {locality} for 3 days",
    "Metro construction causes traffic at {locality}",
  ],
  safety: [
    "Fire brigade called for gas leak in {locality}",
    "Waterlogging at {locality} underpass after rain",
    "Electrical fire in {locality} commercial complex",
  ],
  positive: [
    "New CCTV cameras installed at {locality} junctions",
    "Smart parking system launched in {locality}",
    "Tree plantation drive completed in {locality}",
  ],
  legal: [
    "RERA complaint filed against builder in {locality}",
    "Court orders completion of stalled project in {locality}",
    "Builder penalized for delayed possession in {locality}",
  ],
};

const SOCIETY_NAMES = [
  "Amanora Park Town", "Blue Ridge SEZ", "Nyati Elysia", "Bramha Skycity",
  "Pride World City", "Megapolis", "Kumar Palaash", "Paranjape Athashri",
  "Goel Ganga Newtown", "Kolte-Patil Life Republic", "Godrej Infinity",
  "Shapoorji BKC", "VTP Pegasus", "Panchshil Towers", "DSK Vishwa",
  "Lodha Belmondo", "Marvel Arco", "Kohinoor City", "Nyati Environ",
  "Sobha Dream Acres", "Kumar Princepark", "Rohan Leher", "Kalpataru Harmony",
];

const LISTING_TYPES = ["2 BHK", "3 BHK", "4 BHK", "1 BHK", "3.5 BHK", "Penthouse"] as const;

function generateMockBuildings(localityName: string, lat: number, lng: number) {
  const count = 3 + Math.floor(Math.random() * 4);
  return Array.from({ length: count }, (_, i) => {
    const builder = BUILDERS[Math.floor(Math.random() * BUILDERS.length)];
    const reraStatus = RERA_STATUSES[Math.floor(Math.random() * RERA_STATUSES.length)];
    const year = 2016 + Math.floor(Math.random() * 9);
    const units = 50 + Math.floor(Math.random() * 400);
    const completionPct = reraStatus === "Completed" ? 100 : 40 + Math.floor(Math.random() * 55);
    const complaints = Math.floor(Math.random() * 8);
    const rating = 2.5 + Math.random() * 2.5;
    const societyName = SOCIETY_NAMES[Math.floor(Math.random() * SOCIETY_NAMES.length)];

    const listingCount = reraStatus === "Completed" ? 1 + Math.floor(Math.random() * 3) : Math.floor(Math.random() * 2);
    const listings = Array.from({ length: listingCount }, (_, j) => {
      const bhk = LISTING_TYPES[Math.floor(Math.random() * LISTING_TYPES.length)];
      const sqft = bhk === "1 BHK" ? 550 + Math.floor(Math.random() * 200) :
                   bhk === "2 BHK" ? 850 + Math.floor(Math.random() * 300) :
                   bhk === "3 BHK" ? 1200 + Math.floor(Math.random() * 400) :
                   bhk === "4 BHK" ? 1800 + Math.floor(Math.random() * 600) :
                   bhk === "Penthouse" ? 2500 + Math.floor(Math.random() * 1500) :
                   1400 + Math.floor(Math.random() * 400);
      const pricePerSqft = 7000 + Math.floor(Math.random() * 8000);
      const price = sqft * pricePerSqft;
      const isRent = Math.random() > 0.6;

        const listingId = 50000 + Math.floor(Math.random() * 950000);
        const listingSources = [
          { name: "Housing.com", url: `https://housing.com/in/buy/pune/${localityName.toLowerCase().replace(/\s+/g, "-")}/${listingId}` },
          { name: "99acres", url: `https://www.99acres.com/property-in-pune-${listingId}` },
          { name: "MagicBricks", url: `https://www.magicbricks.com/property-details/pune-${listingId}` },
          { name: "NoBroker", url: `https://www.nobroker.in/property/pune/${localityName.toLowerCase().replace(/\s+/g, "-")}/${listingId}` },
        ];
        const listingSource = listingSources[Math.floor(Math.random() * listingSources.length)];

        return {
        id: j + 1,
        type: bhk,
        sqft,
        price: isRent ? 15000 + Math.floor(Math.random() * 50000) : price,
        price_label: isRent ? "rent/mo" : "sale",
        floor: `${1 + Math.floor(Math.random() * 20)}/${5 + Math.floor(Math.random() * 25)}`,
        furnished: ["Unfurnished", "Semi-Furnished", "Fully Furnished"][Math.floor(Math.random() * 3)],
        available_from: new Date(Date.now() + Math.floor(Math.random() * 90) * 86400_000).toISOString().split("T")[0],
        source_url: listingSource.url,
        source_name: listingSource.name,
      };
    });

    return {
      id: i + 1,
      name: societyName,
      builder_name: builder,
      rera_id: `P52100${20000 + Math.floor(Math.random() * 30000)}`,
      rera_status: reraStatus,
      rera_completion_pct: completionPct,
      rera_complaints: complaints,
      year_built: year,
      total_units: units,
      avg_rating: Math.round(rating * 10) / 10,
      review_count: 5 + Math.floor(Math.random() * 80),
      society_rating: Math.round((3 + Math.random() * 2) * 10) / 10,
      rating_breakdown: {
        security: Math.round((2.5 + Math.random() * 2.5) * 10) / 10,
        maintenance: Math.round((2.5 + Math.random() * 2.5) * 10) / 10,
        water_supply: Math.round((2 + Math.random() * 3) * 10) / 10,
        power_backup: Math.round((3 + Math.random() * 2) * 10) / 10,
        cleanliness: Math.round((2.5 + Math.random() * 2.5) * 10) / 10,
        connectivity: Math.round((3 + Math.random() * 2) * 10) / 10,
        green_area: Math.round((2 + Math.random() * 3) * 10) / 10,
        noise_level: Math.round((2 + Math.random() * 3) * 10) / 10,
      },
      amenities: generateAmenities(),
      listings,
      lat: lat + (Math.random() - 0.5) * 0.01,
      lng: lng + (Math.random() - 0.5) * 0.01,
    };
  });
}

function generateAmenities(): string[] {
  const all = ["Swimming Pool", "Gym", "Clubhouse", "Garden", "Play Area", "24/7 Security", "CCTV", "Power Backup", "Parking", "EV Charging", "Jogging Track", "Indoor Games"];
  const count = 4 + Math.floor(Math.random() * 5);
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateMockNews(localityName: string) {
  const count = 3 + Math.floor(Math.random() * 5);
  return Array.from({ length: count }, (_, i) => {
    const type = NEWS_TYPES[Math.floor(Math.random() * NEWS_TYPES.length)];
    const templates = NEWS_TEMPLATES[type];
    const title = templates[Math.floor(Math.random() * templates.length)].replace("{locality}", localityName);
    const hoursAgo = 2 + Math.floor(Math.random() * 168);
    const severity = type === "crime" ? 3 + Math.floor(Math.random() * 2) :
                     type === "positive" ? 1 :
                     1 + Math.floor(Math.random() * 4);

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
    const articleId = 10000000 + Math.floor(Math.random() * 90000000);
    const sources = [
      { name: "Times of India", url: `https://timesofindia.indiatimes.com/city/pune/${slug}/articleshow/${articleId}.cms` },
      { name: "Indian Express", url: `https://indianexpress.com/article/cities/pune/${slug}-${articleId}/` },
      { name: "Pune Mirror", url: `https://punemirror.com/pune/pune-news/${slug}-${articleId}.html` },
      { name: "Hindustan Times", url: `https://www.hindustantimes.com/cities/pune-news/${slug}-${articleId}.html` },
      { name: "r/pune", url: `https://reddit.com/r/pune/comments/${Math.random().toString(36).slice(2, 8)}/${slug}/` },
      { name: "Twitter/X", url: `https://twitter.com/PuneCityPolice/status/18${String(Math.floor(Math.random() * 1e16)).padStart(17, "0")}` },
    ];
    const source = sources[Math.floor(Math.random() * sources.length)];

    return {
      id: i + 1,
      title,
      type,
      severity,
      source_name: source.name,
      source_url: source.url,
      published_at: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
    };
  });
}

export async function GET() {
  const BACKEND_URL = process.env.PIPELINE_URL;

  if (BACKEND_URL) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/localities`, {
        next: { revalidate: 3600 },
      });
      const data = await res.json();
      return NextResponse.json(data);
    } catch {
      // Fall through to local data
    }
  }

  // Fetch real news from RSS + Reddit
  let realNews: Array<{ id: number; title: string; type: string; severity: number; source_name: string; source_url: string; published_at: string; locality_name: string }> = [];
  try {
    const { fetchRSSNews } = await import("@/lib/scraper");
    realNews = await fetchRSSNews();
  } catch (e) {
    console.warn("Failed to fetch live news, using mock:", e);
  }

  const features = (localitiesData as Array<{name: string; slug: string; lat: number; lng: number}>).map((loc, idx) => {
    const score = generateMockScore();

    // Get real news for this locality (or general Pune news)
    const localityNews = realNews.filter(
      (a) =>
        a.locality_name.toLowerCase() === loc.name.toLowerCase() ||
        a.title.toLowerCase().includes(loc.name.toLowerCase())
    );
    // Fill with general Pune news if not enough locality-specific news
    const generalNews = realNews.filter((a) => a.locality_name === "Pune");
    const combinedNews = [...localityNews, ...generalNews.slice(0, Math.max(0, 5 - localityNews.length))].slice(0, 8);

    // Use real news if available, fall back to mock
    const newsForLocality = combinedNews.length > 0 ? combinedNews : generateMockNews(loc.name);

    return {
      type: "Feature" as const,
      properties: {
        id: idx + 1,
        name: loc.name,
        slug: loc.slug,
        safety_score: score,
        score_grade: getGrade(score),
        buildings: generateMockBuildings(loc.name, loc.lat, loc.lng),
        news: newsForLocality,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: generateMockPolygon(loc.lat, loc.lng),
      },
    };
  });

  return NextResponse.json({
    type: "FeatureCollection",
    features,
  });
}
