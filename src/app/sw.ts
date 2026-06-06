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

// Add custom fetch event handler to ensure offline navigation works properly
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // For navigation requests (page loads), try cache first, then network
  // This ensures the app works offline without showing error pages
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try to get from cache first
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // If not in cache, try network
          return await fetch(request);
        } catch (error) {
          // If offline and no cache, try to return the index page
          const indexCache = await caches.match('/');
          if (indexCache) {
            return indexCache;
          }
          
          // Last resort: return a basic offline response
          return new Response('Offline - Please check your connection', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain',
            }),
          });
        }
      })()
    );
    return;
  }
});

serwist.addEventListeners();
