"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  Layer,
  Source,
  NavigationControl,
  GeolocateControl,
  Popup,
} from "react-map-gl/mapbox";
import type { MapRef, MapMouseEvent } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const PUNE_CENTER = { latitude: 18.52, longitude: 73.85 };
const INITIAL_ZOOM = 12;

interface LocalityFeature {
  type: "Feature";
  properties: {
    id: number;
    name: string;
    slug: string;
    safety_score: number | null;
    score_grade: string | null;
  };
  geometry: object;
}

interface BuildingFeature {
  type: "Feature";
  properties: {
    id: number;
    name: string;
    slug: string;
    score: number | null;
    score_grade: string | null;
    rera_id: string | null;
    builder_name: string | null;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface Props {
  onLocalityClick?: (locality: LocalityFeature["properties"]) => void;
  onBuildingClick?: (building: BuildingFeature["properties"]) => void;
  onLocationDetected?: (lat: number, lng: number) => void;
}

export default function SafetyMap({
  onLocalityClick,
  onBuildingClick,
  onLocationDetected,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [localities, setLocalities] = useState<object | null>(null);
  const [buildings, setBuildings] = useState<object | null>(null);
  const [popup, setPopup] = useState<{
    lat: number;
    lng: number;
    name: string;
    score: number | null;
    grade: string | null;
  } | null>(null);

  // Fetch locality data
  useEffect(() => {
    fetch("/api/localities")
      .then((r) => r.json())
      .then(setLocalities)
      .catch(() => {
        // Use demo data if API not available
        setLocalities(null);
      });
  }, []);

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      const features = e.features;
      if (!features?.length) {
        setPopup(null);
        return;
      }

      const feature = features[0];

      if (feature.layer?.id === "locality-fill") {
        const props = feature.properties;
        setPopup({
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          name: props?.name || "",
          score: props?.safety_score ?? null,
          grade: props?.score_grade ?? null,
        });
        onLocalityClick?.(props as LocalityFeature["properties"]);
      }

      if (feature.layer?.id === "buildings-circle") {
        const props = feature.properties;
        setPopup({
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          name: props?.name || "",
          score: props?.score ?? null,
          grade: props?.score_grade ?? null,
        });
        onBuildingClick?.(props as BuildingFeature["properties"]);
      }
    },
    [onLocalityClick, onBuildingClick]
  );

  const handleGeolocate = useCallback(
    (e: { coords: { latitude: number; longitude: number } }) => {
      onLocationDetected?.(e.coords.latitude, e.coords.longitude);
    },
    [onLocationDetected]
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        ...PUNE_CENTER,
        zoom: INITIAL_ZOOM,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      interactiveLayerIds={["locality-fill", "buildings-circle"]}
      onClick={handleMapClick}
      cursor="pointer"
    >
      <NavigationControl position="top-right" />
      <GeolocateControl
        position="top-right"
        trackUserLocation
        showUserHeading
        onGeolocate={handleGeolocate}
      />

      {/* Locality polygons - color-coded by safety score */}
      {localities && (
        <Source id="localities" type="geojson" data={localities as GeoJSON.FeatureCollection}>
          <Layer
            id="locality-fill"
            type="fill"
            paint={{
              "fill-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "safety_score"], 50],
                0, "#ef4444",
                40, "#f97316",
                60, "#eab308",
                80, "#22c55e",
              ],
              "fill-opacity": 0.3,
            }}
          />
          <Layer
            id="locality-border"
            type="line"
            paint={{
              "line-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "safety_score"], 50],
                0, "#ef4444",
                40, "#f97316",
                60, "#eab308",
                80, "#22c55e",
              ],
              "line-width": 2,
              "line-opacity": 0.8,
            }}
          />
          <Layer
            id="locality-label"
            type="symbol"
            layout={{
              "text-field": ["get", "name"],
              "text-size": 12,
              "text-anchor": "center",
            }}
            paint={{
              "text-color": "#ffffff",
              "text-halo-color": "#000000",
              "text-halo-width": 1,
            }}
          />
        </Source>
      )}

      {/* Building markers - appear at higher zoom levels */}
      {buildings && (
        <Source id="buildings" type="geojson" data={buildings as GeoJSON.FeatureCollection}>
          <Layer
            id="buildings-circle"
            type="circle"
            minzoom={14}
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                14, 4,
                18, 12,
              ],
              "circle-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "score"], 50],
                0, "#ef4444",
                40, "#f97316",
                60, "#eab308",
                80, "#22c55e",
              ],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.9,
            }}
          />
        </Source>
      )}

      {/* Popup on click */}
      {popup && (
        <Popup
          latitude={popup.lat}
          longitude={popup.lng}
          onClose={() => setPopup(null)}
          closeButton={true}
          closeOnClick={false}
          anchor="bottom"
        >
          <div className="p-2 text-sm">
            <p className="font-semibold text-gray-900">{popup.name}</p>
            {popup.score !== null && (
              <p className="text-gray-600">
                Safety: <span className="font-bold">{popup.grade}</span> ({popup.score}/100)
              </p>
            )}
          </div>
        </Popup>
      )}
    </Map>
  );
}
