"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const PUNE_CENTER: [number, number] = [73.85, 18.52];
const INITIAL_ZOOM = 12;

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";

function getMapStyle(dark: boolean): string | maplibregl.StyleSpecification {
  if (MAPTILER_KEY) {
    const style = dark ? "streets-v2-dark" : "streets-v2";
    return `https://api.maptiler.com/maps/${style}/style.json?key=${MAPTILER_KEY}`;
  }
  const tileUrl = dark
    ? "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"
    : "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png";

  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      carto: {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxzoom: 20,
      },
    },
    layers: [
      {
        id: "carto-tiles",
        type: "raster",
        source: "carto",
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  };
}

function getScoreColor(score: number | null): string {
  if (score === null) return "#6b7280";
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function createMarkerSVG(color: string): string {
  return `
    <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <path d="M10 12h5v3h-5zm7 0h5v3h-5zm-7 5h5v3h-5zm7 0h5v3h-5zM10 22h12v3H10z" fill="white" opacity="0.9"/>
      <path d="M14 25h4v3h-4z" fill="white" opacity="0.9"/>
    </svg>
  `;
}

function createSocietyMarkerSVG(color: string): string {
  return `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="${color}" stroke="#fff" stroke-width="1.5" opacity="0.9"/>
      <path d="M7 7h4v3H7zm6 0h4v3h-4zM7 12h4v3H7zm6 0h4v3h-4zM7 17h10v2H7z" fill="white" opacity="0.9"/>
    </svg>
  `;
}

function createPulsingDot(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "pulsing-dot";
  el.innerHTML = `
    <div style="
      width: 18px; height: 18px;
      background: #3b82f6;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5);
      animation: pulse-ring 1.5s ease-out infinite;
    "></div>
  `;
  return el;
}

interface LocalityProperties {
  id: number;
  name: string;
  slug: string;
  safety_score: number | null;
  score_grade: string | null;
  buildings: Array<Record<string, unknown>>;
  news: Array<Record<string, unknown>>;
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLocalityClick?: (locality: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSocietyClick?: (society: any) => void;
  onLocationDetected?: (lat: number, lng: number) => void;
  onViewportChange?: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }, zoom: number) => void;
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
  dark?: boolean;
}

