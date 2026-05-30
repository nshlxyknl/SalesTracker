/**
 * Sync Manager Test Page
 * 
 * This page provides a testing interface for the sync manager functionality.
 * It demonstrates offline-first operations and sync status monitoring.
 */

import { SyncExample } from '../../../components/sync-example';

export default function SyncTestPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <SyncExample />
      </div>
    </div>
  );
}