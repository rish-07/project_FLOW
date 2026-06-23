/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

// SvelteKit auto-registers this file (with the correct base/scope), so there's
// no manual navigator.serviceWorker.register() to maintain — that also keeps it
// Cloudflare-subdomain safe. `build`/`files` already carry the base prefix.
import { build, files, version } from '$service-worker';

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

const CACHE = `cache-${version}`;
// Hashed app chunks + static files (favicon, manifest, icons) — all immutable.
const PRECACHE = [...build, ...files];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  // Drop caches from previous versions so an update can't serve stale assets.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only ever serve our own immutable assets from cache. Cross-origin (the
  // Google Fonts CDN) and API/auth traffic always go to the network so data
  // and session state are never stale — the app's own error states handle
  // offline. Everything else falls through to the browser's default handling.
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api')) return;

  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
  }
});
