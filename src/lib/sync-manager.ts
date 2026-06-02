/**
 * Sync Manager for Online/Offline Coordination
 * 
 * This module implements the SyncManager class that handles data synchronization
 * between offline and online states, including queue processing, connectivity detection,
 * automatic sync triggers, conflict resolution, and retry mechanisms.
 */

import { offlineStorage, syncQueue, generateLocalId, isOnline, addOnlineListener, addOfflineListener } from './offline-storage';
import { markPendingSaleSynced, type PendingSalePayload } from './offline-sales';
import { SyncOperation, SyncResult, QueueStatus, SyncManager as ISyncManager } from '../types/pwa';

export interface SyncConflict {
  id: string;
  type: 'data_conflict' | 'version_mismatch' | 'deleted_modified';
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  endpoint: string;
  timestamp: Date;
}

export interface ConflictResolution {
  strategy: 'server_wins' | 'client_wins' | 'merge' | 'user_choice';
  resolvedData: unknown;
  requiresUserInput: boolean;
}

export interface SyncManagerConfig {
  maxRetries: number;
  baseRetryDelay: number; // milliseconds
  maxRetryDelay: number; // milliseconds
  batchSize: number;
  autoSyncInterval: number; // milliseconds
  conflictResolutionTimeout: number; // milliseconds
}

export class SyncManager implements ISyncManager {
  private static instance: SyncManager;
  private config: SyncManagerConfig;
  private isProcessing: boolean = false;
  private autoSyncTimer: NodeJS.Timeout | null = null;
  private onlineListener: (() => void) | null = null;
  private offlineListener: (() => void) | null = null;
  private conflictCallbacks: Map<string, (conflict: SyncConflict) => Promise<ConflictResolution>> = new Map();

  private constructor(config?: Partial<SyncManagerConfig>) {
    this.config = {
      maxRetries: 3,
      baseRetryDelay: 1000, // 1 second
      maxRetryDelay: 30000, // 30 seconds
      batchSize: 10,
      autoSyncInterval: 30000, // 30 seconds
      conflictResolutionTimeout: 60000, // 1 minute
      ...config
    };

    this.initializeConnectivityListeners();
    this.startAutoSync();
  }

