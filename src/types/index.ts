/**
 * Main Type Definitions Export
 * 
 * This file exports all TypeScript interfaces and types for the PWA-enhanced
 * van stock management system.
 */

// PWA Core Types
export * from './pwa';

// Service Worker Types
export * from './service-worker';

// Van Stock Management Types
export * from './van-stock';

// Bill Processing Types
export * from './bill-processing';

// Error Handling Types
export * from './error-handling';

// Database Types - Explicitly export to avoid conflicts
export type {
  User as DatabaseUser,
  Sale as DatabaseSale,
  VanLoad as DatabaseVanLoad,
  BillSubmission as DatabaseBillSubmission,
  SyncOperation as DatabaseSyncOperation,
  ReconciliationReport as DatabaseReconciliationReport,
  UserWithRelations,
  SaleWithUser,
  VanLoadWithUser,
  BillSubmissionWithUser,
  CreateUserData,
  CreateSaleData,
  CreateVanLoadData,
  CreateBillSubmissionData,
  CreateSyncOperationData,
  CreateReconciliationReportData,
  UpdateSaleData,
  UpdateVanLoadData,
  UpdateBillSubmissionData,
  UpdateSyncOperationData,
  SaleFilters,
  VanLoadFilters,
  BillSubmissionFilters,
  SyncOperationFilters
} from './database';

// Re-export existing item types for compatibility
export type { PriceVariant, Item } from '../app/lib/items';

// Common utility types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface UserSession {
  userId: string;
  username: string;
  role: string;
  isAuthenticated: boolean;
  expiresAt?: Date;
}

// PWA Installation Types
export interface PWAInstallPrompt {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAInstallationState {
  canInstall: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  installPrompt?: PWAInstallPrompt;
}

// Notification Types
export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

// Theme and UI Types
export interface ThemeConfig {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

export interface UIState {
  isLoading: boolean;
  isOffline: boolean;
  theme: 'light' | 'dark' | 'system';
  notifications: AppNotification[];
}

export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actions?: NotificationAction[];
}

// Form and Validation Types
export interface FormField<T = any> {
  value: T;
  error?: string;
  touched: boolean;
  required: boolean;
}

export interface FormState<T = Record<string, any>> {
  fields: { [K in keyof T]: FormField<T[K]> };
  isValid: boolean;
  isSubmitting: boolean;
  submitCount: number;
}

// Export constants for type checking
export const USER_ROLES = ['admin', 'user'] as const;
export const SYNC_STATUSES = ['pending', 'synced', 'failed'] as const;
export const PAYMENT_METHODS = ['cash', 'credit', 'cheque'] as const;
export const DISCREPANCY_TYPES = ['quantity_missing', 'quantity_excess', 'payment_mismatch'] as const;
export const RECONCILIATION_STATUSES = ['balanced', 'discrepancies_found'] as const;

export type UserRole = typeof USER_ROLES[number];
export type SyncStatus = typeof SYNC_STATUSES[number];
export type PaymentMethod = typeof PAYMENT_METHODS[number];
export type DiscrepancyType = typeof DISCREPANCY_TYPES[number];
export type ReconciliationStatus = typeof RECONCILIATION_STATUSES[number];