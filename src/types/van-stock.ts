/**
 * Van Stock Management Type Definitions
 * 
 * This file contains TypeScript interfaces for van stock management functionality
 * including stock tracking, reconciliation, and discrepancy detection.
 */

// Van Stock Manager Types
export interface VanStockManager {
  loadDailyStock(userId: string, date: Date, items: VanLoadItem[]): Promise<void>;
  updateReturns(userId: string, date: Date, returns: VanReturnItem[]): Promise<void>;
  getStockStatus(userId: string, date: Date): Promise<VanStockStatus>;
  calculateExpectedSales(userId: string, date: Date): Promise<ExpectedSales[]>;
}

export interface VanLoadItem {
  itemName: string;
  loaded: number;
  returned?: number;
}

export interface VanReturnItem {
  itemName: string;
  returned: number;
}

export interface VanStockStatus {
  userId: string;
  date: Date;
  items: VanStockItem[];
  totalLoaded: number;
  totalReturned: number;
  expectedSales: number;
}

export interface VanStockItem {
  itemName: string;
  loaded: number;
  returned: number;
  expectedSales: number;
  actualSales: number;
  discrepancy: number;
  status: 'balanced' | 'missing' | 'excess';
}

export interface ExpectedSales {
  itemName: string;
  expectedQuantity: number;
}

// Reconciliation Engine Types
export interface ReconciliationEngine {
  calculateDiscrepancies(userId: string, date: Date): Promise<ReconciliationReport>;
  generateReport(userId: string, date: Date): Promise<ReconciliationReport>;
  getDiscrepancyAlerts(userId: string, date: Date): Promise<DiscrepancyAlert[]>;
  validatePayments(userId: string, date: Date, payments: PaymentRecord): Promise<PaymentValidation>;
}

export interface ReconciliationReport {
  userId: string;
  date: Date;
  summary: ReconciliationSummary;
  itemDetails: ItemReconciliation[];
  paymentValidation: PaymentValidation;
  discrepancies: DiscrepancyAlert[];
  status: 'balanced' | 'discrepancies_found';
}

export interface ReconciliationSummary {
  totalLoaded: number;
  totalReturned: number;
  expectedSales: number;
  actualSales: number;
  totalDiscrepancy: number;
  discrepancyCount: number;
}

export interface ItemReconciliation {
  itemName: string;
  loaded: number;
  returned: number;
  expectedSales: number;
  actualSales: number;
  discrepancy: number;
  discrepancyType: 'none' | 'missing' | 'excess';
}

export interface DiscrepancyAlert {
  id: string;
  type: 'quantity_missing' | 'quantity_excess' | 'payment_mismatch';
  itemName?: string;
  amount: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
}

export interface PaymentRecord {
  cash: number;
  credit: number;
  cheque: number;
  total: number;
}

export interface PaymentValidation {
  expectedTotal: number;
  actualTotal: number;
  discrepancy: number;
  valid: boolean;
  alerts: DiscrepancyAlert[];
}

// Stock Reconciliation Data Types
export interface ReconciliationData {
  userId: string;
  date: Date;
  stockItems: VanStockItem[];
  payments: PaymentRecord;
  actualSales: ActualSalesItem[];
}

export interface ActualSalesItem {
  itemName: string;
  quantity: number;
  totalAmount: number;
}