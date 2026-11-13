import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { CATEGORIES } from '../data/categories';
import {
  CategoryId,
  Language,
  PoiCollection,
  SelectedItem,
  TrailCollection,
} from '../types';

interface MapViewProps {
  pois: PoiCollection;
  trails: TrailCollection;
  boundary: GeoJSON.FeatureCollection;
  activeCategory: CategoryId | 'all';
  searchQuery: string;
  showTrails: boolean;
  is3D: boolean;
  exaggeration: number;
  lang: Language;
  userLocation: [number, number] | null;
  userAccuracy: number | null;
  nearestPath: [number, number][] | null;
  compassEnabled: boolean;
  compassHeading: number | null;
  onDisableCompass: () => void;
  fieldMode: boolean;
  closedTrailIds: string[];
  onMapClickForPoi: (coords: [number, number]) => void;
  selectedItem: SelectedItem | null;
  onSelectItem: (item: SelectedItem | null) => void;
  flyToCoords: [number, number] | null;
}

// Center of Bosco delle Sorti della Partecipanza (Trino Vercellese)
const INITIAL_CENTER: [number, number] = [8.2528, 45.2245];
const INITIAL_ZOOM = 14.2;

function buildCategoryColorMatch(): maplibregl.ExpressionSpecification {
  const expr: unknown[] = ['match', ['get', 'categoria']];
  for (const cat of CATEGORIES) {
    expr.push(cat.id, cat.color);
  }
  expr.push('#475569');
  return expr as maplibregl.ExpressionSpecification;
}

