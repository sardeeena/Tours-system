const CACHE_PREFIX = 'aat_public_data_v1:';
export const PUBLIC_DATA_CACHE_TTL_MS = 15 * 60 * 1000;
export const PUBLIC_CATALOGUE_CACHE_TTL_MS = 5 * 60 * 1000;

export interface PublicDataCacheEntry<T> {
  data: T;
  updatedAt: number;
  isFresh: boolean;
}

/**
 * Persistent cache for anonymous, published website content only.
 * Never use this for auth, bookings, customer records, availability, or admin data.
 */
export function readPublicDataCache<T>(key: string, ttlMs = PUBLIC_DATA_CACHE_TTL_MS): PublicDataCacheEntry<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; updatedAt?: number; data?: T };
    if (parsed?.version !== 1 || !Number.isFinite(parsed.updatedAt) || !('data' in parsed)) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return {
      data: parsed.data as T,
      updatedAt: Number(parsed.updatedAt),
      isFresh: Date.now() - Number(parsed.updatedAt) < ttlMs,
    };
  } catch {
    return null;
  }
}

export function writePublicDataCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      version: 1,
      updatedAt: Date.now(),
      data,
    }));
    const entries: Array<{ key: string; updatedAt: number }> = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storedKey = window.localStorage.key(index);
      if (!storedKey?.startsWith(CACHE_PREFIX)) continue;
      try {
        const value = JSON.parse(window.localStorage.getItem(storedKey) || 'null');
        entries.push({ key: storedKey, updatedAt: Number(value?.updatedAt) || 0 });
      } catch {
        window.localStorage.removeItem(storedKey);
      }
    }
    entries.sort((a, b) => a.updatedAt - b.updatedAt);
    while (entries.length > 40) {
      const oldest = entries.shift();
      if (oldest && oldest.key !== CACHE_PREFIX + key) window.localStorage.removeItem(oldest.key);
    }
  } catch {
    // Storage is an optional performance layer; the live request remains authoritative.
  }
}

export function clearPublicDataCache(key?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (key) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return;
    }
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const storedKey = window.localStorage.key(index);
      if (storedKey?.startsWith(CACHE_PREFIX)) window.localStorage.removeItem(storedKey);
    }
  } catch {
    // Ignore storage restrictions and continue with in-memory data.
  }
}
