import { CategoryConfig, CategoryId, Language } from '../types';

export const CATEGORIES: CategoryConfig[] = [
  { id: 'panchina', label_it: 'Panchine', label_en: 'Benches', color: '#d97706', emoji: '🪑' },
  { id: 'area_sosta', label_it: 'Aree Sosta / Picnic', label_en: 'Picnic Areas', color: '#ea580c', emoji: '🧺' },
  { id: 'cestino', label_it: 'Cestini', label_en: 'Waste Bins', color: '#64748b', emoji: '🗑️' },
  { id: 'fontanella', label_it: 'Fontanelle', label_en: 'Water', color: '#0284c7', emoji: '💧' },
  { id: 'struttura', label_it: 'Strutture & Cascine', label_en: 'Structures', color: '#7c3aed', emoji: '🏠' },
  { id: 'bacheca', label_it: 'Bacheche & Cartelli', label_en: 'Info Boards', color: '#0d9488', emoji: '🪧' },
  { id: 'parcheggio', label_it: 'Parcheggi', label_en: 'Parking', color: '#2563eb', emoji: '🅿️' },
  { id: 'ingresso', label_it: 'Ingressi', label_en: 'Entrances', color: '#16a34a', emoji: '🚪' },
  { id: 'albero_monumentale', label_it: 'Alberi Monumentali', label_en: 'Notable Trees', color: '#15803d', emoji: '🌳' },
  { id: 'punto_panoramico', label_it: 'Punti Panoramici', label_en: 'Viewpoints', color: '#db2777', emoji: '🔭' },
  { id: 'zona_umida', label_it: 'Zone Umide', label_en: 'Wetlands', color: '#0891b2', emoji: '🦆' },
  { id: 'altro', label_it: 'Altro', label_en: 'Other', color: '#475569', emoji: '📍' },
];

export const CATEGORY_MAP: Record<CategoryId, CategoryConfig> = CATEGORIES.reduce(
  (acc, cat) => {
    acc[cat.id] = cat;
    return acc;
  },
  {} as Record<CategoryId, CategoryConfig>
);

export function getCategoryLabel(id: CategoryId, lang: Language): string {
  const cat = CATEGORY_MAP[id] ?? CATEGORY_MAP.altro;
  return lang === 'en' ? cat.label_en : cat.label_it;
}
