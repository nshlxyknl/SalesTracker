/**
 * Sync Utilities
 * 
 * This module provides utility functions for integrating sync operations
 * with existing data operations, including offline-first patterns and
 * automatic sync queue management.
 */

import { offlineStorage, generateLocalId, isOnline } from './offline-storage';
import { queueSyncOperation } from './sync-manager';
import type { VanLoad, Sale, BillSubmission } from '../types/database';
import { SyncOperation } from '../types/pwa';

/**
 * Offline-first data operation wrapper
 * This function handles storing data locally and queuing sync operations
 */
export async function performOfflineFirstOperation<T>(
  operation: {
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    endpoint: string;
    data: T;
    localStorageKey?: string;
    optimisticUpdate?: () => Promise<void>;
  }
): Promise<{ localId: string; success: boolean }> {
  const localId = generateLocalId();
  
  try {
    // Perform optimistic update if provided
    if (operation.optimisticUpdate) {
      await operation.optimisticUpdate();
    }

    // Store data locally with sync status
    const localData = {
      ...operation.data,
      localId,
      lastModified: new Date(),
      syncStatus: 'pending' as const
    };

    // Store in appropriate local storage based on endpoint
    if (operation.endpoint.includes('/van-load')) {
      await offlineStorage.storeVanLoad(localData);
    } else if (operation.endpoint.includes('/sales')) {
      await offlineStorage.storeSale(localData);
    } else if (operation.endpoint.includes('/bill-submissions')) {
      await offlineStorage.storeBillSubmission(localData);
    } else if (operation.localStorageKey) {
      await offlineStorage.store(operation.localStorageKey, localData);
    }

    // Queue sync operation
    const syncOperation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'> = {
      type: operation.type,
      endpoint: operation.endpoint,
      data: { ...operation.data, localId },
      maxRetries: 3
    };

    await queueSyncOperation(syncOperation);

    console.log(`[SyncUtils] Queued ${operation.type} operation for ${operation.endpoint}`);
    return { localId, success: true };
  } catch (error) {
    console.error('[SyncUtils] Failed to perform offline-first operation:', error);
    return { localId, success: false };
  }
}

/**
 * Create van load with offline support
 */
export async function createVanLoadOffline(vanLoadData: {
  userId: string;
  date: string;
  itemName: string;
  loaded: number;
  returned: number;
}) {
  return performOfflineFirstOperation({
    type: 'CREATE',
    endpoint: '/api/van-load',
    data: vanLoadData
  });
}

/**
 * Update van load with offline support
 */
export async function updateVanLoadOffline(vanLoadData: {
  id?: string;
  localId?: string;
  userId: string;
  date: string;
  itemName: string;
  loaded: number;
  returned: number;
}) {
  return performOfflineFirstOperation({
    type: 'UPDATE',
    endpoint: '/api/van-load',
    data: vanLoadData
  });
}

/**
 * Delete van load with offline support
 */
export async function deleteVanLoadOffline(vanLoadId: string) {
  return performOfflineFirstOperation({
    type: 'DELETE',
    endpoint: '/api/van-load',
    data: { id: vanLoadId }
  });
}

/**
 * Create sale with offline support
 */
export async function createSaleOffline(saleData: {
  userId: string;
  billNumber: string;
  billTitle: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  billImageBase64?: string;
  billImageName?: string;
}) {
  return performOfflineFirstOperation({
    type: 'CREATE',
    endpoint: '/api/sales',
    data: saleData
  });
}

/**
 * Update sale with offline support
 */
export async function updateSaleOffline(saleData: {
  id?: string;
  localId?: string;
  userId: string;
  billNumber: string;
  billTitle: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  billImageBase64?: string;
  billImageName?: string;
}) {
  return performOfflineFirstOperation({
    type: 'UPDATE',
    endpoint: '/api/sales',
    data: saleData
  });
}

/**
 * Delete sale with offline support
 */
export async function deleteSaleOffline(saleId: string) {
  return performOfflineFirstOperation({
    type: 'DELETE',
    endpoint: '/api/sales',
    data: { id: saleId }
  });
}

/**
 * Create bill submission with offline support
 */
export async function createBillSubmissionOffline(billData: {
  userId: string;
  billNumber: string;
  imageData: string;
  imageName: string;
  selectedItems: Record<string, unknown>;
}) {
  return performOfflineFirstOperation({
    type: 'CREATE',
    endpoint: '/api/bill-submissions',
    data: billData
  });
}

/**
 * Update bill submission with offline support
 */
export async function updateBillSubmissionOffline(billData: {
  id?: string;
  localId?: string;
  userId: string;
  billNumber: string;
  imageData: string;
  imageName: string;
  selectedItems: Record<string, unknown>;
  processed?: boolean;
}) {
  return performOfflineFirstOperation({
    type: 'UPDATE',
    endpoint: '/api/bill-submissions',
    data: billData
  });
}

/**
 * Get local data with fallback to server
 */
export async function getDataWithFallback<T>(
  localGetter: () => Promise<T[]>,
  serverEndpoint: string,
  cacheKey?: string
): Promise<T[]> {
  try {
    // Always try to get local data first
    const localData = await localGetter();
    
    // If online, try to fetch fresh data from server
    if (isOnline()) {
      try {
        const response = await fetch(serverEndpoint);
        if (response.ok) {
          const serverData = await response.json();
          
          // Cache server data locally if cache key provided
          if (cacheKey) {
            await offlineStorage.store(cacheKey, serverData);
          }
          
          // Return server data if available
          return serverData;
        }
      } catch (error) {
        console.warn('[SyncUtils] Failed to fetch from server, using local data:', error);
      }
    }
    
    // Return local data as fallback
    return localData;
  } catch (error) {
    console.error('[SyncUtils] Failed to get data:', error);
    return [];
  }
}

