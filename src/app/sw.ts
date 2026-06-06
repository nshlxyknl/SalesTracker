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
  // Don't fallback to offline page - let the app handle offline state
  // The app is fully functional offline with cached resources
  fallbacks: undefined,
});

// Handle navigation requests specifically for PWA offline support
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-navigation requests - let Serwist handle them
  if (request.mode !== 'navigate') {
    return;
  }

  // Skip API calls and special routes
  if (url.pathname.startsWith('/api/') || 
      url.pathname.startsWith('/_next/') ||
      url.pathname.startsWith('/serwist/')) {
    return;
  }

  // For navigation requests, implement Cache-First strategy
  event.respondWith(
    (async () => {
      try {
        // First, try to get from cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          console.log('[SW] Serving from cache:', url.pathname);
          return cachedResponse;
        }

        // If not in cache and online, try network
        if (navigator.onLine) {
          console.log('[SW] Fetching from network:', url.pathname);
          const networkResponse = await fetch(request);
          
          // Cache the response for future offline use
          if (networkResponse.ok) {
            const cache = await caches.open('navigation-cache');
            cache.put(request, networkResponse.clone());
          }
          
          return networkResponse;
        }

        // If offline and not in cache, try to serve the index page
        // The React app will handle client-side routing
        console.log('[SW] Offline - serving index page for:', url.pathname);
        const indexResponse = await caches.match('/');
        if (indexResponse) {
          return indexResponse;
        }

        // Last resort: return minimal offline page
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body><script>window.location.href="/";</script></body></html>',
          {
            status: 200,
            headers: new Headers({
              'Content-Type': 'text/html',
            }),
          }
        );
      } catch (error) {
        console.error('[SW] Fetch error:', error);
        
        // On any error, try to serve index page
        const indexResponse = await caches.match('/');
        if (indexResponse) {
          return indexResponse;
        }

        // Absolute last resort
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body><script>window.location.href="/";</script></body></html>',
          {
            status: 200,
            headers: new Headers({
              'Content-Type': 'text/html',
            }),
          }
        );
      }
    })()
  );
});

serwist.addEventListeners();