export function MapView({
  pois,
  trails,
  boundary,
  activeCategory,
  searchQuery,
  showTrails,
  is3D,
  exaggeration,
  lang,
  userLocation,
  nearestPath,
  compassEnabled,
  compassHeading,
  onDisableCompass,
  fieldMode,
  closedTrailIds,
  onMapClickForPoi,
  selectedItem,
  onSelectItem,
  flyToCoords,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const onSelectRef = useRef(onSelectItem);
  onSelectRef.current = onSelectItem;
  const onDisableCompassRef = useRef(onDisableCompass);
  onDisableCompassRef.current = onDisableCompass;
  const fieldModeRef = useRef(fieldMode);
  fieldModeRef.current = fieldMode;
  const onMapClickForPoiRef = useRef(onMapClickForPoi);
  onMapClickForPoiRef.current = onMapClickForPoi;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      pitch: is3D ? 58 : 0,
      bearing: is3D ? -18 : 0,
      maxPitch: 78,
      minZoom: 11,
      maxZoom: 18.5,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'osm-raster': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
            maxzoom: 19,
          },
          'terrain-dem': {
            type: 'raster-dem',
            tiles: [
              'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            encoding: 'terrarium',
            maxzoom: 15,
            attribution: 'Terrain: AWS Open Data / Mapzen',
          },
        },
        layers: [
          {
            id: 'osm-base',
            type: 'raster',
            source: 'osm-raster',
            paint: {
              'raster-saturation': -0.15,
              'raster-contrast': 0.05,
            },
          },
          {
            id: 'terrain-hillshade',
            type: 'hillshade',
            source: 'terrain-dem',
            paint: {
              'hillshade-exaggeration': 0.85,
              'hillshade-shadow-color': '#0f172a',
              'hillshade-highlight-color': '#fef9c3',
              'hillshade-accent-color': '#3f6212',
              'hillshade-illumination-direction': 315,
            },
          },
        ],
        terrain: is3D
          ? { source: 'terrain-dem', exaggeration }
          : undefined,
        sky: {
          'sky-color': '#bae6fd',
          'horizon-color': '#f0fdf4',
          'fog-color': '#e2e8f0',
          'sky-horizon-blend': 0.5,
          'fog-ground-blend': 0.6,
        },
      },
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      'bottom-right'
    );
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
      'bottom-left'
    );

    map.on('load', () => {
      loadedRef.current = true;

      map.addSource('boundary', {
        type: 'geojson',
        data: boundary,
      });
      map.addLayer({
        id: 'boundary-fill',
        type: 'fill',
        source: 'boundary',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': '#15803d',
          'fill-opacity': 0.1,
        },
      });
      map.addLayer({
        id: 'boundary-line',
        type: 'line',
        source: 'boundary',
        paint: {
          'line-color': '#14532d',
          'line-width': 2.5,
          'line-dasharray': [4, 3],
          'line-opacity': 0.85,
        },
      });

      map.addSource('trails', {
        type: 'geojson',
        data: trails,
      });
      map.addLayer({
        id: 'trails-casing',
        type: 'line',
        source: 'trails',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 6],
          'line-opacity': 0.85,
        },
      });
      map.addLayer({
        id: 'trails-line',
        type: 'line',
        source: 'trails',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#b45309',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.8, 16, 3.8],
          'line-dasharray': [2, 1.5],
        },
      });
      // Wide invisible hit area for mobile touch
      map.addLayer({
        id: 'trails-hit',
        type: 'line',
        source: 'trails',
        paint: {
          'line-color': '#000000',
          'line-width': 20,
          'line-opacity': 0,
        },
      });

      map.addSource('nearest-guide', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'nearest-guide-line',
        type: 'line',
        source: 'nearest-guide',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': '#2563eb',
          'line-width': 3.5,
          'line-dasharray': [2, 2],
        },
      });

      map.addSource('pois', {
        type: 'geojson',
        data: pois,
      });
      map.addLayer({
        id: 'pois-circle',
        type: 'circle',
        source: 'pois',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 16, 10],
          'circle-color': buildCategoryColorMatch(),
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.2,
        },
      });
      map.addLayer({
        id: 'pois-label',
        type: 'symbol',
        source: 'pois',
        minzoom: 14.5,
        layout: {
          'text-field': ['get', lang === 'en' ? 'nome_en' : 'nome'],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-max-width': 10,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      });

      map.addSource('user-location', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'user-location-halo',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': 16,
          'circle-color': '#3b82f6',
          'circle-opacity': 0.22,
        },
      });
      map.addLayer({
        id: 'user-location-dot',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': 7,
          'circle-color': '#2563eb',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
        },
      });

      // Interactions
      map.on('click', 'pois-circle', (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const poi = pois.features.find((p) => p.properties.id === feat.properties?.id);
        if (poi) {
          onSelectRef.current({ kind: 'poi', feature: poi });
          map.easeTo({
            center: poi.geometry.coordinates,
            duration: 450,
          });
        }
      });

      map.on('click', 'trails-hit', (e) => {
        // Prefer POI if clicked right on top of one
        const poiHits = map.queryRenderedFeatures(e.point, { layers: ['pois-circle'] });
        if (poiHits.length > 0) return;

        const feat = e.features?.[0];
        if (!feat) return;
        const trail = trails.features.find((t) => t.properties.id === feat.properties?.id);
        if (trail) {
          onSelectRef.current({ kind: 'trail', feature: trail });
        }
      });

      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: ['pois-circle', 'trails-hit'],
        });
        if (hits.length === 0) {
          if (fieldModeRef.current) {
            onMapClickForPoiRef.current([e.lngLat.lng, e.lngLat.lat]);
          } else {
            onSelectRef.current(null);
          }
        }
      });

      for (const layerId of ['pois-circle', 'trails-hit']) {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      map.on('rotatestart', (e) => {
        if (e.originalEvent) {
          onDisableCompassRef.current();
        }
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update GeoJSON data sources when loaded asynchronously
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    (map.getSource('pois') as maplibregl.GeoJSONSource | undefined)?.setData(pois);
  }, [pois]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    (map.getSource('trails') as maplibregl.GeoJSONSource | undefined)?.setData(trails);
  }, [trails]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    (map.getSource('boundary') as maplibregl.GeoJSONSource | undefined)?.setData(boundary);
  }, [boundary]);

  // Filter POIs by category and search query
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    const q = searchQuery.trim().toLowerCase();
    const matchingIds = pois.features
      .filter((p) => {
        const catMatch = activeCategory === 'all' || p.properties.categoria === activeCategory;
        if (!catMatch) return false;
        if (!q) return true;
        const name = (lang === 'en' ? p.properties.nome_en || p.properties.nome : p.properties.nome).toLowerCase();
        const desc = (
          lang === 'en' ? p.properties.descrizione_en || p.properties.descrizione : p.properties.descrizione
        ).toLowerCase();
        return name.includes(q) || desc.includes(q);
      })
      .map((p) => p.properties.id);

    const filterExpr: maplibregl.FilterSpecification = [
      'in',
      ['get', 'id'],
      ['literal', matchingIds],
    ];
    map.setFilter('pois-circle', filterExpr);
    map.setFilter('pois-label', filterExpr);
  }, [pois, activeCategory, searchQuery, lang]);

  // Toggle trails visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const vis = showTrails ? 'visible' : 'none';
    for (const id of ['trails-casing', 'trails-line', 'trails-hit']) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', vis);
      }
    }
  }, [showTrails]);

  // Update label language
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer('pois-label')) return;
    map.setLayoutProperty('pois-label', 'text-field', [
      'coalesce',
      ['get', lang === 'en' ? 'nome_en' : 'nome'],
      ['get', 'nome'],
    ]);
  }, [lang]);

  // Toggle 3D / exaggeration
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (is3D) {
      map.setTerrain({ source: 'terrain-dem', exaggeration });
      if (map.getPitch() < 25) {
        map.easeTo({ pitch: 58, duration: 500 });
      }
    } else {
      map.setTerrain(null);
      map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    }
  }, [is3D, exaggeration]);

  // Update user GPS marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource('user-location') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (!userLocation) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    src.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: userLocation },
          properties: {},
        },
      ],
    });
  }, [userLocation]);

  // Update nearest guide line along trails
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource('nearest-guide') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (!nearestPath || nearestPath.length < 2) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    src.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: nearestPath,
          },
          properties: {},
        },
      ],
    });
  }, [nearestPath]);

  // Rotate map bearing with device compass
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (!compassEnabled || compassHeading === null) return;
    map.easeTo({
      bearing: compassHeading,
      duration: 140,
      easing: (t) => t,
    });
  }, [compassEnabled, compassHeading]);

  // Highlight closed trails in red
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer('trails-line')) return;
    map.setPaintProperty('trails-line', 'line-color', [
      'case',
      ['in', ['get', 'id'], ['literal', closedTrailIds]],
      '#dc2626',
      '#b45309',
    ]);
  }, [closedTrailIds]);

  // Highlight selected POI radius
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer('pois-circle')) return;
    const selectedId = selectedItem?.kind === 'poi' ? selectedItem.feature.properties.id : '';
    map.setPaintProperty('pois-circle', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], selectedId],
      13,
      ['interpolate', ['linear'], ['zoom'], 12, 5, 16, 10],
    ]);
  }, [selectedItem]);

  // Fly to coordinates on request
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToCoords) return;
    map.flyTo({
      center: flyToCoords,
      zoom: Math.max(map.getZoom(), 15.5),
      duration: 650,
    });
  }, [flyToCoords]);

  return <div ref={containerRef} className="h-full w-full" />;
}
