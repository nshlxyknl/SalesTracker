/**
 * Cache Management Utilities for PWA
 * 
 * This module provides utilities for managing cache storage,
 * implementing cache strategies, and handling offline resources.
 */

export interface CacheConfig {
  name: string;
  maxEntries: number;
  maxAgeSeconds: number;
  strategy: 'CacheFirst' | 'NetworkFirst' | 'StaleWhileRevalidate';
}

export interface CacheEntry {
  url: string;
  timestamp: number;
  expiry: number;
  size?: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private cacheConfigs: Map<string, CacheConfig> = new Map();

  private constructor() {
    // Initialize default cache configurations
    this.cacheConfigs.set('static', {
      name: 'sales-tracker-static-v1',
      maxEntries: 100,
      maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      strategy: 'CacheFirst'
    });

    this.cacheConfigs.set('api', {
      name: 'sales-tracker-api-v1',
      maxEntries: 100,
      maxAgeSeconds: 60 * 60 * 24, // 1 day
      strategy: 'NetworkFirst'
    });

    this.cacheConfigs.set('dynamic', {
      name: 'sales-tracker-dynamic-v1',
      maxEntries: 50,
      maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      strategy: 'StaleWhileRevalidate'
    });
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Add or update a cache configuration
   */
  public setCacheConfig(key: string, config: CacheConfig): void {
    this.cacheConfigs.set(key, config);
  }

  /**
   * Get cache configuration by key
   */
  public getCacheConfig(key: string): CacheConfig | undefined {
    return this.cacheConfigs.get(key);
  }

  /**
   * Cache a resource with the specified strategy
   */
  public async cacheResource(
    request: Request | string,
    cacheKey: string = 'dynamic'
  ): Promise<Response | null> {
    const config = this.cacheConfigs.get(cacheKey);
    if (!config) {
      throw new Error(`Cache configuration not found: ${cacheKey}`);
    }

    const requestObj = typeof request === 'string' ? new Request(request) : request;

    try {
      switch (config.strategy) {
        case 'CacheFirst':
          return await this.cacheFirstStrategy(requestObj, config);
        case 'NetworkFirst':
          return await this.networkFirstStrategy(requestObj, config);
        case 'StaleWhileRevalidate':
          return await this.staleWhileRevalidateStrategy(requestObj, config);
        default:
          throw new Error(`Unknown cache strategy: ${config.strategy}`);
      }
    } catch (error) {
      console.error('[CacheManager] Error caching resource:', error);
      return null;
    }
  }

  /**
   * Cache-first strategy implementation
   */
  private async cacheFirstStrategy(
    request: Request,
    config: CacheConfig
  ): Promise<Response | null> {
    const cache = await caches.open(config.name);
    const cachedResponse = await cache.match(request);

    if (cachedResponse && !this.isExpired(cachedResponse, config.maxAgeSeconds)) {
      // Update cache in background
      this.updateCacheInBackground(request, cache);
      return cachedResponse;
    }

    // Fetch from network
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        await cache.put(request, networkResponse.clone());
        await this.limitCacheSize(config.name, config.maxEntries);
      }
      return networkResponse;
    } catch (error) {
      // Return stale cache if network fails
      return cachedResponse || null;
    }
  }

  /**
   * Network-first strategy implementation
   */
  private async networkFirstStrategy(
    request: Request,
    config: CacheConfig
  ): Promise<Response | null> {
    const cache = await caches.open(config.name);

    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        await cache.put(request, networkResponse.clone());
        await this.limitCacheSize(config.name, config.maxEntries);
      }
      return networkResponse;
    } catch (error) {
      // Fallback to cache
      const cachedResponse = await cache.match(request);
      return cachedResponse || null;
    }
  }

  /**
   * Stale-while-revalidate strategy implementation
   */
  private async staleWhileRevalidateStrategy(
    request: Request,
    config: CacheConfig
  ): Promise<Response | null> {
    const cache = await caches.open(config.name);
    const cachedResponse = await cache.match(request);

    // Always try to update cache in background
    this.updateCacheInBackground(request, cache, config);

    // Return cached response immediately if available
    if (cachedResponse) {
      return cachedResponse;
    }

    // If no cache, wait for network
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        await cache.put(request, networkResponse.clone());
        await this.limitCacheSize(config.name, config.maxEntries);
      }
      return networkResponse;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update cache in background without blocking
   */
  private updateCacheInBackground(
    request: Request,
    cache: Cache,
    config?: CacheConfig
  ): void {
    fetch(request)
      .then(response => {
        if (response.ok) {
          cache.put(request, response);
          if (config) {
            this.limitCacheSize(config.name, config.maxEntries);
          }
        }
      })
      .catch(() => {
        // Ignore background update errors
      });
  }

  /**
   * Check if a cached response is expired
   */
  private isExpired(response: Response, maxAgeSeconds: number): boolean {
    const dateHeader = response.headers.get('date');
    if (!dateHeader) return false;

    const responseDate = new Date(dateHeader).getTime();
    const now = Date.now();
    const age = (now - responseDate) / 1000;

    return age > maxAgeSeconds;
  }

  /**
   * Limit cache size by removing oldest entries
   */
  public async limitCacheSize(cacheName: string, maxEntries: number): Promise<void> {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();

      if (keys.length > maxEntries) {
        const entriesToDelete = keys.length - maxEntries;
        for (let i = 0; i < entriesToDelete; i++) {
          await cache.delete(keys[i]);
        }
        console.log(`[CacheManager] Cleaned ${entriesToDelete} entries from ${cacheName}`);
      }
    } catch (error) {
      console.error(`[CacheManager] Error limiting cache size for ${cacheName}:`, error);
    }
  }

  /**
   * Clean expired entries from a cache
   */
  public async cleanExpiredEntries(cacheName: string, maxAgeSeconds: number): Promise<void> {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      let cleanedCount = 0;

      for (const request of keys) {
        const response = await cache.match(request);
        if (response && this.isExpired(response, maxAgeSeconds)) {
          await cache.delete(request);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`[CacheManager] Cleaned ${cleanedCount} expired entries from ${cacheName}`);
      }
    } catch (error) {
      console.error(`[CacheManager] Error cleaning expired entries for ${cacheName}:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(cacheName: string): Promise<{
    entryCount: number;
    totalSize: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      let totalSize = 0;
      let oldestDate: Date | null = null;
      let newestDate: Date | null = null;

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          // Estimate size (not exact, but useful for monitoring)
          const text = await response.clone().text();
          totalSize += text.length;

          const dateHeader = response.headers.get('date');
          if (dateHeader) {
            const date = new Date(dateHeader);
            if (!oldestDate || date < oldestDate) {
              oldestDate = date;
            }
            if (!newestDate || date > newestDate) {
              newestDate = date;
            }
          }
        }
      }

      return {
        entryCount: keys.length,
        totalSize,
        oldestEntry: oldestDate,
        newestEntry: newestDate
      };
    } catch (error) {
      console.error(`[CacheManager] Error getting cache stats for ${cacheName}:`, error);
      return {
        entryCount: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }
  }

  /**
   * Clear all caches
   */
  public async clearAllCaches(): Promise<void> {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('[CacheManager] All caches cleared');
    } catch (error) {
      console.error('[CacheManager] Error clearing caches:', error);
    }
  }

  /**
   * Preload critical resources
   */
  public async preloadCriticalResources(urls: string[]): Promise<void> {
    const cache = await caches.open(this.cacheConfigs.get('static')!.name);
    
    const preloadPromises = urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn(`[CacheManager] Failed to preload: ${url}`, error);
      }
    });

    await Promise.all(preloadPromises);
    console.log(`[CacheManager] Preloaded ${urls.length} critical resources`);
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();

// Utility functions
export function isCacheSupported(): boolean {
  return 'caches' in window;
}

export function getCacheStorageEstimate(): Promise<StorageEstimate | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    return navigator.storage.estimate();
  }
  return Promise.resolve(null);
}

export async function getCacheUsage(): Promise<{
  used: number;
  quota: number;
  percentage: number;
} | null> {
  const estimate = await getCacheStorageEstimate();
  if (estimate && estimate.usage !== undefined && estimate.quota !== undefined) {
    return {
      used: estimate.usage,
      quota: estimate.quota,
      percentage: (estimate.usage / estimate.quota) * 100
    };
  }
  return null;
}