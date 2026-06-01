'use client';

/**
 * Sync Manager Integration Example
 * 
 * This component demonstrates how to integrate the sync manager
 * with existing van stock management functionality.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSync } from './sync-provider';
import { createVanLoadOffline, getVanLoadsOffline } from '../lib/sync-utils';
import { SyncStatusIndicator } from './sync-status-indicator';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';

interface VanLoad {
  id?: string;
  localId?: string;
  userId: string;
  date: string;
  itemName: string;
  loaded: number;
  returned: number;
  syncStatus?: 'pending' | 'synced' | 'failed';
}

export function SyncExample() {
  const { queueStatus, isOnline, isSyncing, forceSyncAll } = useSync();
  const [vanLoads, setVanLoads] = useState<VanLoad[]>([]);
  const [newLoad, setNewLoad] = useState({
    itemName: '',
    loaded: 0,
    returned: 0
  });
  const [loading, setLoading] = useState(false);

  const loadVanLoads = useCallback(async () => {
    try {
      setLoading(true);
      const loads = await getVanLoadsOffline('user123'); // Example user ID
      setVanLoads(loads);
    } catch (error) {
      console.error('Failed to load van loads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load van loads on component mount
  useEffect(() => {
    loadVanLoads();
  }, [loadVanLoads]);

  const handleCreateVanLoad = async () => {
    if (!newLoad.itemName || newLoad.loaded <= 0) {
      alert('Please fill in all fields correctly');
      return;
    }

    try {
      setLoading(true);
      
      const vanLoadData = {
        userId: 'user123', // Example user ID
        date: new Date().toISOString().split('T')[0], // Today's date
        itemName: newLoad.itemName,
        loaded: newLoad.loaded,
        returned: newLoad.returned
      };

      // Create van load with offline support
      const result = await createVanLoadOffline(vanLoadData);
      
      if (result.success) {
        // Add to local state optimistically
        const optimisticLoad: VanLoad = {
          localId: result.localId,
          ...vanLoadData,
          syncStatus: 'pending'
        };
        setVanLoads(prev => [...prev, optimisticLoad]);
        
        // Reset form
        setNewLoad({ itemName: '', loaded: 0, returned: 0 });
        
        console.log('Van load created offline, will sync when online');
      } else {
        alert('Failed to create van load');
      }
    } catch (error) {
      console.error('Failed to create van load:', error);
      alert('Failed to create van load');
    } finally {
      setLoading(false);
    }
  };

  const handleForceSync = async () => {
    try {
      await forceSyncAll();
      await loadVanLoads(); // Reload data after sync
      alert('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          Sync Manager Example
        </h2>
        <SyncStatusIndicator showDetails compact />
      </div>

      {/* Sync Status Card */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Sync Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="font-medium text-gray-700">Connection</div>
            <div className={isOnline ? 'text-green-600' : 'text-red-600'}>
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-700">Pending</div>
            <div className="text-gray-900">{queueStatus.pendingOperations}</div>
          </div>
          <div>
            <div className="font-medium text-gray-700">Failed</div>
            <div className="text-gray-900">{queueStatus.failedOperations}</div>
          </div>
          <div>
            <div className="font-medium text-gray-700">Status</div>
            <div className={isSyncing ? 'text-blue-600' : 'text-gray-600'}>
              {isSyncing ? 'Syncing...' : 'Idle'}
            </div>
          </div>
        </div>
        
        {(queueStatus.pendingOperations > 0 || queueStatus.failedOperations > 0) && (
          <div className="mt-4">
            <Button 
              onClick={handleForceSync} 
              disabled={isSyncing || !isOnline}
              size="sm"
            >
              {isSyncing ? 'Syncing...' : 'Force Sync Now'}
            </Button>
          </div>
        )}
      </Card>

      {/* Create Van Load Form */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Create Van Load (Offline-First)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Name
            </label>
            <Input
              type="text"
              value={newLoad.itemName}
              onChange={(e) => setNewLoad(prev => ({ ...prev, itemName: e.target.value }))}
              placeholder="Enter item name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Loaded Quantity
            </label>
            <Input
              type="number"
              value={newLoad.loaded}
              onChange={(e) => setNewLoad(prev => ({ ...prev, loaded: parseInt(e.target.value) || 0 }))}
              placeholder="0"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Returned Quantity
            </label>
            <Input
              type="number"
              value={newLoad.returned}
              onChange={(e) => setNewLoad(prev => ({ ...prev, returned: parseInt(e.target.value) || 0 }))}
              placeholder="0"
              min="0"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button 
            onClick={handleCreateVanLoad} 
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Van Load'}
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            This will work offline and sync automatically when connection is restored.
          </p>
        </div>
      </Card>

      {/* Van Loads List */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Van Loads</h3>
          <Button 
            onClick={loadVanLoads} 
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
        
        {vanLoads.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No van loads found. Create one above to test offline functionality.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Item Name</th>
                  <th className="text-left py-2">Loaded</th>
                  <th className="text-left py-2">Returned</th>
                  <th className="text-left py-2">Expected Sales</th>
                  <th className="text-left py-2">Sync Status</th>
                </tr>
              </thead>
              <tbody>
                {vanLoads.map((load, index) => (
                  <tr key={load.id || load.localId || index} className="border-b">
                    <td className="py-2 font-medium">{load.itemName}</td>
                    <td className="py-2">{load.loaded}</td>
                    <td className="py-2">{load.returned}</td>
                    <td className="py-2">{load.loaded - load.returned}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        load.syncStatus === 'synced' ? 'bg-green-100 text-green-800' :
                        load.syncStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        load.syncStatus === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {load.syncStatus || 'unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Instructions */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold mb-2 text-blue-900">
          Testing Instructions
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>1. <strong>Online Mode:</strong> Create van loads normally - they sync immediately</p>
          <p>2. <strong>Offline Mode:</strong> Disconnect internet, create van loads - they&apos;re stored locally</p>
          <p>3. <strong>Reconnect:</strong> Go back online - pending operations sync automatically</p>
          <p>4. <strong>Manual Sync:</strong> Use &quot;Force Sync Now&quot; to manually trigger sync</p>
          <p>5. <strong>Status Monitoring:</strong> Watch the sync status indicator for real-time updates</p>
        </div>
      </Card>
    </div>
  );
}