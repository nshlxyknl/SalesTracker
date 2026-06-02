// IndexedDB wrapper for offline storage
export interface OfflineStorageManager {
  store<T>(key: string, data: T): Promise<void>;
  retrieve<T>(key: string): Promise<T | null>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
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

export interface SyncQueue {
  enqueue(operation: SyncOperation): Promise<void>;
  dequeue(): Promise<SyncOperation | null>;
  peek(): Promise<SyncOperation | null>;
  size(): Promise<number>;
  clear(): Promise<void>;
}

// IndexedDB database configuration
const DB_NAME = 'SalesTrackerDB';
const DB_VERSION = 1;

const STORES = {
  VAN_LOADS: 'vanLoads',
  SALES: 'sales',
  BILL_SUBMISSIONS: 'billSubmissions',
  SYNC_QUEUE: 'syncQueue',
  USER_PREFERENCES: 'userPreferences',
  CACHE_METADATA: 'cacheMetadata',
} as const;

class IndexedDBManager implements OfflineStorageManager {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  public async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB not available in this environment');
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.VAN_LOADS)) {
          const vanLoadsStore = db.createObjectStore(STORES.VAN_LOADS, { keyPath: 'localId' });
          vanLoadsStore.createIndex('userId', 'userId', { unique: false });
          vanLoadsStore.createIndex('date', 'date', { unique: false });
          vanLoadsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.SALES)) {
          const salesStore = db.createObjectStore(STORES.SALES, { keyPath: 'localId' });
          salesStore.createIndex('userId', 'userId', { unique: false });
          salesStore.createIndex('billNumber', 'billNumber', { unique: false });
          salesStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.BILL_SUBMISSIONS)) {
          const billsStore = db.createObjectStore(STORES.BILL_SUBMISSIONS, { keyPath: 'localId' });
          billsStore.createIndex('userId', 'userId', { unique: false });
          billsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('type', 'type', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.USER_PREFERENCES)) {
          db.createObjectStore(STORES.USER_PREFERENCES, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.CACHE_METADATA)) {
          const cacheStore = db.createObjectStore(STORES.CACHE_METADATA, { keyPath: 'url' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  async store<T>(key: string, data: T): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([STORES.USER_PREFERENCES], 'readwrite');
    const store = transaction.objectStore(STORES.USER_PREFERENCES);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ key, value: data, lastModified: new Date() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async retrieve<T>(key: string): Promise<T | null> {
    const db = await this.getDB();
    const transaction = db.transaction([STORES.USER_PREFERENCES], 'readonly');
    const store = transaction.objectStore(STORES.USER_PREFERENCES);
    
    return new Promise<T | null>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([STORES.USER_PREFERENCES], 'readwrite');
    const store = transaction.objectStore(STORES.USER_PREFERENCES);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([STORES.USER_PREFERENCES], 'readwrite');
    const store = transaction.objectStore(STORES.USER_PREFERENCES);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllKeys(): Promise<string[]> {
    const db = await this.getDB();
    const transaction = db.transaction([STORES.USER_PREFERENCES], 'readonly');
    const store = transaction.objectStore(STORES.USER_PREFERENCES);
    
    return new Promise<string[]>((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }

  // Van loads specific methods
  async storeVanLoad(vanLoad: Record<string, unknown>): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([STORES.VAN_LOADS], 'readwrite');
    const store = transaction.objectStore(STORES.VAN_LOADS);
    
    const vanLoadWithMeta = {
      ...vanLoad,
      localId: vanLoad.localId || `local_${Date.now()}_${Math.random()}`,
      lastModified: new Date(),
      syncStatus: vanLoad.syncStatus || 'pending'
    };
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(vanLoadWithMeta);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getVanLoads(userId?: string): Promise<Record<string, unknown>[]> {
    const db = await this.getDB();
    const transaction = db.transaction([STORES.VAN_LOADS], 'readonly');
    const store = transaction.objectStore(STORES.VAN_LOADS);
    
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      let request: IDBRequest;
      
      if (userId) {
        const index = store.index('userId');
        request = index.getAll(userId);
      } else {
        request = store.getAll();
      }
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Sales specific methods
  async storeSale(sale: Record<string, unknown>): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([STORES.SALES], 'readwrite');
    const store = transaction.objectStore(STORES.SALES);
    
    const saleWithMeta = {
      ...sale,
      localId: sale.localId || `local_${Date.now()}_${Math.random()}`,
      lastModified: new Date(),
      syncStatus: sale.syncStatus || 'pending'
    };
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(saleWithMeta);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSales(userId?: string): Promise<Record<string, unknown>[]> {
    const db = await this.getDB();
    const transaction = db.transaction([STORES.SALES], 'readonly');
    const store = transaction.objectStore(STORES.SALES);
    
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      let request: IDBRequest;
      
      if (userId) {
        const index = store.index('userId');
        request = index.getAll(userId);
      } else {
        request = store.getAll();
      }
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Bill submissions specific methods
  async storeBillSubmission(billSubmission: Record<string, unknown>): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([STORES.BILL_SUBMISSIONS], 'readwrite');
    const store = transaction.objectStore(STORES.BILL_SUBMISSIONS);
    
    const billWithMeta = {
      ...billSubmission,
      localId: billSubmission.localId || `local_${Date.now()}_${Math.random()}`,
      lastModified: new Date(),
      syncStatus: billSubmission.syncStatus || 'pending'
    };
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(billWithMeta);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getBillSubmissions(userId?: string): Promise<Record<string, unknown>[]> {
    const db = await this.getDB();
    const transaction = db.transaction([STORES.BILL_SUBMISSIONS], 'readonly');
    const store = transaction.objectStore(STORES.BILL_SUBMISSIONS);
    
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      let request: IDBRequest;
      
      if (userId) {
        const index = store.index('userId');
        request = index.getAll(userId);
      } else {
        request = store.getAll();
      }
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

class SyncQueueManager implements SyncQueue {
  private dbManager: IndexedDBManager;

  constructor(dbManager: IndexedDBManager) {
    this.dbManager = dbManager;
  }

  async enqueue(operation: SyncOperation): Promise<void> {
    const db = await this.dbManager.getDB();
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(operation);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async dequeue(): Promise<SyncOperation | null> {
    const db = await this.dbManager.getDB();
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const index = store.index('timestamp');
    
    return new Promise<SyncOperation | null>((resolve, reject) => {
      const request = index.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const operation = cursor.value;
          cursor.delete();
          resolve(operation);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async peek(): Promise<SyncOperation | null> {
    const db = await this.dbManager.getDB();
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const index = store.index('timestamp');
    
    return new Promise<SyncOperation | null>((resolve, reject) => {
      const request = index.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor ? cursor.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async size(): Promise<number> {
    const db = await this.dbManager.getDB();
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    
    return new Promise<number>((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.dbManager.getDB();
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instances
export const offlineStorage = new IndexedDBManager();
export const syncQueue = new SyncQueueManager(offlineStorage);

// Utility functions
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true; // Assume online during SSR
  }
  return navigator.onLine;
}

export function addOnlineListener(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}; // No-op during SSR
  }
  window.addEventListener('online', callback);
  return () => window.removeEventListener('online', callback);
}

export function addOfflineListener(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}; // No-op during SSR
  }
  window.addEventListener('offline', callback);
  return () => window.removeEventListener('offline', callback);
}