/**
 * Get van loads with offline support
 */
export async function getVanLoadsOffline(userId?: string, date?: string): Promise<VanLoad[]> {
  return getDataWithFallback<VanLoad>(
    async () => {
      const data = await offlineStorage.getVanLoads(userId);
      return data as unknown as VanLoad[];
    },
    `/api/van-load${userId ? `?userId=${userId}` : ''}${date ? `&date=${date}` : ''}`,
    `vanLoads_${userId || 'all'}_${date || 'all'}`
  );
}

/**
 * Get sales with offline support
 */
export async function getSalesOffline(userId?: string): Promise<Sale[]> {
  return getDataWithFallback<Sale>(
    async () => {
      const data = await offlineStorage.getSales(userId);
      return data as unknown as Sale[];
    },
    `/api/sales${userId ? `?userId=${userId}` : ''}`,
    `sales_${userId || 'all'}`
  );
}

/**
 * Get bill submissions with offline support
 */
export async function getBillSubmissionsOffline(userId?: string): Promise<BillSubmission[]> {
  return getDataWithFallback<BillSubmission>(
    async () => {
      const data = await offlineStorage.getBillSubmissions(userId);
      return data as unknown as BillSubmission[];
    },
    `/api/bill-submissions${userId ? `?userId=${userId}` : ''}`,
    `billSubmissions_${userId || 'all'}`
  );
}

/**
 * Merge local and server data, handling conflicts
 */
export function mergeDataWithConflictDetection<T extends { id?: string; localId?: string; lastModified?: Date }>(
  localData: T[],
  serverData: T[]
): {
  merged: T[];
  conflicts: Array<{ local: T; server: T }>;
} {
  const merged: T[] = [];
  const conflicts: Array<{ local: T; server: T }> = [];
  
  // Create maps for efficient lookup
  const serverMap = new Map<string, T>();
  const localMap = new Map<string, T>();
  
  serverData.forEach(item => {
    if (item.id) {
      serverMap.set(item.id, item);
    }
  });
  
  localData.forEach(item => {
    if (item.localId) {
      localMap.set(item.localId, item);
    }
  });
  
  // Process server data first
  serverData.forEach(serverItem => {
    const matchingLocal = localData.find(local => 
      local.id === serverItem.id || 
      (local.localId && serverItem.id && local.localId === serverItem.id)
    );
    
    if (matchingLocal) {
      // Check for conflicts based on modification time
      const serverTime = new Date(serverItem.lastModified || 0).getTime();
      const localTime = new Date(matchingLocal.lastModified || 0).getTime();
      
      if (Math.abs(serverTime - localTime) > 1000) { // 1 second tolerance
        conflicts.push({ local: matchingLocal, server: serverItem });
      }
      
      // Use server data as authoritative
      merged.push(serverItem);
    } else {
      // Server-only item
      merged.push(serverItem);
    }
  });
  
  // Add local-only items (not yet synced)
  localData.forEach(localItem => {
    const hasServerMatch = serverData.some(server => 
      server.id === localItem.id || 
      (localItem.localId && server.id && localItem.localId === server.id)
    );
    
    if (!hasServerMatch) {
      merged.push(localItem);
    }
  });
  
  return { merged, conflicts };
}

/**
 * Check if device has sufficient storage for offline operations
 */
export async function checkStorageQuota(): Promise<{
  available: number;
  used: number;
  quota: number;
  percentage: number;
  hasSpace: boolean;
}> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const used = estimate.usage || 0;
      const available = quota - used;
      const percentage = quota > 0 ? (used / quota) * 100 : 0;
      const hasSpace = percentage < 90; // Consider 90% as threshold
      
      return {
        available,
        used,
        quota,
        percentage,
        hasSpace
      };
    }
  } catch (error) {
    console.error('[SyncUtils] Failed to check storage quota:', error);
  }
  
  // Fallback values
  return {
    available: 0,
    used: 0,
    quota: 0,
    percentage: 0,
    hasSpace: true
  };
}

/**
 * Clean up old offline data to free storage space
 */
export async function cleanupOldOfflineData(daysToKeep: number = 30): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    // This would need to be implemented in the offline storage manager
    // For now, we'll just log the cleanup attempt
    console.log(`[SyncUtils] Would clean up offline data older than ${cutoffDate.toISOString()}`);
    
    // In a real implementation, you would:
    // 1. Get all local data
    // 2. Filter by lastModified date
    // 3. Remove old entries that are already synced
    // 4. Keep unsynced data regardless of age
  } catch (error) {
    console.error('[SyncUtils] Failed to cleanup old offline data:', error);
  }
}

/**
 * Export sync utilities for batch operations
 */
export const syncUtils = {
  performOfflineFirstOperation,
  createVanLoadOffline,
  updateVanLoadOffline,
  deleteVanLoadOffline,
  createSaleOffline,
  updateSaleOffline,
  deleteSaleOffline,
  createBillSubmissionOffline,
  updateBillSubmissionOffline,
  getDataWithFallback,
  getVanLoadsOffline,
  getSalesOffline,
  getBillSubmissionsOffline,
  mergeDataWithConflictDetection,
  checkStorageQuota,
  cleanupOldOfflineData
};