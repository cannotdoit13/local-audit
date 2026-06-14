/**
 * Real estate listings scraper for 99acres and Housing.com.
 * Extracts live property data by parsing HTML search results.
 */

export interface PropertyListing {
  id: string;
  title: string;
  type: string;
  sqft: number;
  price: number;
  price_label: string;
  locality: string;
  source_url: string;
  source_name: string;
  per_sqft: string;
}

interface CacheEntry {
  data: PropertyListing[];
  time: number;
}

const listingsCache: Record<string, CacheEntry> = {};
const CACHE_TTL = 30 * 60 * 1000;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

async function scrape99acres(locality: string, slug: string): Promise<PropertyListing[]> {
  const url = `https://www.99acres.com/property-in-${slug}-pune-ffid`;

  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const html = await res.text();
    return parse99acresListings(html, locality, slug);
  } catch (e) {
    console.warn(`99acres scrape failed for ${locality}:`, e instanceof Error ? e.message : e);
    return [];
  }
}

function parse99acresListings(html: string, locality: string, slug: string): PropertyListing[] {
  const listings: PropertyListing[] = [];

  // Split HTML by tuple price markers
  const parts = html.split(/compattr="tuplePriceArea_(\d+)"/);

  for (let i = 1; i < parts.length - 1 && listings.length < 15; i += 2) {
    const id = parts[i];
    const before = parts[i - 1].slice(-5000);
    const after = parts[i + 1].slice(0, 1500);

    // Clean HTML to text for extraction
    const textBefore = before.replace(/<[^>]+>/g, "\n").split("\n").map(l => l.trim()).filter(Boolean);
    const textAfter = after.replace(/<[^>]+>/g, "\n").split("\n").map(l => l.trim()).filter(Boolean);

    // Price: first ₹ amount in the after-chunk
    let price = 0;
    let priceLabel = "sale";
    const priceStr = textAfter.find(l => l.startsWith("₹"));
    if (priceStr) {
      const cleaned = priceStr.replace("₹", "").replace(/,/g, "").trim();
      const num = parseFloat(cleaned);
      if (!isNaN(num)) {
        if (cleaned.includes("Cr")) price = num * 10000000;
        else if (cleaned.includes("L") || cleaned.includes("Lac")) price = num * 100000;
        else if (num >= 10000) { price = num; priceLabel = "rent/mo"; }
        else price = num * 10000000; // assume Cr if no unit
      }
    }

    // Per sqft
    const perSqftLine = textAfter.find(l => l.includes("/sqft"));
    const perSqft = perSqftLine || "";

    // Sqft: look for "X,XXX sqft" pattern
    const allText = [...textBefore.slice(-20), ...textAfter.slice(0, 20)].join(" ");
    const sqftMatch = allText.match(/([\d,]+)\s*sqft/i) || allText.match(/([\d,]+)\s*sq\.?\s*ft/i);
    const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, "")) : 0;

    // BHK type
    const bhkLine = textBefore.find(l => /\d\s*BHK/i.test(l)) || textAfter.find(l => /\d\s*BHK/i.test(l));
    const bhkMatch = bhkLine?.match(/(\d+\.?\d*)\s*BHK/i);
    const bhk = bhkMatch ? `${bhkMatch[1]} BHK` : "Apartment";

    // Project/society name: look for capitalized names before BHK
    const bhkIdx = textBefore.findIndex(l => /\d\s*BHK/i.test(l));
    let projectName = "";
    if (bhkIdx > 0) {
      for (let j = bhkIdx - 1; j >= Math.max(0, bhkIdx - 5); j--) {
        const line = textBefore[j];
        if (line.length > 3 && line.length < 60 && /^[A-Z]/.test(line) && !/RESALE|RERA|Sort|NEW|Featured/.test(line)) {
          projectName = line;
          break;
        }
      }
    }

    // Location check — skip if not in our locality
    const locationLine = textBefore.find(l => l.toLowerCase().includes(locality.toLowerCase()) || l.toLowerCase().includes("pune"));

    // Link
    const linkMatches = [...before.matchAll(/href="(\/[^"]*\d{7,}[^"]*)"/g)];
    const link = linkMatches.length > 0 ? `https://www.99acres.com${linkMatches[linkMatches.length - 1][1]}` : `https://www.99acres.com/property-in-${slug}-pune`;

    if (price > 0 || sqft > 0) {
      listings.push({
        id: `99a-${id}`,
        title: projectName ? `${bhk} in ${projectName}` : `${bhk} in ${locality}`,
        type: bhk,
        sqft,
        price,
        price_label: priceLabel,
        locality: locationLine || locality,
        source_url: link,
        source_name: "99acres",
        per_sqft: perSqft,
      });
    }
  }

  return listings;
}

async function scrapeHousing(locality: string, slug: string): Promise<PropertyListing[]> {
  try {
    const res = await fetch(
      `https://housing.com/in/buy/search?q=${encodeURIComponent(locality + " Pune")}`,
      { headers: HEADERS, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];

    const html = await res.text();

    // Housing.com embeds __NEXT_DATA__ with listing info
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!nextDataMatch) return [];

    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const listings: PropertyListing[] = [];

      const props = nextData?.props?.pageProps;
      const results = props?.searchResults || props?.listings || [];

      if (Array.isArray(results)) {
        for (const item of results.slice(0, 15)) {
          const bhk = item.bhkLabel || item.bedrooms ? `${item.bedrooms} BHK` : "Apartment";
          listings.push({
            id: `hc-${item.id || listings.length}`,
            title: item.title || item.name || `${bhk} in ${locality}`,
            type: bhk,
            sqft: item.superBuiltupArea || item.carpetArea || 0,
            price: item.price || 0,
            price_label: item.propertyFor === "rent" ? "rent/mo" : "sale",
            locality,
            source_url: item.url ? `https://housing.com${item.url}` : `https://housing.com/in/buy/${slug}-pune`,
            source_name: "Housing.com",
            per_sqft: item.pricePerSqft ? `₹${item.pricePerSqft}/sqft` : "",
          });
        }
      }

      return listings;
    } catch {
      return [];
    }
  } catch (e) {
    console.warn(`Housing.com scrape failed for ${locality}:`, e instanceof Error ? e.message : e);
    return [];
  }
}

export async function fetchListings(locality: string, slug: string): Promise<PropertyListing[]> {
  const cacheKey = slug;
  const cached = listingsCache[cacheKey];
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }

  const [from99acres, fromHousing] = await Promise.allSettled([
    scrape99acres(locality, slug),
    scrapeHousing(locality, slug),
  ]);

  const results: PropertyListing[] = [];
  if (from99acres.status === "fulfilled") results.push(...from99acres.value);
  if (fromHousing.status === "fulfilled") results.push(...fromHousing.value);

  results.sort((a, b) => b.price - a.price);
  listingsCache[cacheKey] = { data: results, time: Date.now() };
  return results;
}
