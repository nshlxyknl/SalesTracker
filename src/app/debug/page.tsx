"use client";

import { useOfflineAuth } from "@/components/offline-auth-provider";
import { useSync } from "@/lib/sync/sync-manager";
import { OfflineSyncStatus } from "@/components/offline-sync-status";
import { offlineSalesService } from "@/lib/offline-sales-service";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function DebugPage() {
  const { session, user, isLoading, isAuthenticated } = useOfflineAuth();
  const syncStatus = useSync();
  const [offlineStats, setOfflineStats] = useState<{
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: number;
    lastSyncTime: string | null;
  } | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await offlineSalesService.getSyncStatus();
        setOfflineStats(stats);
      } catch (error) {
        console.error('Failed to load offline stats:', error);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Offline System Debug</h1>
        
        {/* Authentication Status */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Authentication Status</h2>
          <div className="space-y-2 text-sm">
            <div><strong>Is Loading:</strong> {isLoading ? 'Yes' : 'No'}</div>
            <div><strong>Is Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</div>
            <div><strong>User:</strong> {user ? JSON.stringify(user, null, 2) : 'None'}</div>
            <div><strong>Session:</strong> {session ? JSON.stringify(session, null, 2) : 'None'}</div>
          </div>
        </div>

        {/* Network Status */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Network & Sync Status</h2>
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <div><strong>Online:</strong> {typeof window !== 'undefined' ? (navigator.onLine ? 'Yes' : 'No') : 'Server'}</div>
              <div><strong>Sync Manager Online:</strong> {syncStatus.isOnline ? 'Yes' : 'No'}</div>
              <div><strong>Is Syncing:</strong> {syncStatus.isSyncing ? 'Yes' : 'No'}</div>
              <div><strong>Pending Count:</strong> {syncStatus.pendingCount}</div>
              <div><strong>Last Sync:</strong> {syncStatus.lastSyncTime || 'Never'}</div>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Sync Component:</h3>
              <OfflineSyncStatus />
            </div>
          </div>
        </div>

        {/* Offline Stats */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Offline Service Stats</h2>
          <div className="text-sm">
            {offlineStats ? (
              <div className="space-y-2">
                <div><strong>Pending Sales:</strong> {offlineStats.pendingCount}</div>
                <div><strong>Last Sync Time:</strong> {offlineStats.lastSyncTime || 'Never'}</div>
                <div><strong>Is Online:</strong> {offlineStats.isOnline ? 'Yes' : 'No'}</div>
                <div><strong>Is Syncing:</strong> {offlineStats.isSyncing ? 'Yes' : 'No'}</div>
              </div>
            ) : (
              <div>Loading offline stats...</div>
            )}
          </div>
        </div>

        {/* Test Actions */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Test Actions</h2>
          <div className="space-y-3">
            <button
              onClick={async () => {
                try {
                  await offlineSalesService.forceSyncAll();
                  alert('Sync triggered!');
                } catch (error) {
                  alert('Sync failed: ' + error);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Force Sync All
            </button>
            
            <button
              onClick={async () => {
                if (user) {
                  try {
                    const result = await offlineSalesService.submitSale({
                      userId: user.id,
                      billTitle: 'Test Sale',
                      items: [{
                        itemName: 'Test Item',
                        quantity: 1,
                        unitPrice: 100
                      }],
                      paymentMethod: 'cash'
                    });
                    alert('Test sale created: ' + JSON.stringify(result));
                  } catch (error) {
                    alert('Failed to create test sale: ' + error);
                  }
                } else {
                  alert('No user logged in');
                }
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Create Test Sale
            </button>

            <button
              onClick={async () => {
                try {
                  const pending = await offlineSalesService.getPendingSales();
                  alert('Pending sales: ' + JSON.stringify(pending, null, 2));
                } catch (error) {
                  alert('Failed to get pending sales: ' + error);
                }
              }}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Show Pending Sales
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Navigation</h2>
          <div className="space-y-2">
            <Link href="/" className="block text-blue-600 hover:underline">← Back to Home</Link>
            <Link href="/login" className="block text-blue-600 hover:underline">Login Page</Link>
            <Link href="/dashboard" className="block text-blue-600 hover:underline">Dashboard</Link>
            <Link href="/admin" className="block text-blue-600 hover:underline">Admin</Link>
          </div>
        </div>
      </div>
    </div>
  );
}