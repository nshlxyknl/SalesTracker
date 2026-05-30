'use client';

/**
 * Sync Provider Component
 * 
 * This component provides sync management context to the application,
 * including sync status, queue management, and conflict resolution.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { syncManager, queueSyncOperation, getSyncStatus, forceSyncNow } from '../lib/sync-manager';
import { SyncResult, QueueStatus, SyncOperation } from '../types/pwa';

interface SyncContextType {
  // Sync status
  queueStatus: QueueStatus;
  isOnline: boolean;
  isSyncing: boolean;
  
  // Sync operations
  queueOperation: (operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>) => Promise<void>;
  forceSyncAll: () => Promise<SyncResult[]>;
  retryFailedOperations: () => Promise<void>;
  
  // Sync status management
  refreshStatus: () => Promise<void>;
  
  // Conflict management
  pendingConflicts: any[];
  resolveConflict: (conflictId: string, resolution: any) => Promise<void>;
  
  // Event handlers
  onSyncComplete?: (results: SyncResult[]) => void;
  onSyncError?: (error: Error) => void;
  onConflictDetected?: (conflict: any) => void;
}

const SyncContext = createContext<SyncContextType | null>(null);

interface SyncProviderProps {
  children: ReactNode;
  onSyncComplete?: (results: SyncResult[]) => void;
  onSyncError?: (error: Error) => void;
  onConflictDetected?: (conflict: any) => void;
}

export function SyncProvider({ 
  children, 
  onSyncComplete, 
  onSyncError, 
  onConflictDetected 
}: SyncProviderProps) {
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    pendingOperations: 0,
    failedOperations: 0,
    lastSyncTime: null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true
  });
  
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<any[]>([]);

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshStatus();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      refreshStatus();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Refresh sync status
  const refreshStatus = useCallback(async () => {
    try {
      const status = await getSyncStatus();
      setQueueStatus(status);
      
      // Get pending conflicts
      const conflicts = await syncManager.getPendingConflicts();
      setPendingConflicts(conflicts);
    } catch (error) {
      console.error('[SyncProvider] Failed to refresh status:', error);
    }
  }, []);

  // Initialize and set up periodic status refresh
  useEffect(() => {
    refreshStatus();
    
    // Refresh status every 30 seconds
    const interval = setInterval(refreshStatus, 30000);
    
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // Queue a sync operation
  const queueOperation = useCallback(async (
    operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>
  ) => {
    try {
      await queueSyncOperation(operation);
      await refreshStatus();
    } catch (error) {
      console.error('[SyncProvider] Failed to queue operation:', error);
      if (onSyncError) {
        onSyncError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }, [onSyncError, refreshStatus]);

  // Force sync all operations
  const forceSyncAll = useCallback(async (): Promise<SyncResult[]> => {
    if (isSyncing) {
      throw new Error('Sync already in progress');
    }

    setIsSyncing(true);
    
    try {
      const results = await forceSyncNow();
      await refreshStatus();
      
      if (onSyncComplete) {
        onSyncComplete(results);
      }
      
      return results;
    } catch (error) {
      console.error('[SyncProvider] Force sync failed:', error);
      if (onSyncError) {
        onSyncError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, onSyncComplete, onSyncError, refreshStatus]);

  // Retry failed operations
  const retryFailedOperations = useCallback(async () => {
    if (isSyncing) {
      throw new Error('Sync already in progress');
    }

    setIsSyncing(true);
    
    try {
      await syncManager.retryFailedOperations();
      await refreshStatus();
    } catch (error) {
      console.error('[SyncProvider] Retry failed operations failed:', error);
      if (onSyncError) {
        onSyncError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, onSyncError, refreshStatus]);

  // Resolve a conflict
  const resolveConflict = useCallback(async (conflictId: string, resolution: any) => {
    try {
      await syncManager.resolveConflict(conflictId, resolution);
      await refreshStatus();
    } catch (error) {
      console.error('[SyncProvider] Failed to resolve conflict:', error);
      if (onSyncError) {
        onSyncError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }, [onSyncError, refreshStatus]);

  const contextValue: SyncContextType = {
    queueStatus,
    isOnline,
    isSyncing,
    queueOperation,
    forceSyncAll,
    retryFailedOperations,
    refreshStatus,
    pendingConflicts,
    resolveConflict,
    onSyncComplete,
    onSyncError,
    onConflictDetected
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
}

// Hook to use sync context
export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

// Hook for sync status only (lighter weight)
export function useSyncStatus() {
  const { queueStatus, isOnline, isSyncing } = useSync();
  return { queueStatus, isOnline, isSyncing };
}

// Hook for sync operations only
export function useSyncOperations() {
  const { 
    queueOperation, 
    forceSyncAll, 
    retryFailedOperations, 
    refreshStatus 
  } = useSync();
  
  return { 
    queueOperation, 
    forceSyncAll, 
    retryFailedOperations, 
    refreshStatus 
  };
}

// Hook for conflict management
export function useSyncConflicts() {
  const { 
    pendingConflicts, 
    resolveConflict, 
    onConflictDetected 
  } = useSync();
  
  return { 
    pendingConflicts, 
    resolveConflict, 
    onConflictDetected 
  };
}