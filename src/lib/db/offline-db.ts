import Dexie, { Table } from 'dexie';

export interface OfflineSale {
  id: string;
  userId: string;
  billNumber: string;
  billTitle: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'cheque' | 'credit';
  billImageBase64: string | null;
  createdAt: string;
  synced: boolean;
  syncAttempts: number;
  lastSyncAttempt?: string;
  serverSaleId?: string; // ID from server after successful sync
}

export interface OfflineSession {
  id: string;
  user: {
    id: string;
    username: string;
    role: string;
    createdAt: string; // Store as ISO string for IndexedDB compatibility
    updatedAt: string; // Store as ISO string for IndexedDB compatibility
  };
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface SyncQueue {
  id: string;
  type: 'sale' | 'stock' | 'user';
  data: Record<string, unknown>;
  attempts: number;
  createdAt: string;
  lastAttempt?: string;
  error?: string;
}

export interface CachedStock {
  id: string;
  userId: string;
  date: string;
  stock: {
    itemName: string;
    loaded: number;
    sold: number;
    remaining: number;
    returned: number;
  }[];
  hasStock: boolean;
  totalItems: number;
  cachedAt: string;
  expiresAt: string;
}

export class OfflineDatabase extends Dexie {
  sales!: Table<OfflineSale>;
  sessions!: Table<OfflineSession>;
  syncQueue!: Table<SyncQueue>;
  cachedStock!: Table<CachedStock>;

  constructor() {
    super('SalesTrackerOfflineDB');
    
    this.version(1).stores({
      sales: '++id, userId, billNumber, synced, createdAt',
      sessions: '++id, user.id',
      syncQueue: '++id, type, createdAt',
      cachedStock: '++id, userId, date, expiresAt'
    });

    // Add hooks for data validation
    this.sales.hook('creating', (primKey, obj, trans) => {
      obj.createdAt = obj.createdAt || new Date().toISOString();
      obj.synced = obj.synced ?? false;
      obj.syncAttempts = obj.syncAttempts || 0;
    });

    this.sessions.hook('creating', (primKey, obj, trans) => {
      obj.createdAt = obj.createdAt || new Date().toISOString();
    });

    this.syncQueue.hook('creating', (primKey, obj, trans) => {
      obj.createdAt = obj.createdAt || new Date().toISOString();
      obj.attempts = obj.attempts || 0;
    });
  }
}

export const db = new OfflineDatabase();

// Helper functions for database operations
export class OfflineStore {
  // Sales operations
  static async saveSale(sale: Omit<OfflineSale, 'id'>): Promise<string> {
    const id = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await db.sales.add({
      ...sale,
      id
    });
    return id;
  }

  static async getAllSales(userId?: string): Promise<OfflineSale[]> {
    if (userId) {
      return await db.sales.where('userId').equals(userId).toArray();
    }
    return await db.sales.toArray();
  }

  static async getSalesByDate(userId: string, date: string): Promise<OfflineSale[]> {
    const startOfDay = new Date(date + 'T00:00:00.000Z').toISOString();
    const endOfDay = new Date(date + 'T23:59:59.999Z').toISOString();
    
    return await db.sales
      .where('userId').equals(userId)
      .and(sale => sale.createdAt >= startOfDay && sale.createdAt <= endOfDay)
      .toArray();
  }

  static async getUnsyncedSales(): Promise<OfflineSale[]> {
    return await db.sales.filter(sale => !sale.synced).toArray();
  }

  static async markSaleAsSynced(id: string, serverSaleId: string): Promise<void> {
    await db.sales.update(id, {
      synced: true,
      serverSaleId,
      lastSyncAttempt: new Date().toISOString()
    });
  }

  static async incrementSyncAttempts(id: string): Promise<void> {
    const sale = await db.sales.get(id);
    if (sale) {
      await db.sales.update(id, {
        syncAttempts: sale.syncAttempts + 1,
        lastSyncAttempt: new Date().toISOString()
      });
    }
  }

  // Session operations
  static async saveSession(session: Omit<OfflineSession, 'id'>): Promise<void> {
    // Clear existing sessions first
    await db.sessions.clear();
    const id = `session-${Date.now()}`;
    await db.sessions.add({
      ...session,
      id
    });
  }

  static async getSession(): Promise<OfflineSession | undefined> {
    const sessions = await db.sessions.toArray();
    if (sessions.length === 0) return undefined;
    
    const session = sessions[0];
    
    // Check if session is expired
    if (new Date(session.expiresAt) <= new Date()) {
      await db.sessions.clear();
      return undefined;
    }
    
    return session;
  }

  static async clearSession(): Promise<void> {
    await db.sessions.clear();
  }

  // Stock caching operations
  static async cacheStock(userId: string, date: string, stockData: Record<string, unknown>): Promise<void> {
    const id = `stock-${userId}-${date}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Cache for 1 hour
    
    await db.cachedStock.put({
      id,
      userId,
      date,
      ...stockData,
      cachedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    });
  }

  static async getCachedStock(userId: string, date: string): Promise<CachedStock | undefined> {
    const cached = await db.cachedStock
      .where(['userId', 'date'])
      .equals([userId, date])
      .first();
    
    if (!cached) return undefined;
    
    // Check if cache is expired
    if (new Date(cached.expiresAt) <= new Date()) {
      await db.cachedStock.delete(cached.id);
      return undefined;
    }
    
    return cached;
  }

  // Sync queue operations
  static async addToSyncQueue(type: SyncQueue['type'], data: Record<string, unknown>): Promise<void> {
    const id = `sync-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await db.syncQueue.add({
      id,
      type,
      data,
      attempts: 0,
      createdAt: new Date().toISOString()
    });
  }

  static async getSyncQueue(): Promise<SyncQueue[]> {
    return await db.syncQueue.orderBy('createdAt').toArray();
  }

  static async removeSyncItem(id: string): Promise<void> {
    await db.syncQueue.delete(id);
  }

  static async incrementSyncQueueAttempts(id: string, error?: string): Promise<void> {
    const item = await db.syncQueue.get(id);
    if (item) {
      await db.syncQueue.update(id, {
        attempts: item.attempts + 1,
        lastAttempt: new Date().toISOString(),
        error
      });
    }
  }

  // Utility operations
  static async clearAllData(): Promise<void> {
    await db.sales.clear();
    await db.sessions.clear();
    await db.syncQueue.clear();
    await db.cachedStock.clear();
  }

  static async getStats(): Promise<{
    totalSales: number;
    unsyncedSales: number;
    queuedItems: number;
    cacheSize: number;
  }> {
    const [totalSales, unsyncedSales, queuedItems, cacheSize] = await Promise.all([
      db.sales.count(),
      db.sales.filter(sale => !sale.synced).count(),
      db.syncQueue.count(),
      db.cachedStock.count()
    ]);

    return {
      totalSales,
      unsyncedSales,
      queuedItems,
      cacheSize
    };
  }
}