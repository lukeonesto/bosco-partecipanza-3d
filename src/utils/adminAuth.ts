/// <reference types="vite/client" />

const ADMIN_SESSION_KEY = 'bosco_admin_session_hash';
const LEGACY_ADMIN_STORAGE_KEY = 'bosco_admin_unlocked';
const ADMIN_GH_TOKEN_KEY = 'bosco_admin_gh_token';

// Default SHA-256 of "bosco2026" (override with VITE_ADMIN_PIN_HASH in Cloudflare Pages)
export const DEFAULT_PIN_HASH =
  '71687d11c4e1638e67fd039748a0b2bc941632b0d56d3fd7a06acd14d10e26ae';

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getExpectedPinHash(): string {
  return (import.meta.env.VITE_ADMIN_PIN_HASH || DEFAULT_PIN_HASH).toLowerCase();
}

export function isAdminUnlocked(): boolean {
  try {
    // Clear legacy persistent localStorage flag so public users never stay unlocked across sessions
    localStorage.removeItem(LEGACY_ADMIN_STORAGE_KEY);
    const savedHash = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return savedHash === getExpectedPinHash();
  } catch {
    return false;
  }
}

export function getAdminPinHash(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY);
  } catch {
    return null;
  }
}

export function lockAdmin(): void {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(LEGACY_ADMIN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const trimmed = pin.trim();
  if (!trimmed) return false;

  const expectedHash = getExpectedPinHash();
  const actualHash = await sha256Hex(trimmed);
  if (actualHash === expectedHash) {
    try {
      sessionStorage.setItem(ADMIN_SESSION_KEY, actualHash);
    } catch {
      // ignore
    }
    return true;
  }
  return false;
}

export function getSavedGithubToken(): string {
  try {
    return localStorage.getItem(ADMIN_GH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function saveGithubToken(token: string): void {
  try {
    if (token.trim()) {
      localStorage.setItem(ADMIN_GH_TOKEN_KEY, token.trim());
    } else {
      localStorage.removeItem(ADMIN_GH_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}
