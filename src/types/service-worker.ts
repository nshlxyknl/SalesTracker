/**
 * Service Worker Type Definitions
 * 
 * This file contains TypeScript interfaces specific to service worker
 * functionality, caching strategies, and background sync operations.
 */

// Service Worker Global Types
export interface ServiceWorkerGlobalScope extends EventTarget {
  registration: ServiceWorkerRegistration;
  skipWaiting(): Promise<void>;
  clients: ServiceWorkerClients;
  caches: CacheStorage;
}

export interface ServiceWorkerClients {
  claim(): Promise<void>;
  get(id: string): Promise<ServiceWorkerClient | null>;
  matchAll(options?: ClientQueryOptions): Promise<ServiceWorkerClient[]>;
  openWindow(url: string): Promise<ServiceWorkerClient | null>;
}

export interface ServiceWorkerClient {
  id: string;
  type: 'window' | 'worker' | 'sharedworker';
  url: string;
  postMessage(message: any): void;
}

export interface ClientQueryOptions {
  includeUncontrolled?: boolean;
  type?: 'window' | 'worker' | 'sharedworker' | 'all';
}

// Cache Strategy Types
export interface CacheStrategy {
  name: string;
  handler: (request: Request) => Promise<Response>;
  options?: CacheStrategyOptions;
}

export interface CacheStrategyOptions {
  cacheName?: string;
  networkTimeoutSeconds?: number;
  cacheableResponse?: {
    statuses?: number[];
    headers?: Record<string, string>;
  };
  broadcastUpdate?: {
    channelName?: string;
    options?: Record<string, any>;
  };
}

// Background Sync Types
export interface BackgroundSyncOptions {
  tag: string;
  options?: {
    minDelay?: number;
    maxDelay?: number;
  };
}

export interface ServiceWorkerSyncEventData {
  type: 'van-load' | 'sale' | 'bill-submission' | 'reconciliation';
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  userId: string;
}

// Push Notification Types
export interface PushEventData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: PushNotificationAction[];
}

export interface PushNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

// Cache Management Types
export interface CacheEntry {
  url: string;
  response: Response;
  timestamp: number;
  expiry?: number;
}

export interface CacheManifest {
  version: string;
  assets: CacheAsset[];
  routes: CacheRoute[];
}

export interface CacheAsset {
  url: string;
  revision: string;
  size?: number;
}

export interface CacheRoute {
  pattern: string | RegExp;
  strategy: 'CacheFirst' | 'NetworkFirst' | 'StaleWhileRevalidate' | 'NetworkOnly' | 'CacheOnly';
  options?: CacheStrategyOptions;
}

// Service Worker Events
export interface ServiceWorkerInstallEvent extends Event {
  type: 'install';
  waitUntil(promise: Promise<any>): void;
}

export interface ServiceWorkerActivateEvent extends Event {
  type: 'activate';
  waitUntil(promise: Promise<any>): void;
}

export interface ServiceWorkerFetchEvent extends Event {
  type: 'fetch';
  request: Request;
  clientId: string;
  respondWith(response: Promise<Response> | Response): void;
  waitUntil(promise: Promise<any>): void;
}

export interface ServiceWorkerSyncEvent extends Event {
  type: 'sync';
  tag: string;
  lastChance: boolean;
  waitUntil(promise: Promise<any>): void;
}

export interface ServiceWorkerPushEvent extends Event {
  type: 'push';
  data: ServiceWorkerPushMessageData | null;
  waitUntil(promise: Promise<any>): void;
}

export interface ServiceWorkerPushMessageData {
  arrayBuffer(): ArrayBuffer;
  blob(): Blob;
  json(): any;
  text(): string;
}

export interface ServiceWorkerNotificationEvent extends Event {
  type: 'notificationclick' | 'notificationclose';
  notification: Notification;
  action?: string;
  waitUntil(promise: Promise<any>): void;
}

// Message Types for SW Communication
export interface ServiceWorkerMessage {
  type: 'SKIP_WAITING' | 'CLAIM_CLIENTS' | 'CACHE_UPDATE' | 'SYNC_STATUS' | 'OFFLINE_STATUS';
  payload?: any;
}

export interface ClientMessage {
  type: 'SW_UPDATE_AVAILABLE' | 'SW_UPDATED' | 'CACHE_UPDATED' | 'SYNC_COMPLETE' | 'OFFLINE_READY';
  payload?: any;
}

// Workbox-style Types (if using Workbox)
export interface WorkboxConfig {
  globDirectory: string;
  globPatterns: string[];
  swDest: string;
  clientsClaim?: boolean;
  skipWaiting?: boolean;
  runtimeCaching?: RuntimeCachingEntry[];
  navigationPreload?: boolean;
  offlineGoogleAnalytics?: boolean;
}

export interface RuntimeCachingEntry {
  urlPattern: string | RegExp;
  handler: 'CacheFirst' | 'NetworkFirst' | 'StaleWhileRevalidate' | 'NetworkOnly' | 'CacheOnly';
  options?: {
    cacheName?: string;
    expiration?: {
      maxEntries?: number;
      maxAgeSeconds?: number;
    };
    cacheableResponse?: {
      statuses?: number[];
      headers?: Record<string, string>;
    };
  };
}

// IndexedDB for Service Worker
export interface ServiceWorkerDB {
  name: string;
  version: number;
  stores: ServiceWorkerDBStore[];
}

export interface ServiceWorkerDBStore {
  name: string;
  keyPath: string;
  autoIncrement?: boolean;
  indexes?: ServiceWorkerDBIndex[];
}

export interface ServiceWorkerDBIndex {
  name: string;
  keyPath: string;
  unique?: boolean;
}

// Sync Queue Types for Service Worker
export interface SyncQueueEntry {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface SyncQueueManager {
  add(entry: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'retryCount'>): Promise<void>;
  process(): Promise<void>;
  retry(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  getAll(): Promise<SyncQueueEntry[]>;
}

// Performance and Analytics Types
export interface ServiceWorkerMetrics {
  cacheHitRatio: number;
  averageResponseTime: number;
  syncQueueSize: number;
  offlineTime: number;
  lastSyncTime: number;
}

export interface ServiceWorkerPerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
}