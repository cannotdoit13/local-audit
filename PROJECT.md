# Locality Audit - Pune Neighbourhood Safety Map

## What This Project Is

A full-stack **Next.js 16** web app that renders an interactive safety map of Pune, India. Users can explore localities (neighbourhoods), view safety scores, browse society/building details (RERA data, amenities, ratings), read real-time news scraped from RSS feeds and Reddit, and see live property listings scraped from 99acres and Housing.com.

The app is entirely self-contained inside the `web/` directory -- there is no separate backend; everything runs as Next.js API routes.

---

## Architecture Overview

```
locality-audit/
└── web/                          # Next.js 16 app (the ONLY deployable unit)
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx              # Main page - full-screen map + overlays
    │   │   ├── layout.tsx            # Root layout (Inter font, metadata/SEO)
    │   │   ├── globals.css           # Tailwind v4, MapLibre overrides
    │   │   └── api/
    │   │       ├── localities/
    │   │       │   ├── route.ts      # GET /api/localities - GeoJSON FeatureCollection
    │   │       │   └── viewport/
    │   │       │       └── route.ts  # GET /api/localities/viewport - aggregated stats for map bounds
    │   │       ├── search/
    │   │       │   └── route.ts      # GET /api/search?q=... - search localities + buildings
    │   │       ├── buildings/
    │   │       │   └── nearest/
    │   │       │       └── route.ts  # GET /api/buildings/nearest?lat=&lng= - nearest building
    │   │       ├── news/
    │   │       │   └── nearby/
    │   │       │       └── route.ts  # GET /api/news/nearby - live RSS + Reddit news
    │   │       └── listings/
    │   │           └── route.ts      # GET /api/listings - scraped 99acres + Housing.com
    │   ├── components/
    │   │   ├── SafetyMap.tsx          # MapLibre GL map with locality polygons + markers
    │   │   ├── SearchBar.tsx          # Autocomplete search (localities + buildings)
    │   │   ├── ViewportStatsBar.tsx   # Top stats bar (aggregated safety score, news, listings)
    │   │   ├── LocalityDetail.tsx     # Right panel: locality detail (buildings, RERA, news, listings)
    │   │   └── NewsFeed.tsx           # Bottom sheet news feed (currently unused on main page)
    │   └── lib/
    │       ├── utils.ts              # Shared helpers (cn, score colors, time ago, etc.)
    │       ├── scraper.ts            # RSS + Reddit news scraper (server-side)
    │       └── listings-scraper.ts   # 99acres + Housing.com HTML scraper (server-side)
    ├── data/
    │   └── pune_localities.json      # Static dataset: 50 Pune localities with lat/lng
    ├── package.json
    ├── next.config.ts
    ├── tsconfig.json
    ├── postcss.config.mjs
    └── eslint.config.mjs
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Map | MapLibre GL JS with CARTO raster tiles (or MapTiler if `NEXT_PUBLIC_MAPTILER_KEY` is set) |
| Styling | Tailwind CSS v4, Radix UI primitives |
| Icons | Lucide React |
| News scraping | `rss-parser` (RSS feeds from TOI, Indian Express, HT) + Reddit JSON API |
| Listings scraping | HTML parsing of 99acres + Housing.com `__NEXT_DATA__` |
| Data | Static JSON (50 Pune localities) + mock-generated buildings, scores, RERA data |

## Data Flow

1. **Map loads** -> fetches `GET /api/localities` -> returns GeoJSON `FeatureCollection` with polygons, safety scores, buildings, and news for each locality
2. **Scores & buildings are mock-generated** on each request using `Math.random()` (no database)
3. **News is real** -- RSS feeds from Pune newspapers + Reddit r/pune, classified by keyword matching into crime/civic/infrastructure/safety/positive/legal, cached for 10 min
4. **Listings are real** -- scraped from 99acres and Housing.com HTML on demand, cached for 30 min
5. **Viewport stats** recalculate on every pan/zoom via `GET /api/localities/viewport`
6. **Search** queries the static locality list + pre-generated building list

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_MAPTILER_KEY` | No | MapTiler API key for vector tiles. Falls back to free CARTO raster tiles if unset. |
| `PIPELINE_URL` | No | URL of external data pipeline backend. If set, `/api/localities` proxies to it. Currently unused (falls through to local mock data). |

---

## Vercel Deployment Issues & Fixes

### Problem: App not rendering on Vercel

The root cause is almost certainly that **Vercel is building from the repo root (`/`) instead of the `web/` subdirectory** where the Next.js app lives. There is no `package.json` or Next.js config at root level, so the build produces nothing.

### Required Changes

#### 1. Set Root Directory in Vercel Dashboard (Critical)

Go to **Vercel Project Settings > General > Root Directory** and set it to:
```
web
```
This tells Vercel where to find `package.json` and `next.config.ts`.

#### 2. Fix `next.config.ts` -- Remove `__dirname` (Critical)

`__dirname` is not available in ESM context on Vercel's build environment. The turbopack `root` config is unnecessary for deployment.

**Current (broken on Vercel):**
```ts
import path from "path";
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: [],
};
```

**Fix:**
```ts
const nextConfig: NextConfig = {};
```

#### 3. Remove `NODE_TLS_REJECT_UNAUTHORIZED = "0"` from scraper (Recommended)

In `src/lib/scraper.ts:4`, `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` disables TLS certificate validation globally. This:
- Is a security risk in production
- May not work as expected in Vercel's serverless environment
- Was likely added for corporate proxy issues during local dev

Remove it or gate it behind `NODE_ENV === "development"`.

#### 4. Add `vercel.json` (Optional but Helpful)

Create at repo root (`locality-audit/vercel.json`):
```json
{
  "buildCommand": "cd web && npm run build",
  "outputDirectory": "web/.next",
  "installCommand": "cd web && npm install",
  "framework": "nextjs"
}
```
This is an alternative to setting Root Directory in the dashboard.

#### 5. Set Environment Variables in Vercel (Optional)

If you want MapTiler vector tiles instead of CARTO raster:
- Add `NEXT_PUBLIC_MAPTILER_KEY` in Vercel project settings

### Other Notes

- **All data is mock/random**: Safety scores, buildings, RERA IDs, society ratings are regenerated with `Math.random()` on every API call. They change on every page refresh. This is by design (no database yet).
- **Scrapers may fail on Vercel**: The RSS and listing scrapers make outbound HTTP requests with custom User-Agent headers. 99acres and Housing.com may block Vercel's IP ranges. The app handles this gracefully (falls back to mock data for news, shows "No listings" for listings).
- **`rss-parser` is a Node.js package** that uses `http`/`https` modules. It works in Vercel serverless functions but NOT in Edge Runtime. The API routes default to Node.js runtime, so this should be fine.
