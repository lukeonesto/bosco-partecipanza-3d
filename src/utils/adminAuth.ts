/// <reference types="vite/client" />

const ADMIN_STORAGE_KEY = 'bosco_admin_unlocked';

// Default SHA-256 of "bosco2026" (override with VITE_ADMIN_PIN_HASH in Cloudflare Pages)
const DEFAULT_PIN_HASH =
  '71687d11c4e1638e67fd039748a0b2bc941632b0d56d3fd7a06acd14d10e26ae';

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isAdminUnlocked(): boolean {
  try {
    return localStorage.getItem(ADMIN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function lockAdmin(): void {
  try {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const trimmed = pin.trim();
  if (!trimmed) return false;

  const expectedHash = (
    import.meta.env.VITE_ADMIN_PIN_HASH || DEFAULT_PIN_HASH
  ).toLowerCase();

  const actualHash = await sha256Hex(trimmed);
  if (actualHash === expectedHash) {
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    return true;
  }
  return false;
}
