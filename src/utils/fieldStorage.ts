import { PoiCollection, PoiFeature } from '../types';
import { getAdminPinHash, getSavedGithubToken } from './adminAuth';

const CUSTOM_POIS_KEY = 'bosco_admin_custom_pois_v1';
const DELETED_POIS_KEY = 'bosco_admin_deleted_pois_v1';
const LEGACY_CUSTOM_POIS_KEY = 'bosco_field_custom_pois_v1';
const LEGACY_TRAIL_REPORTS_KEY = 'bosco_field_trail_reports_v1';

export function cleanupLegacyPublicDrafts(): void {
  try {
    localStorage.removeItem(LEGACY_TRAIL_REPORTS_KEY);
  } catch {
    // ignore
  }
}

export function loadCustomPois(): PoiFeature[] {
  try {
    const raw =
      localStorage.getItem(CUSTOM_POIS_KEY) ??
      localStorage.getItem(LEGACY_CUSTOM_POIS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPois(pois: PoiFeature[]): void {
  try {
    localStorage.setItem(CUSTOM_POIS_KEY, JSON.stringify(pois));
    localStorage.removeItem(LEGACY_CUSTOM_POIS_KEY);
  } catch {
    // ignore
  }
}

export function loadDeletedPoiIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_POIS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDeletedPoiIds(ids: string[]): void {
  try {
    localStorage.setItem(DELETED_POIS_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function clearAdminDrafts(): void {
  try {
    localStorage.removeItem(CUSTOM_POIS_KEY);
    localStorage.removeItem(DELETED_POIS_KEY);
    localStorage.removeItem(LEGACY_CUSTOM_POIS_KEY);
    localStorage.removeItem(LEGACY_TRAIL_REPORTS_KEY);
  } catch {
    // ignore
  }
}

export function mergePoisWithAdminChanges(
  basePois: PoiCollection,
  customPois: PoiFeature[],
  deletedPoiIds: string[]
): PoiCollection {
  if (customPois.length === 0 && deletedPoiIds.length === 0) return basePois;
  const deletedSet = new Set(deletedPoiIds);
  const byId = new Map<string, PoiFeature>();
  for (const f of basePois.features) {
    if (!deletedSet.has(f.properties.id)) {
      byId.set(f.properties.id, f);
    }
  }
  for (const f of customPois) {
    if (!deletedSet.has(f.properties.id)) {
      byId.set(f.properties.id, f);
    }
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

export interface SavePoisResult {
  ok: boolean;
  mode?: 'local-file' | 'github';
  needsToken?: boolean;
  error?: string;
}

function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function publishPoisToSharedStorage(
  poisCollection: PoiCollection,
  customToken?: string
): Promise<SavePoisResult> {
  const pinHash = getAdminPinHash();
  if (!pinHash) {
    return { ok: false, error: 'Non autenticato come Admin' };
  }

  const githubToken = (customToken ?? getSavedGithubToken()).trim();

  // 1. Try backend endpoint (/api/pois: Vite dev middleware locally, or Cloudflare Pages Function in prod)
  try {
    const res = await fetch('/api/pois', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Pin-Hash': pinHash,
      },
      body: JSON.stringify({
        pois: poisCollection,
        githubToken: githubToken || undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { ok: true, mode: data.mode || 'local-file' };
    }

    if (res.status === 428) {
      return {
        ok: false,
        needsToken: true,
        error: 'Token GitHub richiesto per pubblicare online',
      };
    }

    if (res.status !== 404 && res.status !== 405) {
      const errData = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errData.error || `Errore server (${res.status})`,
      };
    }
  } catch {
    // Fallback to direct GitHub API if /api/pois is unreachable
  }

  // 2. Fallback: direct GitHub Contents API from browser if token is provided
  if (!githubToken) {
    return {
      ok: false,
      needsToken: true,
      error: 'Configura il Token GitHub per salvare direttamente online',
    };
  }

  try {
    const repoPath =
      'https://api.github.com/repos/lukeonesto/bosco-partecipanza-3d/contents/public/data/pois.geojson';
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
    };

    const getRes = await fetch(repoPath, { headers });
    if (!getRes.ok) {
      return {
        ok: false,
        error: `Impossibile leggere il repository GitHub (${getRes.status})`,
      };
    }
    const fileInfo = (await getRes.json()) as { sha: string };

    const contentStr = JSON.stringify(poisCollection, null, 2) + '\n';
    const putRes = await fetch(repoPath, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `chore(pois): aggiorna punti di interesse da pannello Admin (${poisCollection.features.length} POI)`,
        content: encodeBase64Utf8(contentStr),
        sha: fileInfo.sha,
        branch: 'main',
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      return {
        ok: false,
        error: `Errore salvataggio GitHub (${putRes.status}): ${errText.slice(0, 120)}`,
      };
    }

    return { ok: true, mode: 'github' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Errore di rete',
    };
  }
}
