import { PoiCollection, PoiFeature, TrailReport } from '../types';

const CUSTOM_POIS_KEY = 'bosco_field_custom_pois_v1';
const TRAIL_REPORTS_KEY = 'bosco_field_trail_reports_v1';

export function loadCustomPois(): PoiFeature[] {
  try {
    const raw = localStorage.getItem(CUSTOM_POIS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPois(pois: PoiFeature[]): void {
  localStorage.setItem(CUSTOM_POIS_KEY, JSON.stringify(pois));
}

export function loadTrailReports(): Record<string, TrailReport> {
  try {
    const raw = localStorage.getItem(TRAIL_REPORTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveTrailReports(reports: Record<string, TrailReport>): void {
  localStorage.setItem(TRAIL_REPORTS_KEY, JSON.stringify(reports));
}

export function clearFieldDrafts(): void {
  localStorage.removeItem(CUSTOM_POIS_KEY);
  localStorage.removeItem(TRAIL_REPORTS_KEY);
}

export function mergePoisWithCustom(
  basePois: PoiCollection,
  customPois: PoiFeature[]
): PoiCollection {
  if (customPois.length === 0) return basePois;
  const byId = new Map<string, PoiFeature>();
  for (const f of basePois.features) {
    byId.set(f.properties.id, f);
  }
  for (const f of customPois) {
    byId.set(f.properties.id, f);
  }
  return {
    type: 'FeatureCollection',
    features: Array.from(byId.values()),
  };
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
