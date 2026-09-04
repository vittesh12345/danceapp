/*
 * Service worker: makes Tempo installable and usable offline.
 * - Navigations: network-first, falling back to the cached app shell.
 * - Same-origin static assets (JS/CSS/WASM/pose model/icons): cache-first.
 *   Vite content-hashes its bundles, so a new deploy's index.html (fetched
 *   network-first) naturally points at fresh asset URLs; the wasm/model
 *   files only change with a MediaPipe upgrade — bump CACHE below then.
 */
const CACHE = 'tempo-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match(self.registration.scope)),
        ),
    )
    return
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
