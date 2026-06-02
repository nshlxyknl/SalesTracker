/**
 * PWA Core Type Definitions
 * 
 * This file contains TypeScript interfaces for Progressive Web App functionality
 * including manifest, service worker, and offline storage types.
 */

// Web App Manifest Types
export interface WebAppManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
  categories: string[];
  orientation: 'portrait' | 'landscape' | 'any';
}

export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: 'any' | 'maskable' | 'monochrome';
}

// Service Worker Configuration Types
export interface ServiceWorkerConfig {
  cacheStrategy: 'CacheFirst' | 'NetworkFirst' | 'StaleWhileRevalidate';
  cacheName: string;
  urlPatterns: RegExp[];
  maxEntries?: number;
  maxAgeSeconds?: number;
}

export interface PWASyncEvent {
  tag: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

// Offline Storage Types
export interface OfflineStorageManager {
  store<T>(key: string, data: T): Promise<void>;
  retrieve<T>(key: string): Promise<T | null>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

export interface SyncQueue {
  enqueue(operation: SyncOperation): Promise<void>;
  dequeue(): Promise<SyncOperation | null>;
  peek(): Promise<SyncOperation | null>;
  size(): Promise<number>;
  clear(): Promise<void>;
}

export interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

// Sync Management Types
export interface SyncManager {
  queueOperation(operation: SyncOperation): Promise<void>;
  processQueue(): Promise<SyncResult[]>;
  handleConnectivityChange(online: boolean): Promise<void>;
  getQueueStatus(): Promise<QueueStatus>;
  retryFailedOperations(): Promise<void>;
}

export interface SyncResult {
  operationId: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface QueueStatus {
  pendingOperations: number;
  failedOperations: number;
  lastSyncTime: Date | null;
  isOnline: boolean;
}

// IndexedDB Schema Types
export interface OfflineDatabase {
  stores: {
    vanLoads: VanLoadOffline[];
    sales: SaleOffline[];
    billSubmissions: BillSubmissionOffline[];
    syncQueue: SyncOperation[];
    userPreferences: UserPreference[];
    cacheMetadata: CacheMetadata[];
  };
}

export interface VanLoadOffline {
  localId: string;
  id?: string;
  date: Date;
  itemName: string;
  loaded: number;
  returned: number;
  userId: string;
  createdAt: Date;
  lastModified: Date;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface SaleOffline {
  localId: string;
  id?: string;
  billNumber: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  billImageBase64?: string;
  billImageName?: string;
  createdAt: Date;
  userId: string;
  lastModified: Date;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface BillSubmissionOffline {
  localId: string;
  id?: string;
  billNumber: string;
  imageData: string;
  imageName: string;
  selectedItems: Record<string, unknown>[]; // JSON data
  userId: string;
  processed: boolean;
  createdAt: Date;
  lastModified: Date;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface UserPreference {
  key: string;
  value: unknown;
  lastModified: Date;
}

export interface CacheMetadata {
  url: string;
  timestamp: Date;
  expiry: Date;
  etag?: string;
}