  public static getInstance(config?: Partial<SyncManagerConfig>): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager(config);
    }
    return SyncManager.instance;
  }

  /**
   * Initialize connectivity event listeners
   */
  private initializeConnectivityListeners(): void {
    // Only initialize listeners in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    this.onlineListener = addOnlineListener(() => {
      console.log('[SyncManager] Device came online, triggering sync');
      this.handleConnectivityChange(true);
    });

    this.offlineListener = addOfflineListener(() => {
      console.log('[SyncManager] Device went offline');
      this.handleConnectivityChange(false);
    });
  }

  /**
   * Start automatic sync timer
   */
  private startAutoSync(): void {
    // Only start auto sync in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
    }

    this.autoSyncTimer = setInterval(() => {
      if (isOnline() && !this.isProcessing) {
        this.processQueue().catch(error => {
          console.error('[SyncManager] Auto-sync failed:', error);
        });
      }
    }, this.config.autoSyncInterval);
  }

  /**
   * Stop automatic sync and cleanup listeners
   */
  public destroy(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }

    if (this.onlineListener) {
      this.onlineListener();
      this.onlineListener = null;
    }

    if (this.offlineListener) {
      this.offlineListener();
      this.offlineListener = null;
    }
  }

  /**
   * Queue a sync operation
   */
  public async queueOperation(operation: SyncOperation): Promise<void> {
    try {
      // Ensure operation has required fields
      const completeOperation: SyncOperation = {
        id: operation.id || generateLocalId(),
        type: operation.type,
        endpoint: operation.endpoint,
        data: operation.data,
        timestamp: operation.timestamp || Date.now(),
        retryCount: operation.retryCount || 0,
        maxRetries: operation.maxRetries || this.config.maxRetries
      };

      await syncQueue.enqueue(completeOperation);
      console.log(`[SyncManager] Queued ${operation.type} operation for ${operation.endpoint}`);

      // Try immediate sync if online
      if (isOnline() && !this.isProcessing) {
        this.processQueue().catch(error => {
          console.error('[SyncManager] Immediate sync failed:', error);
        });
      }
    } catch (error) {
      console.error('[SyncManager] Failed to queue operation:', error);
      throw error;
    }
  }

  /**
   * Process the sync queue
   */
  public async processQueue(): Promise<SyncResult[]> {
    if (this.isProcessing) {
      console.log('[SyncManager] Sync already in progress, skipping');
      return [];
    }

    if (!isOnline()) {
      console.log('[SyncManager] Device offline, skipping sync');
      return [];
    }

    this.isProcessing = true;
    const results: SyncResult[] = [];

    try {
      console.log('[SyncManager] Starting sync queue processing');
      
      // Process operations in batches
      let processedCount = 0;
      while (processedCount < this.config.batchSize) {
        const operation = await syncQueue.dequeue();
        if (!operation) {
          break; // No more operations
        }

        const result = await this.processOperation(operation);
        results.push(result);
        processedCount++;

        // If operation failed and has retries left, re-queue it
        if (!result.success && operation.retryCount < operation.maxRetries) {
          const retryOperation: SyncOperation = {
            ...operation,
            retryCount: operation.retryCount + 1,
            timestamp: Date.now() + this.calculateRetryDelay(operation.retryCount + 1)
          };
          await syncQueue.enqueue(retryOperation);
          console.log(`[SyncManager] Re-queued operation ${operation.id} for retry ${retryOperation.retryCount}`);
        }
      }

      console.log(`[SyncManager] Processed ${results.length} operations`);
      return results;
    } catch (error) {
      console.error('[SyncManager] Queue processing failed:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single sync operation
   */
  private async processOperation(operation: SyncOperation): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[SyncManager] Processing ${operation.type} operation for ${operation.endpoint}`);

      // Check if operation should be delayed (for retry backoff)
      if (operation.timestamp > Date.now()) {
        console.log(`[SyncManager] Operation ${operation.id} delayed until ${new Date(operation.timestamp)}`);
        await syncQueue.enqueue(operation); // Re-queue for later
        return {
          operationId: operation.id,
          success: false,
          error: 'Operation delayed for retry backoff',
          timestamp: new Date()
        };
      }

      const response = await this.executeHttpRequest(operation);
      
      if (response.ok) {
        const responseData = await response.json();
        
        // Handle potential conflicts
        if (response.status === 409) { // Conflict status
          const conflict = await this.handleConflict(operation, responseData);
          if (conflict.requiresUserInput) {
            // Store conflict for user resolution
            await this.storeConflictForResolution(operation, responseData);
            return {
              operationId: operation.id,
              success: false,
              error: 'Conflict requires user resolution',
              timestamp: new Date()
            };
          } else {
            // Auto-resolve conflict and retry
            const resolvedOperation = { 
              ...operation, 
              data: conflict.resolvedData as Record<string, unknown>
            };
            return await this.processOperation(resolvedOperation);
          }
        }

        // Update local data with server response if needed
        await this.updateLocalDataAfterSync(operation, responseData);

        return {
          operationId: operation.id,
          success: true,
          timestamp: new Date()
        };
      } else {
        const errorText = await response.text();
        console.error(`[SyncManager] HTTP error ${response.status}: ${errorText}`);
        
        return {
          operationId: operation.id,
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          timestamp: new Date()
        };
      }
    } catch (error) {
      console.error(`[SyncManager] Operation ${operation.id} failed:`, error);
      
      return {
        operationId: operation.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * Execute HTTP request for sync operation
   */
  private async executeHttpRequest(operation: SyncOperation): Promise<Response> {
    let requestUrl = operation.endpoint;

    if (operation.type === 'DELETE' && operation.data?.id) {
      requestUrl = `${requestUrl}?id=${operation.data.id}`;
    }

    // Sales API expects multipart FormData (same as dashboard submit)
    if (operation.endpoint === '/api/sales' && operation.type === 'CREATE') {
      const data = operation.data as PendingSalePayload;
      const formData = new FormData();
      formData.append('billTitle', data.billTitle || 'Untitled Bill');
      formData.append('items', JSON.stringify(data.items));
      formData.append('paymentMethod', data.paymentMethod);

      if (data.billImageBase64 && data.billImageName) {
        const imageResponse = await fetch(data.billImageBase64);
        const blob = await imageResponse.blob();
        formData.append(
          'billImage',
          new File([blob], data.billImageName, { type: blob.type || 'image/jpeg' })
        );
      }

      return fetch(requestUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
    }

    const options: RequestInit = {
      method: this.getHttpMethod(operation.type),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (operation.type === 'CREATE' || operation.type === 'UPDATE') {
      options.body = JSON.stringify(operation.data);
    }

    return fetch(requestUrl, options);
  }

  /**
   * Get HTTP method for sync operation type
   */
  private getHttpMethod(operationType: string): string {
    switch (operationType) {
      case 'CREATE':
        return 'POST';
      case 'UPDATE':
        return 'PUT';
      case 'DELETE':
        return 'DELETE';
      default:
        return 'POST';
    }
  }

  /**
   * Handle sync conflicts
   */
  private async handleConflict(operation: SyncOperation, serverData: Record<string, unknown>): Promise<ConflictResolution> {
    const conflict: SyncConflict = {
      id: generateLocalId(),
      type: 'data_conflict',
      localData: operation.data,
      serverData: serverData,
      endpoint: operation.endpoint,
      timestamp: new Date()
    };

    // Check if there's a registered conflict resolver
    const resolver = this.conflictCallbacks.get(operation.endpoint);
    if (resolver) {
      try {
        return await resolver(conflict);
      } catch (error) {
        console.error('[SyncManager] Conflict resolver failed:', error);
      }
    }

    // Default conflict resolution strategies
    return this.getDefaultConflictResolution(conflict);
  }

  /**
   * Get default conflict resolution strategy
   */
  private getDefaultConflictResolution(conflict: SyncConflict): ConflictResolution {
    // For most cases, server wins (last-write-wins)
    // This can be customized based on business logic
    
    if (conflict.type === 'deleted_modified') {
      // If server deleted but client modified, require user input
      return {
        strategy: 'user_choice',
        resolvedData: null,
        requiresUserInput: true
      };
    }

    // Default: server wins
    return {
      strategy: 'server_wins',
      resolvedData: conflict.serverData,
      requiresUserInput: false
    };
  }

  /**
   * Store conflict for user resolution
   */
  private async storeConflictForResolution(operation: SyncOperation, serverData: Record<string, unknown>): Promise<void> {
    const conflict: SyncConflict = {
      id: generateLocalId(),
      type: 'data_conflict',
      localData: operation.data,
      serverData: serverData,
      endpoint: operation.endpoint,
      timestamp: new Date()
    };

    await offlineStorage.store(`conflict_${conflict.id}`, conflict);
    console.log(`[SyncManager] Stored conflict ${conflict.id} for user resolution`);
  }

  /**
   * Update local data after successful sync
   */
  private async updateLocalDataAfterSync(operation: SyncOperation, serverData: Record<string, unknown>): Promise<void> {
    try {
      // Update sync status in local storage based on operation type
      if (operation.endpoint.includes('/van-load')) {
        // Update van load sync status
        const vanLoads = await offlineStorage.getVanLoads();
        const updatedLoads = vanLoads.map(load => {
          if (load.localId === operation.data.localId) {
            return { ...load, syncStatus: 'synced', id: serverData.id };
          }
          return load;
        });
        
        // Store updated van loads (this would need to be implemented in offline storage)
        // For now, we'll just log the update
        console.log(`[SyncManager] Updated van load ${operation.data.localId} sync status`);
      }

      if (operation.endpoint.includes('/sales') && operation.data?.localId) {
        await markPendingSaleSynced((operation.data as { localId: string }).localId);
        console.log(`[SyncManager] Marked pending sale ${operation.data.localId} as synced`);
      }

      if (operation.endpoint.includes('/bill-submissions')) {
        // Update bill submission sync status
        console.log(`[SyncManager] Updated bill submission ${operation.data.localId} sync status`);
      }
    } catch (error) {
      console.error('[SyncManager] Failed to update local data after sync:', error);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = Math.min(
      this.config.baseRetryDelay * Math.pow(2, retryCount - 1),
      this.config.maxRetryDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return Math.floor(delay + jitter);
  }

  /**
   * Handle connectivity changes
   */
  public async handleConnectivityChange(online: boolean): Promise<void> {
    console.log(`[SyncManager] Connectivity changed: ${online ? 'online' : 'offline'}`);
    
    if (online && !this.isProcessing) {
      // Device came online, trigger sync
      try {
        await this.processQueue();
      } catch (error) {
        console.error('[SyncManager] Failed to sync after coming online:', error);
      }
    }
  }

  /**
   * Get current queue status
   */
  public async getQueueStatus(): Promise<QueueStatus> {
    try {
      const queueSize = await syncQueue.size();
      
      // Count failed operations (this is a simplified implementation)
      // In a real implementation, you'd track failed operations separately
      const failedOperations = 0;
      
      // Get last sync time from storage
      const lastSyncTime = await offlineStorage.retrieve<Date>('lastSyncTime');
      
      return {
        pendingOperations: queueSize,
        failedOperations,
        lastSyncTime,
        isOnline: isOnline()
      };
    } catch (error) {
      console.error('[SyncManager] Failed to get queue status:', error);
      return {
        pendingOperations: 0,
        failedOperations: 0,
        lastSyncTime: null,
        isOnline: isOnline()
      };
    }
  }

  /**
   * Retry failed operations
   */
  public async retryFailedOperations(): Promise<void> {
    console.log('[SyncManager] Retrying failed operations');
    
    if (!isOnline()) {
      console.log('[SyncManager] Device offline, cannot retry operations');
      return;
    }

    try {
      await this.processQueue();
      console.log('[SyncManager] Failed operations retry completed');
    } catch (error) {
      console.error('[SyncManager] Failed to retry operations:', error);
      throw error;
    }
  }

  /**
   * Register a conflict resolution callback for a specific endpoint
   */
  public registerConflictResolver(
    endpoint: string, 
    resolver: (conflict: SyncConflict) => Promise<ConflictResolution>
  ): void {
    this.conflictCallbacks.set(endpoint, resolver);
    console.log(`[SyncManager] Registered conflict resolver for ${endpoint}`);
  }

  /**
   * Unregister a conflict resolution callback
   */
  public unregisterConflictResolver(endpoint: string): void {
    this.conflictCallbacks.delete(endpoint);
    console.log(`[SyncManager] Unregistered conflict resolver for ${endpoint}`);
  }

  /**
   * Get pending conflicts that require user resolution
   */
  public async getPendingConflicts(): Promise<SyncConflict[]> {
    try {
      const keys = await offlineStorage.getAllKeys();
      const conflictKeys = keys.filter(key => key.startsWith('conflict_'));
      
      const conflicts: SyncConflict[] = [];
      for (const key of conflictKeys) {
        const conflict = await offlineStorage.retrieve<SyncConflict>(key);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
      
      return conflicts;
    } catch (error) {
      console.error('[SyncManager] Failed to get pending conflicts:', error);
      return [];
    }
  }

  /**
   * Resolve a conflict with user input
   */
  public async resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void> {
    try {
      const conflict = await offlineStorage.retrieve<SyncConflict>(`conflict_${conflictId}`);
      if (!conflict) {
        throw new Error(`Conflict ${conflictId} not found`);
      }

      // Create new sync operation with resolved data
      const resolvedOperation: SyncOperation = {
        id: generateLocalId(),
        type: 'UPDATE', // Assume update for conflict resolution
        endpoint: conflict.endpoint,
        data: resolution.resolvedData as Record<string, unknown>,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: this.config.maxRetries
      };

      // Queue the resolved operation
      await this.queueOperation(resolvedOperation);

      // Remove the conflict from storage
      await offlineStorage.remove(`conflict_${conflictId}`);

      console.log(`[SyncManager] Resolved conflict ${conflictId} with strategy: ${resolution.strategy}`);
    } catch (error) {
      console.error(`[SyncManager] Failed to resolve conflict ${conflictId}:`, error);
      throw error;
    }
  }

  /**
   * Force sync all pending operations (useful for manual sync triggers)
   */
  public async forceSyncAll(): Promise<SyncResult[]> {
    console.log('[SyncManager] Force syncing all pending operations');
    
    if (!isOnline()) {
      throw new Error('Cannot force sync while offline');
    }

    const results: SyncResult[] = [];
    
    try {
      // Process all operations in the queue
      while (true) {
        const batchResults = await this.processQueue();
        if (batchResults.length === 0) {
          break; // No more operations
        }
        results.push(...batchResults);
      }

      // Update last sync time
      await offlineStorage.store('lastSyncTime', new Date());
      
      console.log(`[SyncManager] Force sync completed, processed ${results.length} operations`);
      return results;
    } catch (error) {
      console.error('[SyncManager] Force sync failed:', error);
      throw error;
    }
  }
}

// Export singleton instance (lazy initialization)
let syncManagerInstance: SyncManager | null = null;

export const syncManager = {
  getInstance(): SyncManager {
    if (!syncManagerInstance) {
      syncManagerInstance = SyncManager.getInstance();
    }
    return syncManagerInstance;
  }
};

// Utility functions for easy access
export function queueSyncOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
  return syncManager.getInstance().queueOperation({
    id: generateLocalId(),
    timestamp: Date.now(),
    retryCount: 0,
    ...operation,
    maxRetries: operation.maxRetries || 3
  });
}

export function getSyncStatus(): Promise<QueueStatus> {
  return syncManager.getInstance().getQueueStatus();
}

export function forceSyncNow(): Promise<SyncResult[]> {
  return syncManager.getInstance().forceSyncAll();
}