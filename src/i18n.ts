import { Language } from './types';

const translations = {
  it: {
    appTitle: 'Bosco della Partecipanza',
    searchPlaceholder: 'Cerca punti, sentieri, cascine...',
    allCategories: 'Tutti',
    trails: 'Sentieri',
    nearestBtn: 'Più vicino',
    nearestPrompt: 'Trova il punto più vicino della categoria:',
    nearestFound: 'Più vicino a te',
    gpsActive: 'GPS attivo',
    gpsOff: 'Centra GPS',
    gpsError: 'GPS non disponibile. Attiva la localizzazione per trovare i punti vicini.',
    gpsAccuracy: 'Precisione GPS',
    reliefLabel: 'Rilievo 3D',
    view3D: '3D',
    view2D: '2D',
    offlineBanner: 'Sei offline: mappa e dati locali attivi',
    onlineOnlyPhotos: 'Foto disponibili solo con connessione di rete',
    noPhotos: 'Nessuna foto ancora disponibile per questo punto.',
    length: 'Lunghezza',
    duration: 'Tempo stimato',
    difficulty: 'Difficoltà',
    surface: 'Fondo',
    distanceFromYou: 'Distanza da te',
    lastUpdated: 'Aggiornato il',
    source: 'Fonte',
    openInMaps: 'Apri indicazioni',
    close: 'Chiudi',
    noResults: 'Nessun risultato trovato',
    trailLabel: 'Sentiero / Percorso',
    attribution: 'Dati: © OpenStreetMap contributors (ODbL) · Rilievo: AWS Terrarium / Geoportale Piemonte',
    cancelNearest: 'Annulla percorso',
    noPoiInCategory: 'Nessun punto disponibile in questa categoria.',
  },
  en: {
    appTitle: 'Partecipanza Woods',
    searchPlaceholder: 'Search POIs, trails, landmarks...',
    allCategories: 'All',
    trails: 'Trails',
    nearestBtn: 'Nearest',
    nearestPrompt: 'Find the nearest point in category:',
    nearestFound: 'Nearest to you',
    gpsActive: 'GPS active',
    gpsOff: 'Center GPS',
    gpsError: 'GPS unavailable. Enable location services to find nearby points.',
    gpsAccuracy: 'GPS accuracy',
    reliefLabel: '3D Relief',
    view3D: '3D',
    view2D: '2D',
    offlineBanner: 'You are offline: local map & data active',
    onlineOnlyPhotos: 'Photos are available only when online',
    noPhotos: 'No photos available for this point yet.',
    length: 'Length',
    duration: 'Est. time',
    difficulty: 'Difficulty',
    surface: 'Surface',
    distanceFromYou: 'Distance from you',
    lastUpdated: 'Last updated',
    source: 'Source',
    openInMaps: 'Open directions',
    close: 'Close',
    noResults: 'No results found',
    trailLabel: 'Trail / Path',
    attribution: 'Data: © OpenStreetMap contributors (ODbL) · Terrain: AWS Terrarium / Geoportale Piemonte',
    cancelNearest: 'Clear guide',
    noPoiInCategory: 'No points available in this category.',
  },
} as const;

export type TranslationKey = keyof typeof translations.it;

export function t(lang: Language, key: TranslationKey): string {
  return translations[lang][key];
}

export function getLocalizedText(
  lang: Language,
  itText: string,
  enText?: string
): string {
  if (lang === 'en' && enText && enText.trim().length > 0) {
    return enText;
  }
  return itText;
}
