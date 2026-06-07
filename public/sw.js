// Sales Tracker PWA Service Worker
// Version 1.0.0

const CACHE_NAME = 'sales-tracker-v1';
const STATIC_CACHE_NAME = 'sales-tracker-static-v1';
const DYNAMIC_CACHE_NAME = 'sales-tracker-dynamic-v1';
const API_CACHE_NAME = 'sales-tracker-api-v1';

// Resources to cache immediately - Critical app resources
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/login',
  '/admin',
  '/admin/van-stock',
  '/admin/sales',
  '/admin/stock-reconciliation',
  '/manifest.json',
  '/icons/icon-72x72.svg',
  '/icons/icon-96x96.svg',
  '/icons/icon-128x128.svg',
  '/icons/icon-144x144.svg',
  '/icons/icon-152x152.svg',
  '/icons/icon-192x192.svg',
  '/icons/icon-384x384.svg',
  '/icons/icon-512x512.svg',
  '/icons/icon-192x192-maskable.svg',
  '/icons/icon-512x512-maskable.svg'
];

// Critical resources that should be cached with high priority
const CRITICAL_RESOURCES = [
  '/api/auth/me',
  '/api/items'
];

// Cache configuration for different resource types
const CACHE_CONFIGS = {
  static: {
    name: STATIC_CACHE_NAME,
    maxEntries: 100,
    maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
  },
  dynamic: {
    name: DYNAMIC_CACHE_NAME,
    maxEntries: 50,
    maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
  },
  api: {
    name: API_CACHE_NAME,
    maxEntries: 100,
    maxAgeSeconds: 60 * 60 * 24, // 1 day
  }
};

// API endpoints to cache with different strategies
const API_CACHE_PATTERNS = [
  { pattern: /\/api\/auth\/me/, strategy: 'networkFirst' },
  { pattern: /\/api\/sales/, strategy: 'networkFirst' },
  { pattern: /\/api\/van-load/, strategy: 'networkFirst' },
  { pattern: /\/api\/users/, strategy: 'cacheFirst' }
];

// Install event - cache static assets and critical resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME)
        .then((cache) => {
          console.log('[SW] Caching static assets');
          return cache.addAll(STATIC_ASSETS);
        }),
      
      // Cache critical resources
      caches.open(API_CACHE_NAME)
        .then((cache) => {
          console.log('[SW] Caching critical resources');
          return Promise.all(
            CRITICAL_RESOURCES.map(url => 
              fetch(url)
                .then(response => response.ok ? cache.put(url, response) : null)
                .catch(() => null) // Ignore failures during install
            )
          );
        })
    ])
    .then(() => {
      console.log('[SW] All assets cached successfully');
      return self.skipWaiting();
    })
    .catch((error) => {
      console.error('[SW] Failed to cache assets:', error);
    })
  );
});

