// TTL + LRU cache over localStorage for Spoonacular responses (search
// results and recipe details), so repeat/identical requests during a
// session — or across reloads — don't re-hit Spoonacular's daily quota.
// Same defensive style as useGuestStorage.ts: every localStorage access is
// wrapped in try/catch so a private-browsing tab, a full quota, or corrupt
// JSON never breaks the feature — it just falls back to "no cache".

const INDEX_KEY = 'recipe_cache_index'
const MAX_ENTRIES = 360 // ~60 search pages + ~300 recipe details, generous headroom

export const SEARCH_CACHE_TTL_MS = 60 * 60 * 1000 // 1h
export const DETAIL_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h — recipe content barely changes

interface CacheEntry<T> {
  value: T
  savedAt: number
}

interface CacheHit<T> {
  value: T
  stale: boolean
}

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeIndex(keys: string[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(keys))
  } catch {
    // Nothing we can do if even the index can't be written — cache reads
    // will just keep working off whatever entries already exist.
  }
}

function touchIndex(key: string): void {
  const index = readIndex().filter((k) => k !== key)
  index.push(key)
  writeIndex(index)
}

// Evicts the oldest half of the tracked keys (by insertion/touch order).
// Called when the index is over MAX_ENTRIES, or as a retry after a
// QuotaExceededError from localStorage.setItem.
function evictOldest(fraction = 1): void {
  const index = readIndex()
  const dropCount = Math.ceil((index.length * fraction) / 2)
  const toDrop = index.slice(0, dropCount)
  for (const key of toDrop) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore — best effort
    }
  }
  writeIndex(index.slice(dropCount))
}

export function getCached<T>(key: string, maxAgeMs: number): CacheHit<T> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (typeof entry?.savedAt !== 'number') return null
    return { value: entry.value, stale: Date.now() - entry.savedAt > maxAgeMs }
  } catch {
    return null
  }
}

export function setCached<T>(key: string, value: T): void {
  const entry: CacheEntry<T> = { value, savedAt: Date.now() }
  const serialized = JSON.stringify(entry)

  if (readIndex().length >= MAX_ENTRIES) evictOldest()

  try {
    localStorage.setItem(key, serialized)
    touchIndex(key)
  } catch {
    // Likely QuotaExceededError (localStorage full) — evict the oldest half
    // and retry once; if it still fails, give up silently, this is a cache.
    evictOldest()
    try {
      localStorage.setItem(key, serialized)
      touchIndex(key)
    } catch {
      // give up — not caching this entry is fine
    }
  }
}

export function searchCacheKey(
  filters: Record<string, string | undefined>,
  offset: number,
  lang: string,
): string {
  const sortedEntries = Object.entries(filters)
    .filter(([, v]) => !!v)
    .sort(([a], [b]) => a.localeCompare(b))
  return `recipe_cache_search_v1_${offset}_${lang}_${JSON.stringify(sortedEntries)}`
}

export function detailCacheKey(id: number, lang: string): string {
  return `recipe_cache_detail_v1_${id}_${lang}`
}
