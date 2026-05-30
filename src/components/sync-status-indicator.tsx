'use client';

/**
 * Sync Status Indicator Component
 * 
 * This component displays the current sync status, including online/offline state,
 * pending operations, and provides manual sync controls.
 */

import React, { useState } from 'react';
import { useSyncStatus, useSyncOperations, useSyncConflicts } from './sync-provider';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface SyncStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export function SyncStatusIndicator({ 
  className = '', 
  showDetails = false, 
  compact = false 
}: SyncStatusIndicatorProps) {
  const { queueStatus, isOnline, isSyncing } = useSyncStatus();
  const { forceSyncAll, retryFailedOperations } = useSyncOperations();
  const { pendingConflicts } = useSyncConflicts();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleForcSync = async () => {
    try {
      setSyncError(null);
      await forceSyncAll();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    }
  };

  const handleRetryFailed = async () => {
    try {
      setSyncError(null);
      await retryFailedOperations();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Retry failed');
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-500';
    if (isSyncing) return 'text-blue-500';
    if (queueStatus.failedOperations > 0) return 'text-orange-500';
    if (queueStatus.pendingOperations > 0) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (!isOnline) return '🔴';
    if (isSyncing) return '🔄';
    if (queueStatus.failedOperations > 0) return '⚠️';
    if (queueStatus.pendingOperations > 0) return '⏳';
    return '✅';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (queueStatus.failedOperations > 0) return `${queueStatus.failedOperations} failed`;
    if (queueStatus.pendingOperations > 0) return `${queueStatus.pendingOperations} pending`;
    return 'Synced';
  };

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className="text-sm">{getStatusIcon()}</span>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        {(queueStatus.pendingOperations > 0 || queueStatus.failedOperations > 0) && isOnline && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleForcSync}
            disabled={isSyncing}
            className="text-xs px-2 py-1"
          >
            {isSyncing ? 'Syncing...' : 'Sync'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-lg">{getStatusIcon()}</span>
          <div>
            <div className={`font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </div>
            {queueStatus.lastSyncTime && (
              <div className="text-sm text-gray-500">
                Last sync: {new Date(queueStatus.lastSyncTime).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {showDetails && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Hide' : 'Details'}
            </Button>
          )}
          
          {isOnline && (queueStatus.pendingOperations > 0 || queueStatus.failedOperations > 0) && (
            <Button
              size="sm"
              onClick={handleForcSync}
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          )}
        </div>
      </div>

      {syncError && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {syncError}
        </div>
      )}

      {isExpanded && showDetails && (
        <div className="mt-4 space-y-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-700">Connection Status</div>
              <div className={isOnline ? 'text-green-600' : 'text-red-600'}>
                {isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
            
            <div>
              <div className="font-medium text-gray-700">Sync Status</div>
              <div className={isSyncing ? 'text-blue-600' : 'text-gray-600'}>
                {isSyncing ? 'In Progress' : 'Idle'}
              </div>
            </div>
            
            <div>
              <div className="font-medium text-gray-700">Pending Operations</div>
              <div className="text-gray-900">{queueStatus.pendingOperations}</div>
            </div>
            
            <div>
              <div className="font-medium text-gray-700">Failed Operations</div>
              <div className="text-gray-900">{queueStatus.failedOperations}</div>
            </div>
          </div>

          {pendingConflicts.length > 0 && (
            <div className="p-2 bg-orange-50 border border-orange-200 rounded">
              <div className="font-medium text-orange-800">
                {pendingConflicts.length} Conflict{pendingConflicts.length > 1 ? 's' : ''} Need Resolution
              </div>
              <div className="text-sm text-orange-700 mt-1">
                Some data changes conflict with server data and require manual resolution.
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            {queueStatus.failedOperations > 0 && isOnline && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetryFailed}
                disabled={isSyncing}
              >
                Retry Failed
              </Button>
            )}
            
            {isOnline && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleForcSync}
                disabled={isSyncing}
              >
                Force Sync All
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// Simplified sync status badge for navigation bars
export function SyncStatusBadge({ className = '' }: { className?: string }) {
  const { queueStatus, isOnline, isSyncing } = useSyncStatus();
  
  const hasIssues = !isOnline || queueStatus.failedOperations > 0 || queueStatus.pendingOperations > 0;
  
  if (!hasIssues && !isSyncing) {
    return null; // Don't show badge when everything is synced
  }

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${className}`}>
      {!isOnline && (
        <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full">
          Offline
        </span>
      )}
      
      {isOnline && isSyncing && (
        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
          Syncing...
        </span>
      )}
      
      {isOnline && !isSyncing && queueStatus.failedOperations > 0 && (
        <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full">
          {queueStatus.failedOperations} Failed
        </span>
      )}
      
      {isOnline && !isSyncing && queueStatus.failedOperations === 0 && queueStatus.pendingOperations > 0 && (
        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
          {queueStatus.pendingOperations} Pending
        </span>
      )}
    </div>
  );
}

// Connection status indicator (simple online/offline)
export function ConnectionStatus({ className = '' }: { className?: string }) {
  const { isOnline } = useSyncStatus();
  
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm text-gray-600">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}