// Activate event - clean up old caches and implement cache size limits
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName !== STATIC_CACHE_NAME && 
                  cacheName !== DYNAMIC_CACHE_NAME && 
                  cacheName !== API_CACHE_NAME) {
                console.log('[SW] Deleting old cache:', cacheName);
                return caches.delete(cacheName);
              }
            })
          );
        }),
      
      // Implement cache size limits
      ...Object.values(CACHE_CONFIGS).map(config => 
        limitCacheSize(config.name, config.maxEntries)
      )
    ])
    .then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - handle requests with caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleStaticAssets(request));
  } else if (url.pathname.startsWith('/icons/')) {
    event.respondWith(handleStaticAssets(request));
  } else {
    event.respondWith(handlePageRequest(request));
  }
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const apiPattern = API_CACHE_PATTERNS.find(p => p.pattern.test(url.pathname));
  const strategy = apiPattern?.strategy || 'networkFirst';
  
  try {
    if (strategy === 'networkFirst') {
      return await networkFirstStrategy(request, API_CACHE_NAME);
    } else if (strategy === 'cacheFirst') {
      return await cacheFirstStrategy(request, API_CACHE_NAME);
    }
  } catch (error) {
    console.error('[SW] API request failed:', error);
    
    // Return cached response if available, otherwise return offline response
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline API response
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'This request requires an internet connection' 
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAssets(request) {
  return await cacheFirstStrategy(request, STATIC_CACHE_NAME);
}

// Handle page requests with network-first strategy
async function handlePageRequest(request) {
  try {
    return await networkFirstStrategy(request, DYNAMIC_CACHE_NAME);
  } catch (error) {
    console.log('[SW] Network failed, serving from cache:', request.url);
    
    // Try to return cached page
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving cached version');
      return cachedResponse;
    }
    
    // Try to serve the dashboard (main page)
    const dashboardResponse = await caches.match('/dashboard');
    if (dashboardResponse) {
      console.log('[SW] Serving dashboard as fallback');
      return dashboardResponse;
    }
    
    // Last resort: serve index page
    const indexResponse = await caches.match('/');
    if (indexResponse) {
      console.log('[SW] Serving index page');
      return indexResponse;
    }
    
    // Absolute fallback - redirect to dashboard
    return Response.redirect('/dashboard', 302);
  }
}

// Network-first caching strategy
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Cache-first strategy with size limits
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Update cache in background
    fetch(request)
      .then(response => {
        if (response.ok) {
          const cache = caches.open(cacheName);
          cache.then(c => {
            c.put(request, response);
            // Apply cache size limits after adding new entries
            const config = Object.values(CACHE_CONFIGS).find(cfg => cfg.name === cacheName);
            if (config) {
              limitCacheSize(cacheName, config.maxEntries);
            }
          });
        }
      })
      .catch(() => {}); // Ignore background update errors
    
    return cachedResponse;
  }
  
  // Not in cache, fetch from network
  const networkResponse = await fetch(request);
  
  if (networkResponse.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, networkResponse.clone());
    
    // Apply cache size limits
    const config = Object.values(CACHE_CONFIGS).find(cfg => cfg.name === cacheName);
    if (config) {
      limitCacheSize(cacheName, config.maxEntries);
    }
  }
  
  return networkResponse;
}

// Cache size limiting function
async function limitCacheSize(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > maxEntries) {
      // Remove oldest entries (FIFO)
      const entriesToDelete = keys.length - maxEntries;
      for (let i = 0; i < entriesToDelete; i++) {
        await cache.delete(keys[i]);
      }
      console.log(`[SW] Cleaned ${entriesToDelete} entries from ${cacheName}`);
    }
  } catch (error) {
    console.error(`[SW] Error limiting cache size for ${cacheName}:`, error);
  }
}

// Enhanced cache cleanup with age-based expiration
async function cleanExpiredCache(cacheName, maxAgeSeconds) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    const now = Date.now();
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const responseDate = new Date(dateHeader).getTime();
          const age = (now - responseDate) / 1000; // age in seconds
          
          if (age > maxAgeSeconds) {
            await cache.delete(request);
            console.log(`[SW] Expired cache entry removed: ${request.url}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`[SW] Error cleaning expired cache for ${cacheName}:`, error);
  }
}

// Background sync for offline operations
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

// Sync offline data when connection is restored
async function syncOfflineData() {
  try {
    console.log('[SW] Syncing offline data...');
    
    // Get offline data from IndexedDB (will be implemented later)
    // For now, just log that sync would happen
    console.log('[SW] Offline data sync completed');
    
    // Notify clients that sync is complete
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: Date.now()
      });
    });
    
  } catch (error) {
    console.error('[SW] Offline data sync failed:', error);
    
    // Notify clients of sync failure
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_FAILED',
        error: error.message,
        timestamp: Date.now()
      });
    });
  }
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: 'You have new updates in Sales Tracker',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/icons/icon-96x96.svg'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-96x96.svg'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Sales Tracker', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});