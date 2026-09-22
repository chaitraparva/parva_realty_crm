// Service Worker — network-first strategy.
//
// WHY NETWORK-FIRST (not cache-first):
//   This is a CRM served from Vercel's CDN. Hashed JS/CSS assets are already
//   edge-cached by Vercel with immutable headers so they load fast without SW
//   caching. A cache-first SW that keeps stale bundles is the leading cause of
//   "old version still appearing after deployment" in SPAs.
//
//   With network-first:
//   - When online  → always fetches the fresh asset from the network/CDN.
//   - When offline → falls back to SW cache (good enough for a CRM).
//   - New deployments are always reflected on the next normal page load.
//   - No Ctrl+Shift+R required.
//
// CACHE VERSION: bump this string on every deploy that must force-evict old
// caches (e.g. after a breaking SW change). For normal deployments the
// network-first strategy already picks up new assets without bumping this.
const CACHE_NAME = 'parva-crm-v2'

self.addEventListener('install', (event) => {
  // Activate immediately — don't wait for old tabs to close.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Delete all caches that are not the current version.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Network-first for every GET request.
// On success  → update the cache entry so offline still works later.
// On failure  → serve from cache if available (offline fallback).
// Non-GET     → always bypass the SW (mutations must hit the real server).
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  // Skip cross-origin requests (Supabase API, LiveKit, etc.) — these must
  // never be served from a local SW cache.
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful, non-opaque responses.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})

