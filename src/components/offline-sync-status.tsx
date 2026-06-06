"use client";

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useSync } from '@/components/sync-provider';
import { getPendingSales } from '@/lib/offline-sales';

interface SyncStatusData {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  totalSynced: number;
}

interface OfflineSyncStatusProps {
  compact?: boolean;
  className?: string;
}

export function OfflineSyncStatus({ compact = false, className = "" }: OfflineSyncStatusProps) {
  const { queueStatus, isOnline, isSyncing, forceSyncAll } = useSync();
  
  const [status, setStatus] = useState<SyncStatusData>({
    isOnline: typeof window !== 'undefined' ? navigator.onLine : false,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    totalSynced: 0
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    // Update status from sync provider
    const updateStatus = async () => {
      const pendingSales = await getPendingSales();
      setStatus({
        isOnline,
        isSyncing,
        pendingCount: queueStatus.pendingOperations || pendingSales.length,
        lastSyncTime: queueStatus.lastSyncTime?.toISOString() || null,
        totalSynced: 0 // This could be tracked if needed
      });
    };

    updateStatus();

    // Update pending count every 10 seconds
    const interval = setInterval(updateStatus, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [isOnline, isSyncing, queueStatus]);

  const handleForceSyncClick = async () => {
    if (isSyncing || !isOnline) return;
    
    try {
      await forceSyncAll();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  const getStatusIcon = () => {
    if (isSyncing) {
      return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
    }
    
    if (!isOnline) {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }
    
    if (status.pendingCount > 0) {
      return <Clock className="w-4 h-4 text-amber-500" />;
    }
    
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (isSyncing) {
      return "Syncing...";
    }
    
    if (!isOnline) {
      return "Offline";
    }
    
    if (status.pendingCount > 0) {
      return `${status.pendingCount} pending`;
    }
    
    return "Synced";
  };

  const getStatusColor = () => {
    if (isSyncing) return "text-blue-600";
    if (!isOnline) return "text-red-600";
    if (status.pendingCount > 0) return "text-amber-600";
    return "text-green-600";
  };

  const formatLastSyncTime = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {getStatusIcon()}
        <span className={`text-xs font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        {isOnline && status.pendingCount > 0 && (
          <button
            onClick={handleForceSyncClick}
            disabled={isSyncing}
            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 ml-1"
            title="Force sync now"
          >
            Sync Now
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      <div 
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <div>
            <div className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </div>
            <div className="text-xs text-gray-500">
              {isOnline ? 'Online' : 'Offline Mode'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isOnline && status.pendingCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleForceSyncClick();
              }}
              disabled={isSyncing}
              className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
          
          <div className="text-xs text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Network Status:</span>
                <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
                  {isOnline ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500">Pending Sales:</span>
                <span className={status.pendingCount > 0 ? 'text-amber-600' : 'text-green-600'}>
                  {status.pendingCount}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Synced:</span>
                <span className="text-green-600">{status.totalSynced}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500">Last Sync:</span>
                <span className="text-gray-600">
                  {formatLastSyncTime(status.lastSyncTime)}
                </span>
              </div>
            </div>
          </div>

          {status.pendingCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <div className="font-medium text-amber-800">
                    {status.pendingCount} sale{status.pendingCount !== 1 ? 's' : ''} pending sync
                  </div>
                  <div className="text-amber-600 mt-1">
                    {isOnline 
                      ? 'Sales will sync automatically or click "Sync Now"'
                      : 'Sales will sync when you come back online'
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isOnline && (
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <div className="flex items-start gap-2">
                <WifiOff className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <div className="font-medium text-blue-800">Working Offline</div>
                  <div className="text-blue-600 mt-1">
                    You can continue creating sales. They&apos;ll sync when you reconnect.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Legacy component for backward compatibility
export function SyncStatusIndicator({ compact, className }: OfflineSyncStatusProps) {
  return <OfflineSyncStatus compact={compact} className={className} />;
}