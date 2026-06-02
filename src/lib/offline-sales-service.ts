import { OfflineStore, OfflineSale } from './db/offline-db';
import { persistentAuth } from './auth/persistent-auth';
import { syncManager } from './sync/sync-manager';
import { v4 as uuidv4 } from 'uuid';

export interface SaleItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateSaleRequest {
  userId: string;
  billTitle: string;
  items: SaleItem[];
  paymentMethod: 'cash' | 'cheque' | 'credit';
  billFile?: File | null;
}

export interface SaleSubmissionResult {
  ok: boolean;
  offline: boolean;
  saleId?: string;
  error?: string;
}

export interface DisplaySale {
  id: string;
  billNumber: string;
  billTitle: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  billImageBase64: string | null;
  createdAt: string;
  pendingSync?: boolean;
}

/**
 * Offline-first sales service that handles creating, storing, and syncing sales
 */
export class OfflineSalesService {
  private static instance: OfflineSalesService;

  static getInstance(): OfflineSalesService {
    if (!OfflineSalesService.instance) {
      OfflineSalesService.instance = new OfflineSalesService();
    }
    return OfflineSalesService.instance;
  }

  /**
   * Submit a sale - saves locally first, then syncs when online
   */
  async submitSale(request: CreateSaleRequest): Promise<SaleSubmissionResult> {
    try {
      const isOnline = navigator.onLine;
      let billImageBase64: string | null = null;

      // Convert file to base64 if present
      if (request.billFile) {
        billImageBase64 = await this.fileToBase64(request.billFile);
      }

      // Generate bill number
      const billNumber = await this.generateBillNumber();

      // Save each item as a separate sale record (matching your existing structure)
      const saleIds: string[] = [];
      
      for (const item of request.items) {
        const offlineSale: Omit<OfflineSale, 'id'> = {
          userId: request.userId,
          billNumber,
          billTitle: request.billTitle,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: item.quantity * item.unitPrice,
          paymentMethod: request.paymentMethod,
          billImageBase64,
          createdAt: new Date().toISOString(),
          synced: false,
          syncAttempts: 0
        };

        const saleId = await OfflineStore.saveSale(offlineSale);
        saleIds.push(saleId);
      }

      // Try to sync immediately if online
      if (isOnline) {
        try {
          const syncResult = await syncManager.forceSyncAll();
          if (syncResult.success && syncResult.synced > 0) {
            return {
              ok: true,
              offline: false,
              saleId: saleIds[0]
            };
          }
        } catch (error) {
          console.log('Immediate sync failed, will retry later:', error);
        }
      }

      // Return success even if sync failed - it will be retried
      return {
        ok: true,
        offline: true,
        saleId: saleIds[0]
      };

    } catch (error) {
      console.error('Failed to submit sale:', error);
      return {
        ok: false,
        offline: false,
        error: error instanceof Error ? error.message : 'Failed to save sale'
      };
    }
  }

  /**
   * Get sales for a specific date, combining offline and synced data
   */
  async getSalesForDate(userId: string, date: string): Promise<DisplaySale[]> {
    try {
      const offlineSales = await OfflineStore.getSalesByDate(userId, date);
      
      // Convert offline sales to display format
      const displaySales: DisplaySale[] = offlineSales.map(sale => ({
        id: sale.id,
        billNumber: sale.billNumber,
        billTitle: sale.billTitle,
        itemName: sale.itemName,
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        totalAmount: sale.totalAmount,
        paymentMethod: sale.paymentMethod,
        billImageBase64: sale.billImageBase64,
        createdAt: sale.createdAt,
        pendingSync: !sale.synced
      }));

      // If online, also try to fetch from server for any missing data
      if (navigator.onLine) {
        try {
          const serverSales = await this.fetchServerSales(date);
          
          // Merge server sales, avoiding duplicates
          const offlineIds = new Set(offlineSales.filter(s => s.synced).map(s => s.serverSaleId));
          const newServerSales = serverSales.filter(sale => !offlineIds.has(sale.id));
          
          displaySales.push(...newServerSales.map(sale => ({
            ...sale,
            pendingSync: false
          })));
        } catch (error) {
          console.log('Failed to fetch server sales:', error);
        }
      }

      // Sort by creation time (newest first)
      return displaySales.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    } catch (error) {
      console.error('Failed to get sales for date:', error);
      return [];
    }
  }

  /**
   * Get all pending (unsynced) sales
   */
  async getPendingSales(): Promise<DisplaySale[]> {
    try {
      const pendingSales = await OfflineStore.getUnsyncedSales();
      
      return pendingSales.map(sale => ({
        id: sale.id,
        billNumber: sale.billNumber,
        billTitle: sale.billTitle,
        itemName: sale.itemName,
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        totalAmount: sale.totalAmount,
        paymentMethod: sale.paymentMethod,
        billImageBase64: sale.billImageBase64,
        createdAt: sale.createdAt,
        pendingSync: true
      }));
    } catch (error) {
      console.error('Failed to get pending sales:', error);
      return [];
    }
  }

  /**
   * Validate sale items against available stock
   */
  validateSaleItems(items: SaleItem[]): string | null {
    if (!items || items.length === 0) {
      return "Add at least one item to the sale.";
    }

    for (const item of items) {
      if (!item.itemName || item.itemName.trim() === '') {
        return "All items must have a name selected.";
      }

      if (item.quantity <= 0) {
        return `${item.itemName} must have a quantity greater than 0.`;
      }

      if (item.unitPrice < 0) {
        return `${item.itemName} cannot have a negative price.`;
      }
    }

    return null;
  }

  /**
   * Force sync all pending sales
   */
  async forceSyncAll(): Promise<void> {
    await syncManager.forceSyncAll();
  }

  /**
   * Get sync status and statistics
   */
  async getSyncStatus(): Promise<{
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: number;
    lastSyncTime: string | null;
  }> {
    const status = syncManager.getStatus();
    const pendingSales = await OfflineStore.getUnsyncedSales();
    
    return {
      isOnline: status.isOnline,
      isSyncing: status.isSyncing,
      pendingCount: pendingSales.length,
      lastSyncTime: status.lastSyncTime
    };
  }

  /**
   * Subscribe to sync status changes
   */
  onSyncStatusChange(callback: (status: any) => void): () => void {
    return syncManager.addListener(callback);
  }

  // Private helper methods

  private async generateBillNumber(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `BILL-${timestamp}-${random}`;
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just the base64 data
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async fetchServerSales(date: string): Promise<any[]> {
    const authHeaders = await persistentAuth.getAuthHeader();
    
    const response = await fetch(`/api/sales?date=${encodeURIComponent(date)}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch server sales: ${response.status}`);
    }

    return await response.json();
  }
}

// Singleton instance
export const offlineSalesService = OfflineSalesService.getInstance();

// Legacy functions for backward compatibility with existing code
export async function submitSaleWithOfflineSupport(request: CreateSaleRequest): Promise<SaleSubmissionResult> {
  return offlineSalesService.submitSale(request);
}

export async function getPendingSales(userId?: string): Promise<DisplaySale[]> {
  return offlineSalesService.getPendingSales();
}

export function validateSaleItems(items: SaleItem[]): string | null {
  return offlineSalesService.validateSaleItems(items);
}

export function pendingSalesToDisplayRows(pendingSales: DisplaySale[]): DisplaySale[] {
  return pendingSales;
}