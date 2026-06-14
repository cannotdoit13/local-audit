import Parser from "rss-parser";

// Allow self-signed certs in dev (corporate proxies)
if (typeof process !== "undefined") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const parser = new Parser({
  timeout: 5000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; LocalityAudit/1.0)" },
  requestOptions: {
    rejectUnauthorized: false,
  },
});

const PUNE_RSS_FEEDS = [
  { name: "Times of India Pune", url: "https://timesofindia.indiatimes.com/rssfeeds/2950987.cms" },
  { name: "Indian Express Pune", url: "https://indianexpress.com/section/cities/pune/feed/" },
  { name: "Hindustan Times Pune", url: "https://www.hindustantimes.com/feeds/rss/cities/pune/rssfeed.xml" },
];

const PUNE_LOCALITIES = [
  "Kothrud", "Baner", "Hinjewadi", "Wakad", "Kharadi", "Viman Nagar",
  "Hadapsar", "Magarpatta", "Koregaon Park", "Aundh", "Pashan", "Bavdhan",
  "Pimple Saudagar", "Ravet", "Pimpri", "Chinchwad", "Shivajinagar", "Deccan",
  "Sinhagad Road", "Warje", "Undri", "NIBM", "Kondhwa", "Wanowrie",
  "Kalyani Nagar", "Yerawada", "Wagholi", "Tathawade", "Balewadi",
  "Vishrantwadi", "Sus", "Ambegaon", "Dhankawadi", "Katraj", "Bibwewadi",
  "Camp", "Boat Club Road", "Prabhat Road", "FC Road", "JM Road",
  "Senapati Bapat Road", "Karve Road", "Pune Station", "Swargate",
  "Khadki", "Dapodi", "Mundhwa", "Dhanori", "Lohegaon", "Narhe",
];

const CRIME_KEYWORDS = ["theft", "robbery", "murder", "assault", "snatch", "fraud", "arrested", "FIR", "police", "crime", "stabbed", "kidnap"];
const CIVIC_KEYWORDS = ["water", "garbage", "PMC", "complaint", "encroachment", "noise", "sewage", "sanitation"];
const INFRA_KEYWORDS = ["pothole", "road", "traffic", "metro", "bridge", "power cut", "electricity", "construction"];
const SAFETY_KEYWORDS = ["fire", "flood", "gas leak", "collapse", "accident", "injured"];
const POSITIVE_KEYWORDS = ["CCTV", "park", "garden", "inaugurated", "new facility", "improvement", "smart city"];
const LEGAL_KEYWORDS = ["RERA", "court", "builder", "penalty", "compensation", "tribunal"];

function classifyArticle(title: string, summary: string): { type: string; severity: number } {
  const text = `${title} ${summary}`.toLowerCase();

  if (CRIME_KEYWORDS.some((k) => text.includes(k)))
    return { type: "crime", severity: text.includes("murder") || text.includes("stabbed") ? 5 : text.includes("robbery") || text.includes("assault") ? 4 : 3 };
  if (SAFETY_KEYWORDS.some((k) => text.includes(k)))
    return { type: "safety", severity: text.includes("collapse") || text.includes("flood") ? 4 : 3 };
  if (LEGAL_KEYWORDS.some((k) => text.includes(k)))
    return { type: "legal", severity: 3 };
  if (INFRA_KEYWORDS.some((k) => text.includes(k)))
    return { type: "infrastructure", severity: 2 };
  if (CIVIC_KEYWORDS.some((k) => text.includes(k)))
    return { type: "civic", severity: 2 };
  if (POSITIVE_KEYWORDS.some((k) => text.includes(k)))
    return { type: "positive", severity: 1 };

  return { type: "other", severity: 1 };
}

function detectLocality(title: string, summary: string): string | null {
  const text = `${title} ${summary}`;
  for (const loc of PUNE_LOCALITIES) {
    if (text.toLowerCase().includes(loc.toLowerCase())) return loc;
  }
  return null;
}

export interface ScrapedArticle {
  id: number;
  title: string;
  summary: string;
  type: string;
  severity: number;
  source_url: string;
  source_name: string;
  published_at: string;
  locality_name: string;
}

let cachedArticles: ScrapedArticle[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function fetchRSSNews(): Promise<ScrapedArticle[]> {
  if (cachedArticles && Date.now() - cacheTime < CACHE_TTL) {
    return cachedArticles;
  }

  const allArticles: ScrapedArticle[] = [];
  let id = 1;

  // Race all feeds against a global 8s timeout
  const feedPromises = PUNE_RSS_FEEDS.map(async (feed) => {
    try {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items || []).slice(0, 15).map((item) => ({
        raw_title: item.title || "",
        raw_summary: item.contentSnippet || item.content || "",
        link: item.link || "",
        pubDate: item.pubDate || item.isoDate || "",
        source: feed.name,
      }));
    } catch (e) {
      console.warn(`RSS fetch failed for ${feed.name}:`, e instanceof Error ? e.message : e);
      return [];
    }
  });

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
  const rssResult = await Promise.race([Promise.allSettled(feedPromises), timeout]);

  const results = rssResult && Array.isArray(rssResult) ? rssResult : [];

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      const classification = classifyArticle(item.raw_title, item.raw_summary);
      if (classification.type === "other") continue;

      const locality = detectLocality(item.raw_title, item.raw_summary);

      allArticles.push({
        id: id++,
        title: item.raw_title.slice(0, 200),
        summary: item.raw_summary.slice(0, 300),
        type: classification.type,
        severity: classification.severity,
        source_url: item.link,
        source_name: item.source,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        locality_name: locality || "Pune",
      });
    }
  }

  // Also fetch from Reddit r/pune
  try {
    const redditArticles = await fetchRedditPune();
    allArticles.push(...redditArticles.map((a) => ({ ...a, id: id++ })));
  } catch (e) {
    console.warn("Reddit fetch failed:", e);
  }

  allArticles.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  cachedArticles = allArticles;
  cacheTime = Date.now();
  return allArticles;
}

async function fetchRedditPune(): Promise<Omit<ScrapedArticle, "id">[]> {
  const searches = ["pune+crime", "pune+safety", "pune+society", "pune+builder", "pune+water"];
  const articles: Omit<ScrapedArticle, "id">[] = [];

  for (const query of searches) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/pune/search.json?q=${query}&restrict_sr=on&sort=new&t=month&limit=5`,
        {
          headers: { "User-Agent": "LocalityAudit/1.0" },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();

      for (const child of data?.data?.children || []) {
        const post = child.data;
        if (!post?.title) continue;

        const classification = classifyArticle(post.title, post.selftext || "");
        if (classification.type === "other") continue;

        const locality = detectLocality(post.title, post.selftext || "");

        articles.push({
          title: post.title.slice(0, 200),
          summary: (post.selftext || "").slice(0, 300),
          type: classification.type,
          severity: classification.severity,
          source_url: `https://reddit.com${post.permalink}`,
          source_name: "r/pune",
          published_at: new Date(post.created_utc * 1000).toISOString(),
          locality_name: locality || "Pune",
        });
      }
    } catch {
      continue;
    }
  }

  return articles;
}

export function getArticlesForLocality(articles: ScrapedArticle[], localityName: string): ScrapedArticle[] {
  return articles.filter(
    (a) => a.locality_name.toLowerCase() === localityName.toLowerCase() || a.locality_name === "Pune"
  );
}
