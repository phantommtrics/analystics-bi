const CACHE_NAME = 'aps-bi-v3'
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg']

function shouldCacheRequest(request) {
  if (request.method !== 'GET') return false

  let url
  try {
    url = new URL(request.url)
  } catch {
    return false
  }

  // Cache API only supports http(s). Ignore extensions and other schemes.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  if (url.origin !== self.location.origin) return false

  // Same-origin API calls must never be cached — stale lists hide new orgs, datasources, etc.
  if (url.pathname.startsWith('/api/')) return false

  return (
    APP_SHELL.includes(url.pathname) ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/')
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL)
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (!shouldCacheRequest(event.request)) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(event.request, copy).catch(() => undefined),
            )
          }
          return response
        })
        .catch(() => caches.match('/'))
    }),
  )
})
