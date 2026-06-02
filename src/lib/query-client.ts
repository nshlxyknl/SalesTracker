import { QueryClient } from '@tanstack/react-query';

// Create query client with offline-first configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed queries 2 times
      retry: (failureCount, error: Error) => {
        // Don't retry if we're offline
        if (typeof window !== 'undefined' && !navigator.onLine) return false;
        // Don't retry 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) return false;
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      // Retry delay increases exponentially
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Don't refetch on window focus if offline
      refetchOnWindowFocus: () => typeof window !== 'undefined' ? navigator.onLine : false,
      // Don't refetch on reconnect (we handle this manually)
      refetchOnReconnect: false,
      // Network mode - always try to fetch, but show cached data if offline
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Don't retry mutations by default (we handle this in our sync layer)
      retry: false,
      // Network mode for mutations
      networkMode: 'offlineFirst',
    },
  },
});

// Simple persistence using localStorage (basic implementation)
let persistPromise: Promise<void> | null = null;

export function initializeQueryPersistence() {
  if (persistPromise) return persistPromise;
  
  persistPromise = (async () => {
    try {
      // Only run in browser
      if (typeof window === 'undefined') return;
      
      // Try to restore cache from localStorage
      const cached = localStorage.getItem('tanstack-query-cache');
      if (cached) {
        const parsedCache = JSON.parse(cached);
        queryClient.setQueryData(['cache-restored'], parsedCache);
        console.log('Query cache restored from localStorage');
      }

      // Save cache to localStorage periodically
      setInterval(() => {
        try {
          const cache = queryClient.getQueryCache();
          localStorage.setItem('tanstack-query-cache', JSON.stringify({
            timestamp: Date.now(),
            queries: cache.getAll().length
          }));
        } catch (error) {
          console.warn('Failed to save query cache:', error);
        }
      }, 60000); // Save every minute

    } catch (error) {
      console.error('Failed to initialize query persistence:', error);
    }
  })();
  
  return persistPromise;
}

// Utility function to invalidate all queries when coming back online
export function invalidateQueriesOnReconnect() {
  queryClient.invalidateQueries();
  queryClient.refetchQueries({
    type: 'active',
  });
}

// Custom hooks for offline-aware queries
export function createOfflineQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: {
    staleTime?: number;
    gcTime?: number;
    enabled?: boolean;
  }
) {
  return {
    queryKey,
    queryFn: async (): Promise<T> => {
      try {
        return await queryFn();
      } catch (error) {
        // If offline, try to return cached data
        if (typeof window !== 'undefined' && !navigator.onLine) {
          const cached = queryClient.getQueryData(queryKey);
          if (cached) {
            console.log(`Using cached data for ${queryKey.join('/')} (offline)`);
            return cached as T;
          }
        }
        throw error;
      }
    },
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
    gcTime: options?.gcTime ?? 10 * 60 * 1000,
    enabled: options?.enabled ?? true,
    networkMode: 'offlineFirst' as const,
  };
}

// Clear all cached data (for logout or data reset)
export async function clearQueryCache() {
  queryClient.clear();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('tanstack-query-cache');
  }
}

// Prefetch important data
export async function prefetchCriticalData(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  // Prefetch today's sales
  queryClient.prefetchQuery({
    queryKey: ['sales', today],
    queryFn: () => fetch(`/api/sales?date=${today}`).then(res => res.json()),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
  
  // Prefetch user stock
  queryClient.prefetchQuery({
    queryKey: ['user-stock', today],
    queryFn: () => fetch(`/api/user-stock?date=${today}`).then(res => res.json()),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Handle online/offline state changes
if (typeof window !== 'undefined') {
  let isOnline = navigator.onLine;

  window.addEventListener('online', () => {
    if (!isOnline) {
      isOnline = true;
      console.log('Back online - invalidating queries');
      invalidateQueriesOnReconnect();
    }
  });

  window.addEventListener('offline', () => {
    if (isOnline) {
      isOnline = false;
      console.log('Gone offline - using cached data');
    }
  });
}

export { queryClient as default };