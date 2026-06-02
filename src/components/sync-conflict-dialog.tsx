'use client';

/**
 * Sync Conflict Resolution Dialog
 * 
 * This component provides a user interface for resolving sync conflicts
 * when local and server data differ.
 */

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface SyncConflict {
  id: string;
  type: 'data_conflict' | 'version_mismatch' | 'deleted_modified';
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  endpoint: string;
  timestamp: Date;
}

interface ConflictResolution {
  strategy: 'server_wins' | 'client_wins' | 'merge' | 'user_choice';
  resolvedData: Record<string, unknown>;
  requiresUserInput: boolean;
}

interface SyncConflictDialogProps {
  conflict: SyncConflict;
  onResolve: (resolution: ConflictResolution) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function SyncConflictDialog({ 
  conflict, 
  onResolve, 
  onCancel, 
  isOpen 
}: SyncConflictDialogProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<'server_wins' | 'client_wins' | 'merge'>('server_wins');
  const [mergedData, setMergedData] = useState<Record<string, unknown> | null>(null);

  if (!isOpen) return null;

  const handleResolve = () => {
    let resolvedData;
    
    switch (selectedStrategy) {
      case 'server_wins':
        resolvedData = conflict.serverData;
        break;
      case 'client_wins':
        resolvedData = conflict.localData;
        break;
      case 'merge':
        resolvedData = mergedData || { ...conflict.localData, ...conflict.serverData };
        break;
      default:
        resolvedData = conflict.serverData;
    }

    onResolve({
      strategy: selectedStrategy,
      resolvedData,
      requiresUserInput: false
    });
  };

  const getConflictDescription = () => {
    switch (conflict.type) {
      case 'data_conflict':
        return 'The data has been modified both locally and on the server. Please choose which version to keep.';
      case 'version_mismatch':
        return 'The data version on the server is different from your local version.';
      case 'deleted_modified':
        return 'This item was deleted on the server but modified locally.';
      default:
        return 'A sync conflict has occurred.';
    }
  };

  const renderDataComparison = () => {
    const localKeys = Object.keys(conflict.localData || {});
    const serverKeys = Object.keys(conflict.serverData || {});
    const allKeys = [...new Set([...localKeys, ...serverKeys])];

    return (
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Data Comparison</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2">Your Local Changes</h5>
            <Card className="p-3 bg-blue-50 border-blue-200">
              {allKeys.map(key => (
                <div key={key} className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{key}:</span>
                  <span className={
                    conflict.localData?.[key] !== conflict.serverData?.[key] 
                      ? 'text-blue-700 font-medium' 
                      : 'text-gray-600'
                  }>
                    {JSON.stringify(conflict.localData?.[key] || 'N/A')}
                  </span>
                </div>
              ))}
            </Card>
          </div>
          
          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2">Server Version</h5>
            <Card className="p-3 bg-green-50 border-green-200">
              {allKeys.map(key => (
                <div key={key} className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{key}:</span>
                  <span className={
                    conflict.localData?.[key] !== conflict.serverData?.[key] 
                      ? 'text-green-700 font-medium' 
                      : 'text-gray-600'
                  }>
                    {JSON.stringify(conflict.serverData?.[key] || 'N/A')}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Sync Conflict Resolution
            </h3>
            <Button variant="ghost" onClick={onCancel}>
              ✕
            </Button>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-orange-600">⚠️</span>
                <span className="font-medium text-orange-800">Conflict Detected</span>
              </div>
              <p className="text-orange-700 text-sm">
                {getConflictDescription()}
              </p>
            </div>

            {renderDataComparison()}

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Resolution Strategy</h4>
              
              <div className="space-y-3">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="strategy"
                    value="server_wins"
                    checked={selectedStrategy === 'server_wins'}
                    onChange={(e) => setSelectedStrategy(e.target.value as 'server_wins' | 'client_wins' | 'merge')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Use Server Version</div>
                    <div className="text-sm text-gray-600">
                      Discard your local changes and use the server version. This is the safest option.
                    </div>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="strategy"
                    value="client_wins"
                    checked={selectedStrategy === 'client_wins'}
                    onChange={(e) => setSelectedStrategy(e.target.value as 'server_wins' | 'client_wins' | 'merge')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Use Your Local Changes</div>
                    <div className="text-sm text-gray-600">
                      Keep your local changes and overwrite the server version.
                    </div>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="strategy"
                    value="merge"
                    checked={selectedStrategy === 'merge'}
                    onChange={(e) => setSelectedStrategy(e.target.value as 'server_wins' | 'client_wins' | 'merge')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Merge Changes</div>
                    <div className="text-sm text-gray-600">
                      Combine both versions. Local changes take priority for conflicting fields.
                    </div>
                  </div>
                </label>
              </div>

              {selectedStrategy === 'merge' && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">Merged Result Preview</h5>
                  <Card className="p-3 bg-white">
                    {Object.entries({ ...conflict.serverData, ...conflict.localData }).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{key}:</span>
                        <span className="text-gray-900">
                          {JSON.stringify(value)}
                        </span>
                      </div>
                    ))}
                  </Card>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleResolve}>
                Resolve Conflict
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Simplified conflict notification for when user doesn't want full dialog
export function SyncConflictNotification({ 
  conflictCount, 
  onShowDetails, 
  onDismiss 
}: { 
  conflictCount: number; 
  onShowDetails: () => void; 
  onDismiss: () => void; 
}) {
  return (
    <div className="fixed bottom-4 right-4 bg-orange-100 border border-orange-300 rounded-lg p-4 shadow-lg z-40 max-w-sm">
      <div className="flex items-start space-x-3">
        <span className="text-orange-600 text-lg">⚠️</span>
        <div className="flex-1">
          <div className="font-medium text-orange-800">
            Sync Conflicts Detected
          </div>
          <div className="text-sm text-orange-700 mt-1">
            {conflictCount} item{conflictCount > 1 ? 's' : ''} need{conflictCount === 1 ? 's' : ''} your attention to resolve conflicts.
          </div>
          <div className="flex space-x-2 mt-3">
            <Button size="sm" onClick={onShowDetails}>
              Resolve
            </Button>
            <Button size="sm" variant="outline" onClick={onDismiss}>
              Later
            </Button>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          ✕
        </Button>
      </div>
    </div>
  );
}