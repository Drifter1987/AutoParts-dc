import type { VINDecodeResult } from '../types';

const KEY = 'autoparts.last-vin.v1';

interface CachedVin {
  result: VINDecodeResult;
  savedAt: string;
}

function readCache(): Record<string, CachedVin> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function cacheVinResult(result: VINDecodeResult): void {
  try {
    const cache = readCache();
    cache[result.vin] = { result, savedAt: new Date().toISOString() };
    const entries = Object.entries(cache)
      .sort((a, b) => b[1].savedAt.localeCompare(a[1].savedAt))
      .slice(0, 8);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Offline cache is best-effort only.
  }
}

export function getCachedVinResult(vin: string): CachedVin | null {
  return readCache()[vin] ?? null;
}
