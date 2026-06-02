/**
 * Database Model Type Definitions
 * 
 * This file contains TypeScript interfaces that extend the Prisma schema
 * for PWA functionality and enhanced van stock management.
 */

// Extended User Model
export interface User {
  id: string;
  username: string;
  password: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  sales?: Sale[];
  vanLoads?: VanLoad[];
  billSubmissions?: BillSubmission[];
  syncOperations?: SyncOperation[];
}

// Extended Sale Model
export interface Sale {
  id: string;
  billNumber: string;
  billTitle: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  billImageBase64?: string;
  billImageName?: string;
  createdAt: Date;
  userId: string;
  user?: User;
  syncStatus: 'pending' | 'synced' | 'failed';
}

// Extended VanLoad Model
export interface VanLoad {
  id: string;
  date: Date;
  itemName: string;
  loaded: number;
  returned: number;
  userId: string;
  user?: User;
  createdAt: Date;
  syncStatus: 'pending' | 'synced' | 'failed';
}

// New BillSubmission Model
export interface BillSubmission {
  id: string;
  billNumber: string;
  imageData: string;
  imageName: string;
  selectedItems: Record<string, unknown>[]; // JSON data containing SelectedItem[]
  userId: string;
  user?: User;
  processed: boolean;
  createdAt: Date;
  syncStatus: 'pending' | 'synced' | 'failed';
}

// New SyncOperation Model
export interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint: string;
  data: Record<string, unknown>; // JSON data
  userId: string;
  user?: User;
  status: 'pending' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

// New ReconciliationReport Model
export interface ReconciliationReport {
  id: string;
  userId: string;
  date: Date;
  summary: Record<string, unknown>; // JSON data containing ReconciliationSummary
  itemDetails: Record<string, unknown>[]; // JSON data containing ItemReconciliation[]
  paymentData: Record<string, unknown>; // JSON data containing PaymentRecord
  discrepancies: Record<string, unknown>[]; // JSON data containing DiscrepancyAlert[]
  status: 'balanced' | 'discrepancies_found';
  createdAt: Date;
}

// Database Query Types
export interface UserWithRelations extends User {
  sales: Sale[];
  vanLoads: VanLoad[];
  billSubmissions: BillSubmission[];
  syncOperations: SyncOperation[];
}

export interface SaleWithUser extends Sale {
  user: User;
}

export interface VanLoadWithUser extends VanLoad {
  user: User;
}

export interface BillSubmissionWithUser extends BillSubmission {
  user: User;
}

// Database Operation Types
export interface CreateUserData {
  username: string;
  password: string;
  role?: string;
}

export interface CreateSaleData {
  billNumber?: string;
  billTitle?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  billImageBase64?: string;
  billImageName?: string;
  userId: string;
  syncStatus?: 'pending' | 'synced' | 'failed';
}

export interface CreateVanLoadData {
  date?: Date;
  itemName: string;
  loaded: number;
  returned?: number;
  userId: string;
  syncStatus?: 'pending' | 'synced' | 'failed';
}

export interface CreateBillSubmissionData {
  billNumber: string;
  imageData: string;
  imageName: string;
  selectedItems: Record<string, unknown>;
  userId: string;
  processed?: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed';
}

export interface CreateSyncOperationData {
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint: string;
  data: Record<string, unknown>;
  userId: string;
  status?: 'pending' | 'completed' | 'failed';
  retryCount?: number;
  maxRetries?: number;
}

export interface CreateReconciliationReportData {
  userId: string;
  date: Date;
  summary: Record<string, unknown>;
  itemDetails: Record<string, unknown>[];
  paymentData: Record<string, unknown>;
  discrepancies: Record<string, unknown>[];
  status: 'balanced' | 'discrepancies_found';
}

// Update Types
export interface UpdateSaleData {
  billNumber?: string;
  billTitle?: string;
  itemName?: string;
  quantity?: number;
  unitPrice?: number;
  totalAmount?: number;
  paymentMethod?: string;
  billImageBase64?: string;
  billImageName?: string;
  syncStatus?: 'pending' | 'synced' | 'failed';
}

export interface UpdateVanLoadData {
  date?: Date;
  itemName?: string;
  loaded?: number;
  returned?: number;
  syncStatus?: 'pending' | 'synced' | 'failed';
}

export interface UpdateBillSubmissionData {
  billNumber?: string;
  imageData?: string;
  imageName?: string;
  selectedItems?: Record<string, unknown>;
  processed?: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed';
}

export interface UpdateSyncOperationData {
  status?: 'pending' | 'completed' | 'failed';
  retryCount?: number;
  completedAt?: Date;
  error?: string;
}

// Query Filter Types
export interface SaleFilters {
  userId?: string;
  itemName?: string;
  paymentMethod?: string;
  dateFrom?: Date;
  dateTo?: Date;
  syncStatus?: 'pending' | 'synced' | 'failed';
}

export interface VanLoadFilters {
  userId?: string;
  itemName?: string;
  date?: Date;
  dateFrom?: Date;
  dateTo?: Date;
  syncStatus?: 'pending' | 'synced' | 'failed';
}

export interface BillSubmissionFilters {
  userId?: string;
  processed?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  syncStatus?: 'pending' | 'synced' | 'failed';
}

export interface SyncOperationFilters {
  userId?: string;
  type?: 'CREATE' | 'UPDATE' | 'DELETE';
  status?: 'pending' | 'completed' | 'failed';
  endpoint?: string;
}