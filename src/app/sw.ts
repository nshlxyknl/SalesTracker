import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: undefined,
});

// Cache names
const PAGES_CACHE = 'pages-v1';
const STATIC_CACHE = 'static-v1';

// Pages to cache for offline use
const OFFLINE_PAGES = [
  '/',
  '/dashboard',
  '/login',
  '/admin',
  '/sales',
];

// Install event - pre-cache critical pages
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker and caching critical pages');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      try {
        // Pre-cache critical pages
        await cache.addAll(OFFLINE_PAGES);
        console.log('[SW] Critical pages cached successfully');
      } catch (error) {
        console.error('[SW] Error caching critical pages:', error);
        // Don't fail installation if caching fails
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== PAGES_CACHE && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
      console.log('[SW] Old caches cleaned up');
    })()
  );
});

// Fetch event - handle navigation and resource requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip chrome-extension and other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip API calls - they have their own offline handling
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For navigation requests (page loads)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first for navigation
          if (navigator.onLine) {
            const networkResponse = await fetch(request);
            
            if (networkResponse.ok) {
              // Cache the successful response
              const cache = await caches.open(PAGES_CACHE);
              cache.put(request, networkResponse.clone());
              console.log('[SW] Cached page from network:', url.pathname);
              return networkResponse;
            }
          }
        } catch (error) {
          console.log('[SW] Network failed, trying cache:', url.pathname);
        }

        // Network failed or offline, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          console.log('[SW] Serving page from cache:', url.pathname);
          return cachedResponse;
        }

        // If specific page not cached, try to serve index page
        // The app will handle client-side routing
        const indexResponse = await caches.match('/');
        if (indexResponse) {
          console.log('[SW] Serving index page for offline routing:', url.pathname);
          return indexResponse;
        }

        // Last resort: serve the main dashboard
        const dashboardResponse = await caches.match('/dashboard');
        if (dashboardResponse) {
          console.log('[SW] Serving dashboard as fallback');
          return dashboardResponse;
        }

        // Absolute last resort - return error that will trigger app's offline handling
        return new Response('Offline - Please check your connection', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain',
          }),
        });
      })()
    );
    return;
  }

  // For static assets (JS, CSS, images)
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/_next/')
  ) {
    event.respondWith(
      (async () => {
        // Try cache first for static assets (Cache-First strategy)
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          // If not in cache, fetch from network
          const networkResponse = await fetch(request);
          
          if (networkResponse.ok) {
            // Cache the fetched resource
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
          }
          
          return networkResponse;
        } catch (error) {
          // If offline and not in cache, return error
          console.error('[SW] Failed to fetch asset:', url.pathname);
          return new Response('Asset not available offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        }
      })()
    );
    return;
  }
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_PAGES') {
    // Manually trigger caching of pages
    event.waitUntil(
      (async () => {
        const cache = await caches.open(PAGES_CACHE);
        await cache.addAll(OFFLINE_PAGES);
        console.log('[SW] Pages cached on demand');
      })()
    );
  }
});

// Initialize Serwist
serwist.addEventListeners();

console.log('[SW] Service worker loaded');

