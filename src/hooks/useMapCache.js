// hooks/useMapCache.js
const MAX_ENTRIES = 200
const TTL_MS = 5 * 60 * 1000

class MapCache {
  constructor() {
    this.cache = new Map()
  }

  buildKey(bounds, zoom, filters) {
    const { _northEast: ne, _southWest: sw } = bounds
    const precision = zoom >= 14 ? 4 : zoom >= 10 ? 3 : 2
    const round = (n) => parseFloat(n.toFixed(precision))
    return JSON.stringify({
      n: round(ne.lat), s: round(sw.lat),
      e: round(ne.lng), w: round(sw.lng),
      z: zoom,
      f: filters,
    })
  }

  get(bounds, zoom, filters) {
    const key = this.buildKey(bounds, zoom, filters)
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.ts > TTL_MS) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  set(bounds, zoom, filters, data) {
    const key = this.buildKey(bounds, zoom, filters)
    if (this.cache.size >= MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    this.cache.set(key, { data, ts: Date.now() })
  }

  clear() {
    this.cache.clear()
  }
}

export const mapCache = new MapCache()