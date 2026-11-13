export type Language = 'it' | 'en';

export type CategoryId =
  | 'panchina'
  | 'area_sosta'
  | 'cestino'
  | 'struttura'
  | 'bacheca'
  | 'fontanella'
  | 'parcheggio'
  | 'ingresso'
  | 'albero_monumentale'
  | 'punto_panoramico'
  | 'zona_umida'
  | 'altro';

export interface CategoryConfig {
  id: CategoryId;
  label_it: string;
  label_en: string;
  color: string;
  emoji: string;
}

export interface PhotoItem {
  url: string;
  didascalia?: string;
  didascalia_en?: string;
  autore?: string;
}

export interface PoiProperties {
  id: string;
  nome: string;
  nome_en?: string;
  categoria: CategoryId;
  sottocategoria?: string | null;
  descrizione: string;
  descrizione_en?: string;
  foto?: PhotoItem[];
  attributi?: Record<string, string | boolean | number>;
  aggiornato_il: string;
  fonte: string;
}

export interface PoiFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: PoiProperties;
}

export interface TrailProperties {
  id: string;
  nome: string;
  nome_en?: string;
  tipo?: string;
  lunghezza_m: number;
  tempo_percorrenza_min: number;
  difficolta: string;
  fondo?: string;
  descrizione: string;
  descrizione_en?: string;
  aggiornato_il: string;
  fonte: string;
}

export interface TrailFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: TrailProperties;
}

export interface PoiCollection {
  type: 'FeatureCollection';
  features: PoiFeature[];
}

export interface TrailCollection {
  type: 'FeatureCollection';
  features: TrailFeature[];
}

export type SelectedItem =
  | { kind: 'poi'; feature: PoiFeature }
  | { kind: 'trail'; feature: TrailFeature };
