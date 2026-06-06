import { OfflineStore, OfflineSale } from '../db/offline-db';
import { persistentAuth } from '../auth/persistent-auth';
import { useState, useEffect } from 'react';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  totalSynced: number;
}

export class SyncManager {
  private static instance: SyncManager;
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private lastSyncTime: string | null = null;
  private totalSynced: number = 0;

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  constructor() {
    // Only initialize if in browser
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
    }
    
    this.setupEventListeners();
    this.startPeriodicSync();
    this.loadSyncStats();
  }

  private setupEventListeners(): void {
    // Only set up event listeners in the browser
    if (typeof window === 'undefined') return;
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners();
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners();
    });

    // Listen for page visibility changes to sync when tab becomes active
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.isOnline) {
          this.syncAll();
        }
      });
    }
  }

  private startPeriodicSync(): void {
    // Only start sync interval in browser
    if (typeof window === 'undefined') return;
    
    // Sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncAll();
      }
    }, 30000);
  }

  private async loadSyncStats(): Promise<void> {
    // Only load from localStorage in browser
    if (typeof window === 'undefined') return;
    
    try {
      const stats = await OfflineStore.getStats();
      this.totalSynced = stats.totalSales - stats.unsyncedSales;
      
      // Load last sync time from localStorage
      const lastSync = localStorage.getItem('lastSyncTime');
      this.lastSyncTime = lastSync;
    } catch (error) {
      console.error('Failed to load sync stats:', error);
    }
  }

  /**
   * Add a listener for sync status changes
   */
  addListener(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    // Immediately call with current status
    callback(this.getStatus());
    
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      pendingCount: 0, // Will be updated by async call
      totalSynced: this.totalSynced
    };
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in sync status listener:', error);
      }
    });
  }

  /**
   * Update pending count and notify listeners
   */
  private async updatePendingCount(): Promise<void> {
    try {
      const unsynced = await OfflineStore.getUnsyncedSales();
      const status: SyncStatus = {
        isOnline: this.isOnline,
        isSyncing: this.isSyncing,
        lastSyncTime: this.lastSyncTime,
        pendingCount: unsynced.length,
        totalSynced: this.totalSynced
      };
      
      this.listeners.forEach(callback => {
        try {
          callback(status);
        } catch (error) {
          console.error('Error in sync status listener:', error);
        }
      });
    } catch (error) {
      console.error('Failed to update pending count:', error);
    }
  }

  /**
   * Sync all pending items
   */
  async syncAll(): Promise<SyncResult> {
    if (typeof window === 'undefined' || !this.isOnline) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: ['Device is offline']
      };
    }

    if (this.isSyncing) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: ['Sync already in progress']
      };
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const result = await this.syncSales();
      
      if (result.synced > 0 && typeof window !== 'undefined') {
        this.lastSyncTime = new Date().toISOString();
        this.totalSynced += result.synced;
        localStorage.setItem('lastSyncTime', this.lastSyncTime);
      }

      return result;
    } finally {
      this.isSyncing = false;
      await this.updatePendingCount();
    }
  }

  /**
   * Sync pending sales to server
   */
  private async syncSales(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: []
    };

    try {
      const unsyncedSales = await OfflineStore.getUnsyncedSales();
      
      if (unsyncedSales.length === 0) {
        return result;
      }

      console.log(`Syncing ${unsyncedSales.length} pending sales...`);

      // Group sales by billNumber to sync entire bills together
      const billGroups = new Map<string, OfflineSale[]>();
      for (const sale of unsyncedSales) {
        const billNumber = sale.billNumber;
        if (!billGroups.has(billNumber)) {
          billGroups.set(billNumber, []);
        }
        billGroups.get(billNumber)!.push(sale);
      }

      // Get auth headers
      const authHeaders = await persistentAuth.getAuthHeader();
      
      // Sync each bill (all items together)
      for (const [billNumber, billSales] of billGroups.entries()) {
        try {
          await this.syncBillSales(billSales, authHeaders);
          result.synced += billSales.length;
        } catch (error) {
          result.failed += billSales.length;
          result.errors.push(`Bill ${billNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          // Increment sync attempts for all items in this bill
          for (const sale of billSales) {
            await OfflineStore.incrementSyncAttempts(sale.id);
            
            // If too many attempts, stop trying this bill for a while
            if (sale.syncAttempts >= 5) {
              console.warn(`Bill ${billNumber} failed 5 sync attempts, skipping for now`);
            }
          }
        }
      }

      if (result.failed > 0) {
        result.success = false;
      }

      console.log(`Sync completed: ${result.synced} synced, ${result.failed} failed`);
      
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    }

    return result;
  }

  /**
   * Sync all items from a single bill to the server
   */
  private async syncBillSales(billSales: OfflineSale[], authHeaders: Record<string, string>): Promise<void> {
    if (billSales.length === 0) return;

    // Use the first sale for bill-level data (all items share same bill info)
    const firstSale = billSales[0];
    
    // Prepare all items for this bill
    const items = billSales.map(sale => ({
      itemName: sale.itemName,
      quantity: sale.quantity,
      unitPrice: sale.unitPrice
    }));

    // Use FormData to match the expected format of /api/sales
    const formData = new FormData();
    formData.append('billTitle', firstSale.billTitle);
    formData.append('items', JSON.stringify(items));
    formData.append('paymentMethod', firstSale.paymentMethod);
    
    if (firstSale.billImageBase64) {
      // Convert base64 back to blob for upload
      const byteString = atob(firstSale.billImageBase64.split(',')[1] || firstSale.billImageBase64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: 'image/jpeg' });
      formData.append('billImage', blob, firstSale.billImageName || `${firstSale.billNumber}.jpg`);
    }

    const response = await fetch('/api/sales', {
      method: 'POST',
      headers: {
        // Don't set Content-Type - let browser set it with boundary for FormData
        ...authHeaders
      },
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    const serverResponse = await response.json();
    
    // Mark all items in this bill as synced
    // Server returns array of created sales (one per item)
    if (Array.isArray(serverResponse)) {
      for (let i = 0; i < billSales.length && i < serverResponse.length; i++) {
        const localSale = billSales[i];
        const serverSale = serverResponse[i];
        await OfflineStore.markSaleAsSynced(localSale.id, serverSale.id);
        console.log(`Sale ${localSale.id} (${localSale.itemName}) synced to server ID: ${serverSale.id}`);
      }
    }
  }


  /**
   * Force sync all pending items immediately
   */
  async forceSyncAll(): Promise<SyncResult> {
    return this.syncAll();
  }

  /**
   * Check if there are pending items to sync
   */
  async hasPendingItems(): Promise<boolean> {
    try {
      const unsynced = await OfflineStore.getUnsyncedSales();
      return unsynced.length > 0;
    } catch (error) {
      console.error('Failed to check pending items:', error);
      return false;
    }
  }

  /**
   * Get detailed sync statistics
   */
  async getSyncStats(): Promise<{
    totalSales: number;
    syncedSales: number;
    pendingSales: number;
    failedSales: number;
    lastSyncTime: string | null;
  }> {
    try {
      const stats = await OfflineStore.getStats();
      const unsyncedSales = await OfflineStore.getUnsyncedSales();
      const failedSales = unsyncedSales.filter(sale => sale.syncAttempts > 0).length;

      return {
        totalSales: stats.totalSales,
        syncedSales: stats.totalSales - stats.unsyncedSales,
        pendingSales: stats.unsyncedSales - failedSales,
        failedSales,
        lastSyncTime: this.lastSyncTime
      };
    } catch (error) {
      console.error('Failed to get sync stats:', error);
      return {
        totalSales: 0,
        syncedSales: 0,
        pendingSales: 0,
        failedSales: 0,
        lastSyncTime: null
      };
    }
  }

  /**
   * Retry failed syncs
   */
  async retryFailedSyncs(): Promise<SyncResult> {
    try {
      const failedSales = await OfflineStore.getUnsyncedSales();
      const retriableSales = failedSales.filter(sale => 
        sale.syncAttempts > 0 && sale.syncAttempts < 5
      );

      // Reset sync attempts for retrial
      for (const sale of retriableSales) {
        await OfflineStore.incrementSyncAttempts(sale.id);
      }

      return await this.syncAll();
    } catch (error) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Failed to retry syncs']
      };
    }
  }

  /**
   * Clear all sync data (for testing/reset)
   */
  async clearSyncData(): Promise<void> {
    try {
      await OfflineStore.clearAllData();
      this.lastSyncTime = null;
      this.totalSynced = 0;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lastSyncTime');
      }
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to clear sync data:', error);
      throw error;
    }
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.syncAll);
      window.removeEventListener('offline', this.notifyListeners);
    }
    
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.syncAll);
    }
    
    this.listeners.clear();
  }
}

// Singleton instance
export const syncManager = SyncManager.getInstance();

// React hook for using sync manager in components
export function useSync() {
  const [status, setStatus] = useState(() => {
    // Only get initial status in browser
    if (typeof window !== 'undefined') {
      return syncManager.getStatus();
    }
    return {
      isOnline: false,
      isSyncing: false,
      lastSyncTime: null,
      pendingCount: 0,
      totalSynced: 0
    };
  });
  
  useEffect(() => {
    // Only set up listener in browser
    if (typeof window === 'undefined') return;
    
    const unsubscribe = syncManager.addListener(setStatus);
    return unsubscribe;
  }, []);

  return {
    isOnline: status.isOnline,
    isSyncing: status.isSyncing,
    lastSyncTime: status.lastSyncTime,
    pendingCount: status.pendingCount,
    forceSyncAll: () => syncManager.forceSyncAll(),
    refreshStatus: () => {
      if (typeof window !== 'undefined') {
        setStatus(syncManager.getStatus());
      }
    },
  };
}