export default function SafetyMap({
  onLocalityClick,
  onSocietyClick,
  onLocationDetected,
  onViewportChange,
  flyTo,
  dark = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const societyMarkersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  // Counter incremented each time the map is recreated, triggers data re-load
  const [mapVersion, setMapVersion] = useState(0);

  const handleGeolocate = useCallback((e: GeolocationPosition) => {
    const { latitude, longitude } = e.coords;
    onLocationDetected?.(latitude, longitude);

    const map = mapRef.current;
    if (!map) return;

    map.flyTo({ center: [longitude, latitude], zoom: 17, duration: 1500 });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([longitude, latitude]);
    } else {
      const el = createPulsingDot();
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([longitude, latitude])
        .addTo(map);
    }
  }, [onLocationDetected]);

  // Create / recreate map when dark mode changes
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(dark),
      center: PUNE_CENTER,
      zoom: INITIAL_ZOOM,
      maxZoom: 20,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      showUserLocation: false,
    });
    map.addControl(geolocate, "top-right");

    geolocate.on("geolocate", handleGeolocate as unknown as (e: unknown) => void);

    const emitViewport = () => {
      const b = map.getBounds();
      onViewportChange?.(
        { minLat: b.getSouth(), maxLat: b.getNorth(), minLng: b.getWest(), maxLng: b.getEast() },
        map.getZoom()
      );
    };

    map.on("load", () => {
      setMapVersion((v) => v + 1);
      emitViewport();
    });
    map.on("moveend", emitViewport);

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      societyMarkersRef.current.forEach((m) => m.remove());
      societyMarkersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
    };
  }, [handleGeolocate, dark]);

  // Fly to location from search
  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? 17,
      duration: 1200,
    });
  }, [flyTo]);

  // Load data and add layers/markers whenever map is (re-)created
  useEffect(() => {
    if (mapVersion === 0 || !mapRef.current) return;

    fetch("/api/localities")
      .then((r) => r.json())
      .then((data: { features: Array<{ properties: LocalityProperties; geometry: { type: string; coordinates: number[][][] } }> }) => {
        const map = mapRef.current!;

        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        societyMarkersRef.current.forEach((m) => m.remove());
        societyMarkersRef.current = [];

        // Build zone-level merged polygons from locality data
        const zones: Record<string, { label: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
          "west-pune": { label: "West Pune", minLat: 18.45, maxLat: 18.56, minLng: 73.74, maxLng: 73.82 },
          "east-pune": { label: "East Pune", minLat: 18.50, maxLat: 18.60, minLng: 73.88, maxLng: 73.98 },
          "north-pune": { label: "North Pune", minLat: 18.58, maxLat: 18.66, minLng: 73.74, maxLng: 73.84 },
          "central-pune": { label: "Central Pune", minLat: 18.50, maxLat: 18.54, minLng: 73.82, maxLng: 73.90 },
          "south-pune": { label: "South Pune", minLat: 18.44, maxLat: 18.50, minLng: 73.83, maxLng: 73.92 },
          "hinjewadi-belt": { label: "IT Belt", minLat: 18.55, maxLat: 18.62, minLng: 73.72, maxLng: 73.78 },
        };

        const zoneFeatures = Object.entries(zones).map(([, zone]) => {
          const locsInZone = data.features.filter((f) => {
            const coords = f.geometry.coordinates[0];
            const centLat = coords.reduce((s, c) => s + c[1], 0) / (coords.length - 1);
            const centLng = coords.reduce((s, c) => s + c[0], 0) / (coords.length - 1);
            return centLat >= zone.minLat && centLat <= zone.maxLat && centLng >= zone.minLng && centLng <= zone.maxLng;
          });

          const scores = locsInZone
            .map((f) => f.properties.safety_score)
            .filter((s): s is number => s !== null);
          const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

          const pad = 0.002;
          return {
            type: "Feature" as const,
            properties: {
              label: zone.label,
              safety_score: avgScore ? Math.round(avgScore * 10) / 10 : null,
              locality_count: locsInZone.length,
            },
            geometry: {
              type: "Polygon" as const,
              coordinates: [[
                [zone.minLng - pad, zone.minLat - pad],
                [zone.maxLng + pad, zone.minLat - pad],
                [zone.maxLng + pad, zone.maxLat + pad],
                [zone.minLng - pad, zone.maxLat + pad],
                [zone.minLng - pad, zone.minLat - pad],
              ]],
            },
          };
        }).filter((f) => f.properties.locality_count > 0);

        const zoneGeoJSON = { type: "FeatureCollection" as const, features: zoneFeatures };

        // City-level single polygon
        const allScores = data.features
          .map((f) => f.properties.safety_score)
          .filter((s): s is number => s !== null);
        const cityScore = allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : null;

        const cityGeoJSON = {
          type: "FeatureCollection" as const,
          features: [{
            type: "Feature" as const,
            properties: { label: "Pune", safety_score: cityScore, locality_count: data.features.length },
            geometry: {
              type: "Polygon" as const,
              coordinates: [[[73.72, 18.43], [73.99, 18.43], [73.99, 18.66], [73.72, 18.66], [73.72, 18.43]]],
            },
          }],
        };

        // Add all three sources and layers
        if (!map.getSource("city-zones")) {
          const scorePaint: maplibregl.ExpressionSpecification = [
            "case",
            ["has", "safety_score"],
            [
              "interpolate",
              ["linear"],
              ["get", "safety_score"],
              0, "#ef4444",
              40, "#f97316",
              60, "#eab308",
              80, "#22c55e",
            ],
            "#6b7280",
          ];

          // City level (zoom < 11)
          map.addSource("city-zones", { type: "geojson", data: cityGeoJSON });
          map.addLayer({
            id: "city-fill",
            type: "fill",
            source: "city-zones",
            maxzoom: 11,
            paint: { "fill-color": scorePaint, "fill-opacity": 0.15 },
          });
          map.addLayer({
            id: "city-label",
            type: "symbol",
            source: "city-zones",
            maxzoom: 11,
            layout: {
              "text-field": ["get", "label"],
              "text-size": 18,
              "text-anchor": "center",
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "#000000",
              "text-halo-width": 2,
            },
          });

          // Zone level (zoom 11-13)
          map.addSource("zone-areas", { type: "geojson", data: zoneGeoJSON });
          map.addLayer({
            id: "zone-fill",
            type: "fill",
            source: "zone-areas",
            minzoom: 11,
            maxzoom: 13,
            paint: { "fill-color": scorePaint, "fill-opacity": 0.2 },
          });
          map.addLayer({
            id: "zone-border",
            type: "line",
            source: "zone-areas",
            minzoom: 11,
            maxzoom: 13,
            paint: { "line-color": "#ffffff", "line-width": 1, "line-opacity": 0.3 },
          });
          map.addLayer({
            id: "zone-label",
            type: "symbol",
            source: "zone-areas",
            minzoom: 11,
            maxzoom: 13,
            layout: {
              "text-field": ["get", "label"],
              "text-size": 14,
              "text-anchor": "center",
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "#000000",
              "text-halo-width": 1.5,
            },
          });

          // Locality level (zoom 13+)
          map.addSource("localities", { type: "geojson", data });
          map.addLayer({
            id: "locality-fill",
            type: "fill",
            source: "localities",
            minzoom: 13,
            paint: { "fill-color": scorePaint, "fill-opacity": 0.2 },
          });
        }

        data.features.forEach((feature) => {
          const props = feature.properties;
          const color = getScoreColor(props.safety_score);

          const coords = feature.geometry.coordinates[0];
          let lat = 0, lng = 0;
          const n = coords.length - 1;
          for (let i = 0; i < n; i++) {
            lng += coords[i][0];
            lat += coords[i][1];
          }
          lat /= n;
          lng /= n;

          const el = document.createElement("div");
          el.innerHTML = createMarkerSVG(color);
          el.style.cursor = "pointer";
          el.style.width = "32px";
          el.style.height = "40px";
          el.title = `${props.name} — ${props.score_grade ?? "N/A"} (${props.safety_score ?? "?"}/100)`;

          const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([lng, lat])
            .addTo(map);

          el.addEventListener("click", () => {
            onLocalityClick?.(props);
          });

          markersRef.current.push(marker);

          // Add society/building markers from this locality
          const buildings = props.buildings ?? [];
          buildings.forEach((building: Record<string, unknown>) => {
            const bLat = building.lat as number;
            const bLng = building.lng as number;
            if (!bLat || !bLng) return;

            const bRating = (building.society_rating as number) ?? 3;
            const bColor = bRating >= 4 ? "#22c55e" : bRating >= 3 ? "#eab308" : "#f97316";

            const sEl = document.createElement("div");
            sEl.style.display = "none";
            sEl.style.cursor = "pointer";
            sEl.style.flexDirection = "column";
            sEl.style.alignItems = "center";
            sEl.style.gap = "2px";

            const iconDiv = document.createElement("div");
            iconDiv.innerHTML = createSocietyMarkerSVG(bColor);
            iconDiv.style.width = "24px";
            iconDiv.style.height = "24px";
            sEl.appendChild(iconDiv);

            const labelDiv = document.createElement("div");
            labelDiv.textContent = building.name as string;
            labelDiv.className = "society-label";
            labelDiv.style.cssText = "font-size:10px;font-weight:600;color:#fff;background:rgba(0,0,0,0.7);padding:1px 5px;border-radius:3px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;display:none;pointer-events:none;";
            sEl.appendChild(labelDiv);

            sEl.title = `${building.name as string} (${building.builder_name as string})`;

            const sMarker = new maplibregl.Marker({ element: sEl, anchor: "center" })
              .setLngLat([bLng, bLat])
              .addTo(map);

            sEl.addEventListener("click", (e) => {
              e.stopPropagation();
              onSocietyClick?.({ ...building, locality_name: props.name, locality_score: props.safety_score });
            });

            societyMarkersRef.current.push(sMarker);
          });
        });

        // Show/hide society markers based on zoom level
        const updateMarkerVisibility = () => {
          const zoom = map.getZoom();

          // Locality pin markers: visible at zoom 13+
          markersRef.current.forEach((m) => {
            m.getElement().style.display = zoom >= 13 ? "block" : "none";
          });

          // Society square markers: visible at zoom 14+, labels at 15.5+
          societyMarkersRef.current.forEach((m) => {
            const el = m.getElement();
            el.style.display = zoom >= 14 ? "flex" : "none";
            const label = el.querySelector(".society-label") as HTMLElement;
            if (label) {
              label.style.display = zoom >= 15.5 ? "block" : "none";
            }
          });
        };

        map.on("zoom", updateMarkerVisibility);
        updateMarkerVisibility();
      })
      .catch(console.error);
  }, [mapVersion, onLocalityClick, onSocietyClick]);

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
          70% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </>
  );
}
